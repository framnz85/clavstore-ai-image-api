const { Types } = require("mongoose");
const Product = require("../models/product");
const Estore = require("../models/estore");

const fs = require("fs");
const path = require("path");

const ort = require("onnxruntime-node");
const HNSWLib = require("hnswlib-node");

const {
  makeFeedsForSession,
  getBufferFromPathOrBuffer,
} = require("./embed_helper");

const MODEL_PATH = path.join(__dirname, "models", "clip_image.onnx");

const FILE_PATH = path.join(__dirname, "estoreids.json");

const VECTOR_DIR = path.join(__dirname, "vectors");

const PRODUCT_DB_DIR = path.join(__dirname, "product-db");

const IMAGE_SIZE = 224;

/**
 * Generate a normalized CLIP image embedding.
 *
 * IMPORTANT:
 *
 * This must use the exact same preprocessing
 * as searchProduct().
 */
async function embedImage(bufferOrPath, session) {
  const buffer = await getBufferFromPathOrBuffer(bufferOrPath);

  const feeds = await makeFeedsForSession(session, buffer, IMAGE_SIZE);

  /*
   * We only need image_embeds.
   *
   * The ONNX model also produces:
   *
   *   logits_per_image
   *   logits_per_text
   *   text_embeds
   *
   * There is no reason for our application
   * to fetch those outputs.
   */
  const outputs = await session.run(feeds, ["image_embeds"]);

  const embTensor = outputs.image_embeds;

  if (!embTensor) {
    throw new Error("image_embeds output not found");
  }

  const embData = embTensor.data;

  /*
   * L2 normalize the embedding.
   *
   * This matches the normalization performed
   * by searchProduct().
   */
  let norm = 0;

  for (let i = 0; i < embData.length; i++) {
    norm += embData[i] * embData[i];
  }

  norm = Math.sqrt(norm) || 1.0;

  const normalized = new Float32Array(embData.length);

  for (let i = 0; i < embData.length; i++) {
    normalized[i] = embData[i] / norm;
  }

  return normalized;
}

/**
 * Read estoreids.json.
 */
async function readIds() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2));
    }

    const data = fs.readFileSync(FILE_PATH, "utf8");

    const ids = JSON.parse(data);

    if (!Array.isArray(ids)) {
      throw new Error("estoreids.json must contain an array");
    }

    return ids;
  } catch (err) {
    console.error("[index-builder] Failed to read estoreids:", err.message);

    return [];
  }
}

/**
 * Add an estore ID to estoreids.json.
 */
async function addId(newId) {
  const ids = await readIds();

  if (!ids.includes(newId)) {
    ids.push(newId);

    fs.writeFileSync(FILE_PATH, JSON.stringify(ids, null, 2));
  }

  return ids;
}

/**
 * Make sure a directory exists.
 */
function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true,
    });
  }
}

/**
 * Safely remove a file.
 */
function removeFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[index-builder] Failed to remove ${filePath}:`, err.message);
  }
}

/**
 * Build HNSW index.
 */
exports.buildIndex = async (req, res) => {
  const rawEstoreId = req.headers.estoreid?.toString().trim();

  const resellid = req.headers.resellid?.toString().trim();

  /*
   * Validate estore ID before doing anything.
   */
  if (!rawEstoreId || !Types.ObjectId.isValid(rawEstoreId)) {
    return res.status(400).json({
      ok: false,
      error: "Invalid estoreid",
    });
  }

  const estoreObjectId = new Types.ObjectId(rawEstoreId);

  const dbPath = path.join(PRODUCT_DB_DIR, `product-db-${rawEstoreId}.json`);

  const outIndex = path.join(VECTOR_DIR, `vectors${rawEstoreId}.bin`);

  /*
   * Temporary files.
   *
   * We build the new index here first.
   *
   * Only after successful completion do we
   * replace the existing index.
   */
  const tempIndex = `${outIndex}.tmp`;

  const tempDb = `${dbPath}.tmp`;

  let session = null;

  let indexingStarted = false;

  try {
    /*
     * Make sure directories exist.
     */
    ensureDirectory(VECTOR_DIR);

    ensureDirectory(PRODUCT_DB_DIR);

    /*
     * Tell the application that indexing
     * has started.
     */
    await Estore(resellid).findOneAndUpdate(
      {
        _id: estoreObjectId,
      },
      {
        indexing: true,
        estoreChange: Date.now(),
      },
    );

    indexingStarted = true;

    /*
     * Verify the model exists.
     */
    if (!fs.existsSync(MODEL_PATH)) {
      return res.status(503).json({
        ok: false,
        err: "Server is currently preparing necessary files for AI indexing. Please try again in a few minutes.",
      });
    }

    /*
     * Find products that are enabled
     * for AI indexing and have an image.
     */
    const query = {
      estoreid: estoreObjectId,

      "images.0": {
        $exists: true,
      },

      aiIndex: true,
    };

    const products = await Product(resellid)
      .find(query)
      .select("_id title images")
      .lean()
      .exec();

    if (products.length === 0) {
      return res.json({
        ok: false,
        err: 'No products found for AI indexing. Please make sure you activate the "Index for AI" switch on your products.',
      });
    }

    /*
     * Create the product DB.
     *
     * vectorIndex will be assigned AFTER
     * successful embedding.
     */
    const db = products.map((product) => ({
      id: product._id,
      title: product.title,

      image:
        "package" +
        resellid +
        "/" +
        "estore" +
        rawEstoreId +
        "/products/" +
        product.images[0].url,

      vectorIndex: null,
    }));

    /*
     * Load ONNX session once.
     */
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["cpu"],
    });

    console.log(`[index-builder] Starting AI indexing: ${db.length} products`);

    const vectors = [];

    const validProductIndices = [];

    const skipped = [];

    /*
     * Generate embeddings.
     */
    for (let i = 0; i < db.length; i++) {
      const product = db[i];

      try {
        console.log(
          `[index-builder] Processing ${i + 1}/${db.length}: ${product.title}`,
        );

        const vector = await embedImage(product.image, session);

        /*
         * HNSW expects a regular JS array
         * with the current hnswlib-node API.
         */
        vectors.push(Array.from(vector));

        validProductIndices.push(i);
      } catch (err) {
        console.error(
          `[index-builder] Failed product ${product.id}:`,
          err.message,
        );

        skipped.push({
          index: i,
          id: product.id,
          title: product.title,
          image: product.image,
          reason: err.message,
        });

        db[i].vectorIndex = null;
      }
    }

    if (vectors.length === 0) {
      return res.status(400).json({
        ok: false,
        err: "No valid images were found to build the AI index.",
        skipped,
      });
    }

    /*
     * Determine embedding dimension.
     *
     * CLIP ViT-B/32 should produce:
     *
     * 512 dimensions
     */
    const dimension = vectors[0].length;

    console.log(`[index-builder] Embedding dimension: ${dimension}`);

    /*
     * Create HNSW index.
     */
    const hnsw = new HNSWLib.HierarchicalNSW("cosine", dimension);

    hnsw.initIndex(vectors.length);

    /*
     * Add vectors.
     */
    for (let i = 0; i < vectors.length; i++) {
      const vector = vectors[i];

      /*
       * HNSW internal ID.
       */
      const vectorIndex = i;

      hnsw.addPoint(vector, vectorIndex);

      /*
       * Save the HNSW ID into our
       * product database.
       */
      const originalProductIndex = validProductIndices[i];

      db[originalProductIndex].vectorIndex = vectorIndex;
    }

    /*
     * Make sure every product has
     * vectorIndex explicitly set.
     */
    for (const product of db) {
      if (typeof product.vectorIndex !== "number") {
        product.vectorIndex = null;
      }
    }

    /*
     * Write the new index to a temporary
     * file first.
     */
    removeFile(tempIndex);

    hnsw.writeIndex(tempIndex);

    /*
     * Write the new product DB to a
     * temporary file.
     */
    removeFile(tempDb);

    fs.writeFileSync(tempDb, JSON.stringify(db, null, 2));

    /*
     * Verify both temporary files exist
     * before replacing the active files.
     */
    if (!fs.existsSync(tempIndex)) {
      throw new Error("Temporary HNSW index was not created");
    }

    if (!fs.existsSync(tempDb)) {
      throw new Error("Temporary product DB was not created");
    }

    /*
     * Remove old files only after the
     * new files were successfully generated.
     */
    removeFile(outIndex);

    removeFile(dbPath);

    /*
     * Atomically-ish move temporary files
     * into their final locations.
     */
    fs.renameSync(tempIndex, outIndex);

    fs.renameSync(tempDb, dbPath);

    /*
     * Keep track of this estore so that
     * the application can load its index
     * after restart.
     */
    await addId(rawEstoreId);

    /*
     * Indexing completed successfully.
     */
    await Estore(resellid).findOneAndUpdate(
      {
        _id: estoreObjectId,
      },
      {
        indexing: false,
        estoreChange: Date.now(),
      },
    );

    indexingStarted = false;

    console.log(
      `[index-builder] Completed: ${vectors.length}/${db.length} indexed`,
    );

    return res.json({
      ok: true,

      message: "Index built successfully",

      totalProducts: db.length,

      indexed: vectors.length,

      skippedCount: skipped.length,

      skipped,

      dimension,

      indexPath: outIndex,

      productDbPath: dbPath,
    });
  } catch (err) {
    console.error("[index-builder] Error:", err);

    /*
     * Remove partially-created temporary
     * files.
     */
    removeFile(tempIndex);

    removeFile(tempDb);

    /*
     * IMPORTANT:
     *
     * If indexing failed, do NOT delete
     * the existing working index.
     *
     * The previous index remains available.
     */
    return res.status(500).json({
      ok: false,
      error: String(err),
    });
  } finally {
    /*
     * Always reset indexing status if
     * we successfully started it.
     */
    if (indexingStarted) {
      try {
        await Estore(resellid).findOneAndUpdate(
          {
            _id: estoreObjectId,
          },
          {
            indexing: false,
            estoreChange: Date.now(),
          },
        );
      } catch (statusError) {
        console.error(
          "[index-builder] Failed to reset indexing status:",
          statusError.message,
        );
      }
    }

    /*
     * Release the ONNX session if the
     * installed runtime exposes release().
     */
    if (session && typeof session.release === "function") {
      try {
        await session.release();
      } catch (releaseError) {
        console.error(
          "[index-builder] Failed to release ONNX session:",
          releaseError.message,
        );
      }
    }
  }
};
