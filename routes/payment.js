const express = require("express");
const router = express.Router();

const { authCheck, adminGratisCheck } = require("../middlewares/auth");
const { addImage, removeImage } = require("../controllers/payment");

router.post("/gratis/payment/add-image", authCheck, adminGratisCheck, addImage);
router.delete(
  "/gratis/payment/remove-image/:public_id",
  authCheck,
  adminGratisCheck,
  removeImage
);

module.exports = router;
