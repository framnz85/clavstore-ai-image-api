const ObjectId = require("mongoose").Types.ObjectId;
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const Estore = require("../models/estore");
const Product = require("../models/product");
const Category = require("../models/category");
const Brand = require("../models/brand");
const Rating = require("../models/rating");
const Payment = require("../models/payment");
const User = require("../models/user");

async function getBufferFromOldPath(
  maybePathOrBuffer,
  resellid,
  estoreid,
  typePath
) {
  if (Buffer.isBuffer(maybePathOrBuffer)) return maybePathOrBuffer;

  if (typeof maybePathOrBuffer === "string") {
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
}

const migrateExecute = async (resellid, estoreid) => {
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

  if (estores && estores.images && estores.images.length > 0) {
    for (const image of estores.images) {
      await getBufferFromOldPath(image.url, resellid, estoreid, "settings");
    }
  }

  const products = await Product(resellid)
    .find({ estoreid: new ObjectId(estoreid), "images.0": { $exists: true } })
    .select("_id images")
    .exec();

  for (const product of products) {
    if (product && product.images && product.images.length > 0) {
      for (const image of product.images) {
        await getBufferFromOldPath(image.url, resellid, estoreid, "products");
      }
    }
  }

  const categories = await Category(resellid)
    .find({ estoreid: new ObjectId(estoreid), "images.0": { $exists: true } })
    .select("_id images")
    .exec();

  for (const category of categories) {
    if (category && category.images && category.images.length > 0) {
      for (const image of category.images) {
        await getBufferFromOldPath(image.url, resellid, estoreid, "categories");
      }
    }
  }

  const brands = await Brand(resellid)
    .find({ estoreid: new ObjectId(estoreid), "images.0": { $exists: true } })
    .select("_id images")
    .exec();

  for (const brand of brands) {
    if (brand && brand.images && brand.images.length > 0) {
      for (const image of brand.images) {
        await getBufferFromOldPath(image.url, resellid, estoreid, "brands");
      }
    }
  }

  const ratings = await Rating(resellid)
    .find({ estoreid: new ObjectId(estoreid), "images.0": { $exists: true } })
    .select("_id images")
    .exec();

  for (const rating of ratings) {
    if (rating && rating.images && rating.images.length > 0) {
      for (const image of rating.images) {
        await getBufferFromOldPath(image.url, resellid, estoreid, "ratings");
      }
    }
  }

  const payments = await Payment(resellid)
    .find({ estoreid: new ObjectId(estoreid), "images.0": { $exists: true } })
    .select("_id images")
    .exec();

  for (const payment of payments) {
    if (payment && payment.images && payment.images.length > 0) {
      for (const image of payment.images) {
        await getBufferFromOldPath(image.url, resellid, estoreid, "payments");
      }
    }
  }

  const users = await Payment(resellid)
    .find({ estoreid: new ObjectId(estoreid), "images.0": { $exists: true } })
    .select("_id images")
    .exec();

  for (const user of users) {
    if (user && user.image && user.image.public_id) {
      await getBufferFromOldPath(user.image.url, resellid, estoreid, "users");
    }
  }
};

exports.migrateImage = async (req, res) => {
  const resellid = req.body.resellid;
  const skipTo = req.body.skipTo;
  const maxCount = req.body.maxCount;

  const estores = await Estore(resellid)
    .find({
      upgradeType: "1",
      upStatus: "Active",
    })
    .skip(skipTo)
    .limit(maxCount);

  for (const estore of estores) {
    await migrateExecute(resellid, estore._id);
  }

  const estoreCount = await Estore(resellid).countDocuments({
    upgradeType: "1",
    upStatus: "Active",
  });

  res.json({ ok: true, skipTo, total: estoreCount });
};
