const express = require("express");
const router = express.Router();

const { authCheck, adminGratisCheck } = require("../middlewares/auth");
const { addImage, removeImage } = require("../controllers/category");

router.post(
  "/gratis/category/add-image",
  authCheck,
  adminGratisCheck,
  addImage
);
router.delete(
  "/gratis/category/remove-image/:public_id",
  authCheck,
  adminGratisCheck,
  removeImage
);

module.exports = router;
