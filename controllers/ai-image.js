const express = require("express");
const ort = require("onnxruntime-node");
const HNSWLib = require("hnswlib-node");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const axios = require("axios");
const { makeFeedsForSession } = require("./embed_helper");

const MODEL_URL =
  "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/model.onnx";

const MODEL_DIR = path.join(__dirname, "models");
const MODEL_PATH = path.join(MODEL_DIR, "clip_image.onnx");
const ESTOREIDS_PATH = path.join(__dirname, "estoreids.json");

const app = express();
app.use(cors());

let session = null;
let index = {};
let indexMaxElements = {};

function getIndexMaxElements(idx, fallback) {
  if (!idx) return fallback || 0;
  if (typeof idx.getMaxElements === "function") {
    try {
      return idx.getMaxElements();
    } catch (e) {}
  }
  if (typeof idx.getCurrentCount === "function") {
    try {
      return idx.getCurrentCount();
    } catch (e) {}
  }
  if (typeof idx.size === "number") return idx.size;
  return fallback || 0;
}

async function ensureOnnxModel() {
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  if (fs.existsSync(MODEL_PATH)) {
    return;
  }

  const response = await axios.get(MODEL_URL, {
    responseType: "arraybuffer",
    timeout: 60000,
  });

  fs.writeFileSync(MODEL_PATH, Buffer.from(response.data));
}

(async () => {
  try {
    await ensureOnnxModel();
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["cpu"],
    });
  } catch (err) {
    process.exit(1);
  }
})();

const loadInitials = async (estoreid) => {
  index[estoreid] = null;
  indexMaxElements[estoreid] = 0;
  try {
    const placeholderDim = 512;
    const INDEX_PATH = path.join(
      __dirname,
      "vectors",
      "vectors" + estoreid + ".bin"
    );
    index[estoreid] = new HNSWLib.HierarchicalNSW("cosine", placeholderDim);

    if (!fs.existsSync(INDEX_PATH)) {
      index[estoreid] = null;
      indexMaxElements[estoreid] = 0;
      return;
    }

    try {
      index[estoreid].readIndexSync(INDEX_PATH);
    } catch (e1) {
      try {
        index[estoreid].readIndexSync(INDEX_PATH, true);
      } catch (e2) {
        throw e2;
      }
    }
  } catch (err) {
    index[estoreid] = null;
    indexMaxElements[estoreid] = 0;
  }
};

(async () => {
  try {
    const estoreids = JSON.parse(fs.readFileSync(ESTOREIDS_PATH, "utf8"));
    for (const estoreid of estoreids) {
      await loadInitials(estoreid);
    }
  } catch (e) {}
})();

exports.searchProduct = async (req, res) => {
  const estoreid = String(req.headers.estoreid);
  const DB_PATH = path.join(
    __dirname,
    "product-db",
    "product-db-" + estoreid + ".json"
  );
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));

  try {
    if (!session) return res.status(500).json({ error: "Model not ready" });
    if (!req.file) return res.status(400).json({ error: "No photo uploaded" });
    if (!index[estoreid])
      return res
        .status(500)
        .json({ error: "Index not loaded. Build the index first." });

    const feeds = await makeFeedsForSession(session, req.file.buffer, 224);
    const outputs = await session.run(feeds);

    const outKeys = Object.keys(outputs);
    const embKey =
      outKeys.find((k) =>
        /image_emb|image_embed|image_embeds|image_embed/i.test(k)
      ) ||
      outKeys.find((k) => /emb|embed|last_hidden_state/i.test(k)) ||
      outKeys[0];
    const embTensor = outputs[embKey];
    if (!embTensor)
      return res
        .status(500)
        .json({ error: "Embedding not found in model outputs" });

    const embData = embTensor.data;
    let norm = 0;
    for (let i = 0; i < embData.length; i++) norm += embData[i] * embData[i];
    norm = Math.sqrt(norm) || 1.0;
    const qvec = new Float32Array(embData.length);
    for (let i = 0; i < embData.length; i++) qvec[i] = embData[i] / norm;

    const requestedK = Math.max(1, parseInt(req.body.k || "5", 10));
    indexMaxElements[estoreid] = Math.max(
      indexMaxElements[estoreid],
      getIndexMaxElements(index[estoreid], db.length)
    );
    const kFinal = Math.max(
      1,
      Math.min(requestedK, indexMaxElements[estoreid] || 1)
    );
    const queryVec = Array.from(qvec);
    const result = index[estoreid].searchKnn(queryVec, kFinal);
    const neighbors = result.neighbors || [];
    const distances = result.distances || [];
    const idToProduct = {};
    for (const p of db)
      if (typeof p.vectorIndex === "number") idToProduct[p.vectorIndex] = p;

    const matches = neighbors.slice(0, 1).map((nid, i) => {
      const product = idToProduct[nid] || db[nid] || null;
      return { product, score: distances[i] ?? null };
    });

    return res.json({
      results: matches,
      meta: {
        requestedK,
        kFinal,
        indexMaxElements: indexMaxElements[estoreid] || 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
