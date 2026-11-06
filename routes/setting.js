const express = require("express");
const router = express.Router();

const { authCheck, adminGratisCheck } = require("../middlewares/auth");
const { addImage, removeImage } = require("../controllers/setting");

router.post("/gratis/setting/add-image", authCheck, adminGratisCheck, addImage);
router.delete(
  "/gratis/setting/remove-image/:public_id",
  authCheck,
  adminGratisCheck,
  removeImage
);

module.exports = router;
