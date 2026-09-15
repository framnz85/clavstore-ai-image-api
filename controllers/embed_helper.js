const sharp = require("sharp");
const ort = require("onnxruntime-node");
const fs = require("fs");
const path = require("path");

const CACHE_ROOT = path.join(__dirname, "product-images");
const SOURCE_DIR = path.join(__dirname, "static");
const DEST_DIR = path.join(CACHE_ROOT, "static");

/*
 * CLIP ViT-B/32 preprocessing
 *
 * These are the standard CLIP normalization values.
 *
 * Pixel values:
 *   0 - 255
 *        ↓
 *   0.0 - 1.0
 *        ↓
 *   (pixel - mean) / std
 */
const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073];

const CLIP_STD = [0.26862954, 0.26130258, 0.27577711];

const DEFAULT_IMAGE_SIZE = 224;
const DEFAULT_TEXT_SEQUENCE_LENGTH = 77;

/*
 * Initialize image cache directories.
 *
 * This preserves the behavior of your original helper.
 */
(async () => {
  try {
    if (!fs.existsSync(CACHE_ROOT)) {
      fs.mkdirSync(CACHE_ROOT, {
        recursive: true,
      });
    }

    if (fs.existsSync(DEST_DIR)) {
      fs.rmSync(DEST_DIR, {
        recursive: true,
        force: true,
      });

      fs.mkdirSync(DEST_DIR, {
        recursive: true,
      });
    } else {
      fs.mkdirSync(DEST_DIR, {
        recursive: true,
      });
    }

    if (fs.existsSync(SOURCE_DIR)) {
      fs.cpSync(SOURCE_DIR, DEST_DIR, {
        recursive: true,
      });
    }
  } catch (error) {
    console.error(
      "[embed_helper] Failed to initialize image cache:",
      error.message,
    );
  }
})();

/**
 * Convert an image buffer into the tensor expected by CLIP.
 *
 * Processing:
 *
 *   image
 *     ↓
 *   resize while preserving aspect ratio
 *     ↓
 *   center crop
 *     ↓
 *   RGB
 *     ↓
 *   0-1
 *     ↓
 *   CLIP mean/std normalization
 *     ↓
 *   HWC → CHW
 *     ↓
 *   Float32 tensor [1, 3, 224, 224]
 */
async function imageBufferToTensor(buffer, size = DEFAULT_IMAGE_SIZE) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("imageBufferToTensor expects a Buffer");
  }

  const { data, info } = await sharp(buffer)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
    })
    .removeAlpha()
    .raw()
    .toBuffer({
      resolveWithObject: true,
    });

  const { width, height, channels } = info;

  if (channels !== 3) {
    throw new Error(`Expected RGB image with 3 channels, got ${channels}`);
  }

  const pixelCount = width * height;

  /*
   * ONNX model expects:
   *
   * [1, 3, height, width]
   *
   * Therefore the data must be stored as:
   *
   * RRRRR...
   * GGGGG...
   * BBBBB...
   */
  const chw = new Float32Array(3 * pixelCount);

  for (let pixel = 0; pixel < pixelCount; pixel++) {
    const sourceIndex = pixel * 3;

    const r = data[sourceIndex] / 255.0;

    const g = data[sourceIndex + 1] / 255.0;

    const b = data[sourceIndex + 2] / 255.0;

    /*
     * CLIP normalization
     */
    chw[pixel] = (r - CLIP_MEAN[0]) / CLIP_STD[0];

    chw[pixelCount + pixel] = (g - CLIP_MEAN[1]) / CLIP_STD[1];

    chw[pixelCount * 2 + pixel] = (b - CLIP_MEAN[2]) / CLIP_STD[2];
  }

  return new ort.Tensor("float32", chw, [1, 3, height, width]);
}

/**
 * Get a dimension from ONNX metadata.
 *
 * Dynamic dimensions may be strings such as:
 *
 *   "text_batch_size"
 *   "sequence_length"
 *
 * For those we use the fallback value.
 */
function getDimension(dimension, index, fallbackSequenceLength) {
  if (typeof dimension === "number" && dimension > 0) {
    return dimension;
  }

  /*
   * Batch dimension
   */
  if (index === 0) {
    return 1;
  }

  /*
   * Sequence length
   */
  return fallbackSequenceLength;
}

/**
 * Create dummy text input.
 *
 * Your current ONNX model is a FULL CLIP model.
 *
 * It requires:
 *
 *   input_ids
 *   pixel_values
 *   attention_mask
 *
 * We only need the image embedding, so the text inputs
 * are placeholders.
 *
 * NOTE:
 * This is temporary. The better final architecture
 * is an image-only ONNX model.
 */
function makeDummyTextFeed(name, meta) {
  const dimensions =
    meta && Array.isArray(meta.dimensions) ? meta.dimensions : null;

  const shape =
    dimensions && dimensions.length > 0
      ? dimensions.map((dimension, index) =>
          getDimension(dimension, index, DEFAULT_TEXT_SEQUENCE_LENGTH),
        )
      : [1, DEFAULT_TEXT_SEQUENCE_LENGTH];

  const length = shape.reduce((total, value) => total * value, 1);

  const lowerName = String(name).toLowerCase();

  /*
   * attention_mask:
   *
   * 1 = valid token
   */
  const isAttentionMask = lowerName.includes("attention");

  const values = new BigInt64Array(length);

  if (isAttentionMask) {
    values.fill(1n);
  } else {
    /*
     * input_ids
     *
     * 0 is used as the placeholder token.
     */
    values.fill(0n);
  }

  return new ort.Tensor("int64", values, shape);
}

