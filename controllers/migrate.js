const ObjectId = require("mongoose").Types.ObjectId;
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const Estore = require("../models/estore");
const Product = require("../models/product");
const Category = require("../models/category");
const Brand = require("../models/brand");

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
    typePath
  );

  if (!fs.existsSync(alt)) fs.mkdirSync(alt, { recursive: true });

  if (!fs.existsSync(alt + "/" + str)) {
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
        fs.writeFileSync(alt + "/" + str, buf);
      } catch (e) {}
      return buf;
    } catch (e) {}
  }
}

exports.migrateImage = async (req, res) => {
  const estoreid = req.body.estoreid;
  const resellid = req.body.resellid;

  const estores = await Estore(resellid).findOne({
    _id: new ObjectId(estoreid),
    "images.0": { $exists: true },
  });

  if (estores && estores.logo && estores.logo.public_id) {
    await getBufferFromOldPath(
      estores.logo.url,
      resellid,
      estoreid,
      "settings"
    );
  }

  for (const image of estores.images) {
    await getBufferFromOldPath(image.url, resellid, estoreid, "settings");
  }

  const products = await Product(resellid)
    .find({ estoreid: new ObjectId(estoreid), "images.0": { $exists: true } })
    .select("_id images")
    .exec();

  for (const product of products) {
    for (const image of product.images) {
      await getBufferFromOldPath(image.url, resellid, estoreid, "products");
    }
  }

  const categories = await Category(resellid)
    .find({ estoreid: new ObjectId(estoreid), "images.0": { $exists: true } })
    .select("_id images")
    .exec();

  for (const category of categories) {
    for (const image of category.images) {
      await getBufferFromOldPath(image.url, resellid, estoreid, "categories");
    }
  }

  const brands = await Brand(resellid)
    .find({ estoreid: new ObjectId(estoreid), "images.0": { $exists: true } })
    .select("_id images")
    .exec();

  for (const brand of brands) {
    for (const image of brand.images) {
      await getBufferFromOldPath(image.url, resellid, estoreid, "brands");
    }
  }

  res.json({ ok: true });
};
