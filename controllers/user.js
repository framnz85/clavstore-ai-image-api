const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

async function uploadFromBase64(imageString, estoreid, resellid, options = {}) {
  if (!imageString) {
    throw new Error("No image provided in request body");
  }

  const dataUriMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(
    imageString
  );

  const base64 = dataUriMatch ? dataUriMatch[2] : imageString;
  const inputBuffer = Buffer.from(base64, "base64");

  const MAX_BYTES = options.maxBytes || 5 * 1024 * 1024;
  if (inputBuffer.length > MAX_BYTES) {
    throw new Error("Image too large");
  }

  const uniqueId = `${crypto.randomBytes(12).toString("hex")}.${Math.floor(
    Date.now() / 1000
  )}`;

  const filename = `image${uniqueId}.jpg`;

  const uploadsDir = path.resolve(
    __dirname,
    "product-images",
    "package" + resellid,
    "estore" + estoreid,
    "users"
  );

  await fs.mkdir(uploadsDir, { recursive: true });

  const filePath = path.join(uploadsDir, filename);

  await sharp(inputBuffer)
    .rotate()
    .resize({
      width: options.maxWidth || 1024,
      withoutEnlargement: true,
    })
    .jpeg({
      quality: options.quality || 70,
      chromaSubsampling: "4:2:0",
      mozjpeg: true,
    })
    .toFile(filePath);

  return {
    public_id: uniqueId,
    url: filename,
  };
}

async function deleteImage(public_id, estoreid, resellid) {
  if (!public_id) return { err: "public_id is required" };
  if (!estoreid) return { err: "estoreid is required" };
  if (!resellid) return { err: "resellid is required" };

  const uploadsDir = path.resolve(
    __dirname,
    "product-images",
    "package" + String(resellid),
    "estore" + String(estoreid),
    "users"
  );

  try {
    const stat = await fs.stat(uploadsDir);
    if (!stat.isDirectory())
      return { err: "Uploads path is not a directory", noexist: true };
  } catch (err) {
    return { err: "Uploads directory not found", noexist: true };
  }

  const files = await fs.readdir(uploadsDir);
  const matches = files.filter((f) => f.includes("image" + public_id + ".jpg"));

  if (matches.length === 0) {
    return { err: "Image does not exist", noexist: true };
  } else {
    const deleted = [];

    for (const file of matches) {
      const p = path.join(uploadsDir, file);
      await fs.unlink(p);
      deleted.push(p);
    }

    return { ok: true };
  }
}

exports.addImage = async (req, res) => {
  const estoreid = req.headers.estoreid?.toString().trim();
  const resellid = req.headers.resellid?.toString().trim();
  const image = req.body.image;

  try {
    const result = await uploadFromBase64(image, estoreid, resellid);
    res.json(result);
  } catch (error) {
    res.json({ err: "Adding image failed." + error.message });
  }
};

exports.removeImage = async (req, res) => {
  const public_id = req.params.public_id;
  const estoreid = req.headers.estoreid?.toString().trim();
  const resellid = req.headers.resellid?.toString().trim();

  try {
    const result = await deleteImage(public_id, estoreid, resellid);
    res.json(result);
  } catch (error) {
    res.json({ err: "Removing image failed." + error.message });
  }
};
