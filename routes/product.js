const express = require("express");
const router = express.Router();

const { authCheck, adminGratisCheck } = require("../middlewares/auth");
const { addImage, removeImage } = require("../controllers/product");

router.post("/gratis/product/add-image", authCheck, adminGratisCheck, addImage);
router.delete(
  "/gratis/product/remove-image/:public_id",
  authCheck,
  adminGratisCheck,
  removeImage
);

module.exports = router;
