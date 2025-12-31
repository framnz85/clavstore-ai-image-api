const ObjectId = require("mongoose").Types.ObjectId;
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const Product = require("../models/product");

const CACHE_ROOT = path.join(__dirname, "product-images");

if (!fs.existsSync(CACHE_ROOT)) fs.mkdirSync(CACHE_ROOT, { recursive: true });

async function getBufferFromOldPath(
  maybePathOrBuffer,
  resellid,
  estoreid,
  typePath
) {
  if (Buffer.isBuffer(maybePathOrBuffer)) return maybePathOrBuffer;

  if (typeof maybePathOrBuffer !== "string")
    throw new Error("image must be a Buffer or path string");

  const str = maybePathOrBuffer.trim();

  const alt = path.join(
    __dirname,
    "product-images",
    "package" + resellid,
    "estore" + estoreid,
    typePath,
    str
  );

  if (!fs.existsSync(alt)) {
    const BASE_IMG_URL =
      process.env.CLAVMALL_IMAGE_SERVER +
      "/dedicated/package_images/package" +
      resellid +
      "/";
    const fileName = path.basename(str);
    const remoteUrl = new URL(fileName, BASE_IMG_URL).href;

    try {
      const resp = await axios.get(remoteUrl, {
        responseType: "arraybuffer",
        timeout: 20000,
      });
      const buf = Buffer.from(resp.data);
      try {
        fs.writeFileSync(alt, buf);
      } catch (e) {}
      return buf;
    } catch (err) {
      throw new Error(
        `Failed to fetch remote image ${remoteUrl}: ${err.message}`
      );
    }
  }
}

exports.migrateImage = async (req, res) => {
  const estoreid = req.body.estoreid;
  const resellid = req.body.resellid;

  const products = await Product(resellid)
    .find({ estoreid: new ObjectId(estoreid), "images.0": { $exists: true } })
    .select("_id images")
    .exec();

  for (const product of products) {
    for (const image of product.images) {
      await getBufferFromOldPath(image.url, resellid, estoreid, "products");
    }
  }

  res.json({ ok: true });
};
