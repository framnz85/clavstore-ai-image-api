const express = require("express");
const router = express.Router();

const { authCheck, adminGratisCheck } = require("../middlewares/auth");
const { addImage, removeImage } = require("../controllers/brand");

router.post("/gratis/brand/add-image", authCheck, adminGratisCheck, addImage);
router.delete(
  "/gratis/brand/remove-image/:public_id",
  authCheck,
  adminGratisCheck,
  removeImage
);

module.exports = router;