/**
 * Find the image input name.
 *
 * For your current model this should resolve to:
 *
 *   pixel_values
 */
function findImageInputName(inputNames, inputMetadata) {
  /*
   * First try the known CLIP input name.
   */
  if (inputNames.includes("pixel_values")) {
    return "pixel_values";
  }

  /*
   * Fallback for differently named models.
   */
  const byName = inputNames.find((name) => /pixel|image|img/i.test(name));

  if (byName) {
    return byName;
  }

  /*
   * Fallback based on tensor metadata.
   */
  for (const name of inputNames) {
    const meta = inputMetadata[name];

    if (!meta) continue;

    const type = String(meta.type || "").toLowerCase();

    const dimensions = meta.dimensions;

    if (
      type.includes("float") &&
      Array.isArray(dimensions) &&
      dimensions.length === 4
    ) {
      return name;
    }
  }

  /*
   * Last fallback.
   */
  if (inputNames.length >= 2) {
    return inputNames[1];
  }

  return inputNames[0];
}

/**
 * Build ONNX Runtime feeds.
 *
 * Current CLIP model inputs:
 *
 *   input_ids
 *   pixel_values
 *   attention_mask
 */
async function makeFeedsForSession(
  session,
  imageBuffer,
  size = DEFAULT_IMAGE_SIZE,
) {
  if (!session) {
    throw new Error("ONNX session is not initialized");
  }

  if (!Buffer.isBuffer(imageBuffer)) {
    throw new Error("imageBuffer must be a Buffer");
  }

  const inputNames = Array.isArray(session.inputNames)
    ? session.inputNames
    : [];

  if (inputNames.length === 0) {
    throw new Error("ONNX session has no input names");
  }

  const inputMetadata = session.inputMetadata || {};

  const imageInputName = findImageInputName(inputNames, inputMetadata);

  if (!imageInputName) {
    throw new Error("Could not determine image input name");
  }

  /*
   * Convert camera image → CLIP tensor.
   */
  const imageTensor = await imageBufferToTensor(imageBuffer, size);

  const feeds = {};

  /*
   * Add image.
   */
  feeds[imageInputName] = imageTensor;

  /*
   * Add the remaining required inputs.
   *
   * For the current CLIP model these
   * are the text inputs.
   */
  for (const name of inputNames) {
    if (name in feeds) {
      continue;
    }

    const meta = inputMetadata[name];

    const lowerName = String(name).toLowerCase();

    /*
     * Current CLIP text inputs.
     */
    if (lowerName.includes("input_ids") || lowerName.includes("attention")) {
      feeds[name] = makeDummyTextFeed(name, meta);

      continue;
    }

    /*
     * Generic fallback for integer inputs.
     */
    if (
      meta &&
      String(meta.type || "")
        .toLowerCase()
        .includes("int")
    ) {
      feeds[name] = makeDummyTextFeed(name, meta);

      continue;
    }

    /*
     * Generic float fallback.
     */
    if (
      meta &&
      String(meta.type || "")
        .toLowerCase()
        .includes("float")
    ) {
      const dimensions = Array.isArray(meta.dimensions)
        ? meta.dimensions.map((dimension) =>
            typeof dimension === "number" && dimension > 0 ? dimension : 1,
          )
        : [1, 1];

      const length = dimensions.reduce((total, value) => total * value, 1);

      feeds[name] = new ort.Tensor(
        "float32",
        new Float32Array(length),
        dimensions,
      );

      continue;
    }

    /*
     * Final fallback.
     */
    feeds[name] = makeDummyTextFeed(name, meta);
  }

  return feeds;
}

/**
 * Get image data from either:
 *
 *   Buffer
 *
 * or
 *
 *   cached file path
 */
async function getBufferFromPathOrBuffer(maybePathOrBuffer) {
  if (Buffer.isBuffer(maybePathOrBuffer)) {
    return maybePathOrBuffer;
  }

  if (typeof maybePathOrBuffer !== "string") {
    throw new Error("image must be a Buffer or path string");
  }

  const str = maybePathOrBuffer.trim();

  if (!str) {
    throw new Error("image path is empty");
  }

  /*
   * Prevent accidental absolute-path
   * handling outside the cache directory.
   */
  const relativePath = str.replace(/^[/\\]+/, "");

  const filePath = path.join(CACHE_ROOT, relativePath);

  /*
   * Make sure the resolved path remains
   * inside CACHE_ROOT.
   */
  const normalizedRoot = path.resolve(CACHE_ROOT);

  const normalizedFile = path.resolve(filePath);

  if (!normalizedFile.startsWith(normalizedRoot + path.sep)) {
    throw new Error("Invalid image path");
  }

  if (!fs.existsSync(normalizedFile)) {
    throw new Error(`Image not found: ${str}`);
  }

  return fs.readFileSync(normalizedFile);
}

module.exports = {
  makeFeedsForSession,
  getBufferFromPathOrBuffer,
  imageBufferToTensor,
};
