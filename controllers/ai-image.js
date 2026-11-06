const express = require("express");
const ort = require("onnxruntime-node");
const HNSWLib = require("hnswlib-node");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const axios = require("axios");
const { Types } = require("mongoose");

const { makeFeedsForSession } = require("./embed_helper");

const MODEL_URL =
  "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/model.onnx";

const MODEL_DIR = path.join(__dirname, "models");
const MODEL_PATH = path.join(MODEL_DIR, "clip_image.onnx");

const ESTOREIDS_PATH = path.join(__dirname, "estoreids.json");
const VECTOR_DIR = path.join(__dirname, "vectors");
const PRODUCT_DB_DIR = path.join(__dirname, "product-db");

const IMAGE_SIZE = 224;
const EMBEDDING_DIMENSION = 512;

const app = express();

app.use(cors());

let session = null;

// HNSW indexes by estoreid
const index = {};

// Number of vectors actually stored in each HNSW index
const indexCount = {};

// Product database by estoreid
const productDb = {};

// Fast vectorIndex -> product lookup by estoreid
const productMap = {};

/**
 * Download the ONNX model if it doesn't exist.
 */
async function ensureOnnxModel() {
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, {
      recursive: true,
    });
  }

  if (fs.existsSync(MODEL_PATH)) {
    return;
  }

  console.log("[ai-image] ONNX model not found. Downloading...");

  const response = await axios.get(MODEL_URL, {
    responseType: "arraybuffer",
    timeout: 60000,
  });

  fs.writeFileSync(MODEL_PATH, Buffer.from(response.data));

  console.log("[ai-image] ONNX model downloaded.");
}

/**
 * Get the actual number of vectors stored in an HNSW index.
 */
function getIndexCount(idx, fallback = 0) {
  if (!idx) {
    return fallback;
  }

  if (typeof idx.getCurrentCount === "function") {
    try {
      return idx.getCurrentCount();
    } catch (e) {}
  }

  if (typeof idx.size === "number") {
    return idx.size;
  }

  return fallback;
}

/**
 * Load the product database for an estore.
 */
