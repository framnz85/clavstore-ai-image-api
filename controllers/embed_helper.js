const sharp = require("sharp");
const ort = require("onnxruntime-node");
const fs = require("fs");
const path = require("path");

const CACHE_ROOT = path.join(__dirname, "product-images");
const SOURCE_DIR = path.join(__dirname, "static");
const DEST_DIR = path.join(__dirname, "product-images", "static");

(async () => {
  try {
    if (!fs.existsSync(CACHE_ROOT))
      fs.mkdirSync(CACHE_ROOT, { recursive: true });
    if (fs.existsSync(DEST_DIR)) {
      fs.rmSync(DEST_DIR, { recursive: true, force: true });
      fs.mkdirSync(DEST_DIR, { recursive: true });
    } else {
      fs.mkdirSync(DEST_DIR, { recursive: true });
    }
    fs.cpSync(SOURCE_DIR, DEST_DIR, { recursive: true });
  } catch (e) {}
})();

async function imageBufferToTensor(buffer, size = 224) {
  const { data, info } = await sharp(buffer)
    .resize(size, size, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels !== 3) throw new Error("Expected 3 channels (RGB)");

  const hw = width * height;

  const chw = new Float32Array(3 * hw);
  let idx = 0;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i] / 255.0;
    const g = data[i + 1] / 255.0;
    const b = data[i + 2] / 255.0;
    chw[idx] = r; // channel 0
    chw[hw + idx] = g; // channel 1
    chw[hw * 2 + idx] = b; // channel 2
    idx++;
  }

  return new ort.Tensor("float32", chw, [1, 3, height, width]);
}

function makeDummyTextFeed(name, meta) {
  const fallbackSeqLen = 77;
  let shape = [1, fallbackSeqLen];
  if (meta && Array.isArray(meta.dimensions) && meta.dimensions.length > 0) {
    shape = meta.dimensions.map((d, i) =>
      typeof d === "number" && d > 0 ? d : i === 0 ? 1 : fallbackSeqLen
    );
  }
  const len = shape.reduce((a, b) => a * b, 1);
  const fillVal = name.toLowerCase().includes("attention") ? 1n : 0n;
  const arr = new BigInt64Array(len);
  for (let i = 0; i < len; i++) arr[i] = fillVal;
  return new ort.Tensor("int64", arr, shape);
}

async function makeFeedsForSession(session, imageBuffer, size = 224) {
  const inputNames = Array.isArray(session.inputNames)
    ? session.inputNames
    : [];
  const inputMeta = session.inputMetadata || {};

  let imageInputName = inputNames.find((n) =>
    /pixel|image|img|input.1|input_1/i.test(n)
  );
  if (!imageInputName) {
    for (const n of inputNames) {
      const meta = inputMeta[n];
      if (
        meta &&
        meta.type &&
        String(meta.type).toLowerCase().includes("float") &&
        Array.isArray(meta.dimensions) &&
        meta.dimensions.length === 4
      ) {
        imageInputName = n;
        break;
      }
    }
  }
  if (!imageInputName) {
    if (inputNames.includes("pixel_values")) imageInputName = "pixel_values";
    else if (inputNames.length >= 2) imageInputName = inputNames[1];
    else imageInputName = inputNames[0];
  }

  const feeds = {};
  const imgTensor = await imageBufferToTensor(imageBuffer, size);
  feeds[imageInputName] = imgTensor;

  for (const name of inputNames) {
    if (name in feeds) continue;
    const meta = inputMeta[name];
    if (
      !meta ||
      String(meta.type).toLowerCase().includes("int") ||
      name.toLowerCase().includes("input") ||
      name.toLowerCase().includes("attention")
    ) {
      feeds[name] = makeDummyTextFeed(name, meta);
    } else if (meta && String(meta.type).toLowerCase().includes("float")) {
      const dims = (meta.dimensions &&
        meta.dimensions.map((d) =>
          typeof d === "number" && d > 0 ? d : 1
        )) || [1, 1];
      const len = dims.reduce((a, b) => a * b, 1);
      feeds[name] = new ort.Tensor("float32", new Float32Array(len), dims);
    } else {
      feeds[name] = makeDummyTextFeed(name, meta);
    }
  }

  return feeds;
}

async function getBufferFromPathOrBuffer(maybePathOrBuffer) {
  if (Buffer.isBuffer(maybePathOrBuffer)) return maybePathOrBuffer;

  if (typeof maybePathOrBuffer !== "string")
    throw new Error("image must be a Buffer or path string");

  const str = maybePathOrBuffer.trim();

  const alt = CACHE_ROOT + "/" + str;
  if (fs.existsSync(alt)) return fs.readFileSync(alt);
}

module.exports = { makeFeedsForSession, getBufferFromPathOrBuffer };
