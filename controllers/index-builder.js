const ObjectId = require("mongoose").Types.ObjectId;
const Product = require("../models/product");
const fs = require("fs");
const path = require("path");
const ort = require("onnxruntime-node");
const HNSWLib = require("hnswlib-node");
const Estore = require("../models/estore");
const {
  makeFeedsForSession,
  getBufferFromPathOrBuffer,
} = require("./embed_helper");

const MODEL_PATH = path.join(__dirname, "models", "clip_image.onnx");
const FILE_PATH = path.join(__dirname, "estoreids.json");

async function embedImage(bufferOrPath, session) {
  const buffer = await getBufferFromPathOrBuffer(bufferOrPath);
  const feeds = await makeFeedsForSession(session, buffer, 224);
  const outputs = await session.run(feeds);

  const outKeys = Object.keys(outputs);
  const embKey =
    outKeys.find((k) =>
      /image_emb|image_embed|image_embeds|image_embed/i.test(k)
    ) ||
    outKeys.find((k) => /emb|embed|last_hidden_state/i.test(k)) ||
    outKeys[0];

  const embTensor = outputs[embKey];
  if (!embTensor) throw new Error("Embedding tensor not found in outputs");

  const embData = embTensor.data;
  // normalize
  let norm = 0;
  for (let i = 0; i < embData.length; i++) norm += embData[i] * embData[i];
  norm = Math.sqrt(norm) || 1.0;
  const out = new Float32Array(embData.length);
  for (let i = 0; i < embData.length; i++) out[i] = embData[i] / norm;
  return out;
}

async function readIds() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2));
    }

    const data = fs.readFileSync(FILE_PATH, "utf8");
    const ids = JSON.parse(data);

    if (!Array.isArray(ids)) {
      throw new Error("JSON file is not an array");
    }

    return ids;
  } catch (err) {
    return [];
  }
}

async function addId(newId) {
  const ids = await readIds();

  if (!ids.includes(newId)) {
    ids.push(newId);

    fs.writeFileSync(FILE_PATH, JSON.stringify(ids, null, 2));
  }

  return ids;
}

exports.buildIndex = async (req, res) => {
  const estoreid = new ObjectId(req.headers.estoreid);
  const resellid = req.headers.resellid?.toString().trim();
  const dbPath = path.join(
    __dirname,
    "product-db",
    "product-db-" + estoreid + ".json"
  );
  const OUT_INDEX = path.join(
    __dirname,
    "vectors",
    "vectors" + estoreid + ".bin"
  );

  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    if (fs.existsSync(OUT_INDEX)) {
      fs.unlinkSync(OUT_INDEX);
    }

    await Estore(resellid).findOneAndUpdate(
      { _id: new ObjectId(req.headers.estoreid) },
      { indexing: true, estoreChange: new Date().valueOf() }
    );

    const queryTxt = {
      estoreid: new ObjectId(estoreid),
      "images.0": { $exists: true },
    };

    queryTxt.aiIndex = true;

    const products = await Product(resellid)
      .find(queryTxt)
      .select("_id title images")
      .exec();

    if (products.length === 0) {
      return res.json({
        err: 'No products found for AI to train. Please make sure you activate the "Index for AI" switch on each of your products',
      });
    }

    const db = products.map((product, index) => ({
      id: product._id,
      title: product.title,
      image:
        "package" +
        resellid +
        "/" +
        "estore" +
        estoreid +
        "/products/" +
        product.images[0].url,
      vectorIndex: index,
    }));

    if (!fs.existsSync(MODEL_PATH)) {
      return res.json({
        ok: true,
        err: "Server is currently preparing necessary files for AI training. Please try agin in a few minutes",
      });
    }

    const session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["cpu"],
    });

    const vectors = [];
    const validProductIndices = [];
    const skipped = [];

    for (let i = 0; i < db.length; i++) {
      const product = db[i];
      try {
        const vecF32 = await embedImage(product.image, session);
        const plain = Array.from(vecF32);
        vectors.push(plain);
        validProductIndices.push(i);
      } catch (err) {
        skipped.push({ index: i, id: product.id, reason: err.message });
        db[i].vectorIndex = null;
      }
    }

    if (vectors.length === 0) {
      return res.json({
        ok: false,
        err: "No valid images found to build index",
        skipped,
      });
    }

    const dim = vectors[0].length;
    const index = new HNSWLib.HierarchicalNSW("cosine", dim);
    index.initIndex(vectors.length);

    for (let j = 0; j < vectors.length; j++) {
      const idxId = j;
      index.addPoint(vectors[j], idxId);
      const originalDbIndex = validProductIndices[j];
      db[originalDbIndex].vectorIndex = idxId;
    }

    for (let k = 0; k < db.length; k++) {
      if (typeof db[k].vectorIndex === "undefined") db[k].vectorIndex = null;
    }

    const outDir = path.dirname(OUT_INDEX);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    index.writeIndex(OUT_INDEX);

    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    await addId(estoreid.toString());

    await Estore.findOneAndUpdate(
      { _id: new ObjectId(req.headers.estoreid) },
      { indexing: false, estoreChange: new Date().valueOf() }
    );

    return res.json({
      ok: true,
      message: "Index built successfully",
      totalProducts: db.length,
      indexed: vectors.length,
      skippedCount: skipped.length,
      skipped,
      indexPath: OUT_INDEX,
    });
  } catch (err) {
    return res.json({ ok: false, error: String(err) });
  }
};