function loadProductDatabase(estoreid) {
  const dbPath = path.join(PRODUCT_DB_DIR, `product-db-${estoreid}.json`);

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Product database not found for estore ${estoreid}`);
  }

  const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));

  if (!Array.isArray(db)) {
    throw new Error(`Product database for estore ${estoreid} is not an array`);
  }

  return db;
}

/**
 * Build a fast vectorIndex -> product map.
 */
function buildProductMap(db) {
  const map = {};

  for (const product of db) {
    if (typeof product.vectorIndex === "number" && product.vectorIndex >= 0) {
      map[product.vectorIndex] = product;
    }
  }

  return map;
}

/**
 * Load one estore's HNSW index and product database.
 */
async function loadInitials(estoreid) {
  index[estoreid] = null;
  indexCount[estoreid] = 0;
  productDb[estoreid] = null;
  productMap[estoreid] = null;

  try {
    const indexPath = path.join(VECTOR_DIR, `vectors${estoreid}.bin`);

    const dbPath = path.join(PRODUCT_DB_DIR, `product-db-${estoreid}.json`);

    if (!fs.existsSync(indexPath)) {
      console.log(`[ai-image] No HNSW index found for estore ${estoreid}`);
      return;
    }

    if (!fs.existsSync(dbPath)) {
      console.log(
        `[ai-image] No product database found for estore ${estoreid}`,
      );
      return;
    }

    const db = loadProductDatabase(estoreid);

    const hnsw = new HNSWLib.HierarchicalNSW("cosine", EMBEDDING_DIMENSION);

    try {
      hnsw.readIndexSync(indexPath);
    } catch (e1) {
      console.warn(
        `[ai-image] Normal index load failed for ${estoreid}. Retrying with allowReplace=true...`,
      );

      hnsw.readIndexSync(indexPath, true);
    }

    const count = getIndexCount(
      hnsw,
      db.filter((product) => typeof product.vectorIndex === "number").length,
    );

    index[estoreid] = hnsw;
    indexCount[estoreid] = count;

    productDb[estoreid] = db;
    productMap[estoreid] = buildProductMap(db);

    console.log(`[ai-image] Loaded estore ${estoreid}: ${count} vectors`);
  } catch (err) {
    console.error(
      `[ai-image] Failed to load estore ${estoreid}:`,
      err.stack || err.message || err,
    );

    index[estoreid] = null;
    indexCount[estoreid] = 0;
    productDb[estoreid] = null;
    productMap[estoreid] = null;
  }
}

/**
 * Load all estore indexes when the application starts.
 */
async function loadAllIndexes() {
  if (!fs.existsSync(ESTOREIDS_PATH)) {
    console.warn("[ai-image] estoreids.json not found.");
    return;
  }

  const estoreids = JSON.parse(fs.readFileSync(ESTOREIDS_PATH, "utf8"));

  if (!Array.isArray(estoreids)) {
    throw new Error("estoreids.json must contain an array");
  }

  for (const estoreid of estoreids) {
    await loadInitials(estoreid.toString().trim());
  }
}

/**
 * Initialize ONNX and HNSW indexes.
 */
async function initialize() {
  try {
    await ensureOnnxModel();

    console.log("[ai-image] Loading ONNX model...");

    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["cpu"],
    });

    console.log("[ai-image] ONNX model ready.");

    await loadAllIndexes();

    console.log("[ai-image] AI image service ready.");
  } catch (err) {
    console.error(
      "[ai-image] Initialization failed:",
      err.stack || err.message || err,
    );

    session = null;
  }
}

initialize();

/**
 * Search for a product using an uploaded camera image.
 *
 * IMPORTANT:
 * The ONNX model produces several outputs, but we only need:
 *
 *     image_embeds
 *
 * Therefore session.run() explicitly requests only
 * that output.
 */
exports.searchProduct = async (req, res) => {
  try {
    const estoreid = req.headers.estoreid?.toString().trim();

    if (!estoreid) {
      return res.status(400).json({
        ok: false,
        error: "Missing estoreid",
      });
    }

    if (!Types.ObjectId.isValid(estoreid)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid estoreid",
      });
    }

    if (!session) {
      return res.status(503).json({
        ok: false,
        error: "Model not ready",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "No photo uploaded",
      });
    }

    if (!index[estoreid]) {
      return res.status(404).json({
        ok: false,
        error: "Index not loaded. Build the index first.",
      });
    }

    /*
     * The product database and product map are normally
     * loaded once when the server starts.
     *
     * The fallback below allows the service to recover
     * if the values aren't currently cached.
     */
    if (!productDb[estoreid]) {
      productDb[estoreid] = loadProductDatabase(estoreid);

      productMap[estoreid] = buildProductMap(productDb[estoreid]);
    }

    /*
     * Convert camera image into CLIP input tensors.
     */
    const feeds = await makeFeedsForSession(
      session,
      req.file.buffer,
      IMAGE_SIZE,
    );

    /*
     * IMPORTANT:
     *
     * Only request image_embeds.
     *
     * We do NOT need:
     *
     * - logits_per_image
     * - logits_per_text
     * - text_embeds
     *
     * This avoids unnecessary output handling and
     * keeps the inference path focused on the image
     * embedding we actually use.
     */
    const outputs = await session.run(feeds, ["image_embeds"]);

    const embTensor = outputs.image_embeds;

    if (!embTensor) {
      return res.status(500).json({
        ok: false,
        error: "image_embeds output not found",
      });
    }

    const embData = embTensor.data;

    if (!embData || embData.length === 0) {
      return res.status(500).json({
        ok: false,
        error: "Image embedding is empty",
      });
    }

    /*
     * Verify the expected CLIP embedding dimension.
     */
    if (embData.length !== EMBEDDING_DIMENSION) {
      return res.status(500).json({
        ok: false,
        error: `Unexpected embedding dimension: ${embData.length}. Expected ${EMBEDDING_DIMENSION}.`,
      });
    }

    /*
     * L2 normalize the embedding.
     *
     * This must match index-builder.js.
     */
    let norm = 0;

    for (let i = 0; i < embData.length; i++) {
      norm += embData[i] * embData[i];
    }

    norm = Math.sqrt(norm) || 1.0;

    const qvec = new Float32Array(embData.length);

    for (let i = 0; i < embData.length; i++) {
      qvec[i] = embData[i] / norm;
    }

    /*
     * Determine how many results to ask HNSW for.
     */
    let requestedK = parseInt(req.body?.k || "5", 10);

    if (!Number.isFinite(requestedK)) {
      requestedK = 5;
    }

    requestedK = Math.max(1, Math.min(requestedK, 20));

    /*
     * Use the actual number of indexed vectors.
     */
    const currentCount = getIndexCount(index[estoreid], indexCount[estoreid]);

    indexCount[estoreid] = currentCount;

    if (currentCount <= 0) {
      return res.status(404).json({
        ok: false,
        error: "HNSW index contains no products",
      });
    }

    const kFinal = Math.min(requestedK, currentCount);

    /*
     * HNSW expects a normal JS array.
     */
    const queryVec = Array.from(qvec);

    /*
     * Search the vector index.
     */
    const result = index[estoreid].searchKnn(queryVec, kFinal);

    const neighbors = result.neighbors || [];

    const distances = result.distances || [];

    /*
     * Return the requested top-K results.
     *
     * NOTE:
     * HNSW cosine distance is generally a distance
     * where LOWER is better.
     */
    const map = productMap[estoreid] || {};

    const matches = neighbors.map((vectorIndex, i) => {
      const product =
        map[vectorIndex] || productDb[estoreid][vectorIndex] || null;

      return {
        product,
        vectorIndex,
        distance: distances[i] ?? null,
      };
    });

    /*
     * Top-1 and top-2 information can later be used
     * for confidence/margin checking.
     */
    const top1 = matches[0] || null;
    const top2 = matches[1] || null;

    const margin =
      top1 && top2 && top1.distance !== null && top2.distance !== null
        ? top2.distance - top1.distance
        : null;

    return res.json({
      ok: true,

      results: matches,

      meta: {
        requestedK,
        kFinal,
        indexCount: currentCount,

        top1Distance: top1?.distance ?? null,

        top2Distance: top2?.distance ?? null,

        margin,
      },
    });
  } catch (err) {
    console.error(
      "[ai-image] searchProduct error:",
      err.stack || err.message || err,
    );

    return res.status(500).json({
      ok: false,
      error: String(err.message || err),
    });
  }
};
