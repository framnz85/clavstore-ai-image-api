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
const Package = require("../models/package");

async function creatingFolders(resellid, estoreid) {
  const baseDir = path.resolve(__dirname, "product-images");
  const packageDir = path.join(baseDir, `package${resellid}`);
  const estoreDir = path.join(packageDir, `estore${estoreid}`);
  let typePathDir = "";

  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  if (!fs.existsSync(packageDir)) fs.mkdirSync(packageDir, { recursive: true });
  if (!fs.existsSync(estoreDir)) fs.mkdirSync(estoreDir, { recursive: true });

  typePathDir = path.join(estoreDir, "products");
  if (!fs.existsSync(typePathDir))
    fs.mkdirSync(typePathDir, { recursive: true });

  typePathDir = path.join(estoreDir, "ratings");
  if (!fs.existsSync(typePathDir))
    fs.mkdirSync(typePathDir, { recursive: true });

  typePathDir = path.join(estoreDir, "settings");
  if (!fs.existsSync(typePathDir))
    fs.mkdirSync(typePathDir, { recursive: true });

  typePathDir = path.join(estoreDir, "users");
  if (!fs.existsSync(typePathDir))
    fs.mkdirSync(typePathDir, { recursive: true });

  typePathDir = path.join(estoreDir, "brands");
  if (!fs.existsSync(typePathDir))
    fs.mkdirSync(typePathDir, { recursive: true });

  typePathDir = path.join(estoreDir, "categories");
  if (!fs.existsSync(typePathDir))
    fs.mkdirSync(typePathDir, { recursive: true });

  typePathDir = path.join(estoreDir, "payments");
  if (!fs.existsSync(typePathDir))
    fs.mkdirSync(typePathDir, { recursive: true });
}

async function getBufferFromOldPath(
  maybePathOrBuffer,
  resellid,
  estoreid,
  typePath
) {
  if (Buffer.isBuffer(maybePathOrBuffer)) return maybePathOrBuffer;

  if (typeof maybePathOrBuffer === "string") {
    const str = maybePathOrBuffer.trim();

    const baseDir = path.resolve(__dirname, "product-images");
    const packageDir = path.join(baseDir, `package${resellid}`);
    const estoreDir = path.join(packageDir, `estore${estoreid}`);
    const typePathDir = path.join(estoreDir, typePath);

    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
    if (!fs.existsSync(packageDir))
      fs.mkdirSync(packageDir, { recursive: true });
    if (!fs.existsSync(estoreDir)) fs.mkdirSync(estoreDir, { recursive: true });
    if (!fs.existsSync(typePathDir))
      fs.mkdirSync(typePathDir, { recursive: true });

    if (!fs.existsSync(typePathDir + "/" + str)) {
      const BASE_IMG_URL =
        typePath === "ratings"
          ? process.env.CLAVMALL_IMAGE_SERVER +
            "/dedicated/package_images/package" +
            resellid +
            "/ratings/"
          : process.env.CLAVMALL_IMAGE_SERVER +
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
          fs.writeFileSync(typePathDir + "/" + str, buf);
        } catch (e) {}
        return buf;
      } catch (e) {}
    }
  }
}

const migrateExecute = async (resellid, estoreid) => {
  const estore = await Estore(resellid).findOne({
    _id: new ObjectId(estoreid),
    "images.0": { $exists: true },
  });

  if (estore && estore.logo && estore.logo.public_id) {
    await getBufferFromOldPath(estore.logo.url, resellid, estoreid, "settings");
  }

  if (estore && estore.image && estore.image.public_id) {
    await getBufferFromOldPath(
      estore.image.url,
      resellid,
      estoreid,
      "settings"
    );
  }

  if (estore && estore.images && estore.images.length > 0) {
    for (const image of estore.images) {
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

  const users = await User(resellid)
    .find({ estoreid: new ObjectId(estoreid), "images.0": { $exists: true } })
    .select("_id images")
    .exec();

  for (const user of users) {
    if (user && user.image && user.image.public_id) {
      await getBufferFromOldPath(user.image.url, resellid, estoreid, "users");
    }
  }

  const packages = await Package(resellid)
    .find({ "images.0": { $exists: true } })
    .select("_id images")
    .exec();

  for (const package of packages) {
    if (package && package.images && package.images.length > 0) {
      for (const image of package.images) {
        await getBufferFromOldPath(image.url, resellid, estoreid, "settings");
      }
    }
  }
};

exports.migrateImage = async (req, res) => {
  const resellid = req.body.resellid;
  const skipTo = req.body.skipTo;
  const maxCount = req.body.maxCount;

  const estores = await Estore(resellid)
    .find({
      $or: [
        { upgradeType: "1", upStatus: "Active" },
        { upgradeType: "2", upStatus2: "Active" },
      ],
    })
    .skip(skipTo)
    .limit(maxCount);

  for (const estore of estores) {
    await creatingFolders(resellid, estore._id);
    await migrateExecute(resellid, estore._id);
  }

  const estoreCount = await Estore(resellid).countDocuments({
    $or: [
      { upgradeType: "1", upStatus: "Active" },
      { upgradeType: "2", upStatus2: "Active" },
    ],
  });

  res.json({ ok: true, skipTo, total: estoreCount });
};

exports.migrateImageByStore = async (req, res) => {
  const resellid = req.body.resellid;
  const estoreid = req.body.estoreid;

  await creatingFolders(resellid, estoreid);
  await migrateExecute(resellid, estoreid);

  res.json({ ok: true });
};
