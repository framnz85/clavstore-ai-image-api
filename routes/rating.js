const express = require("express");
const router = express.Router();

const { authCheck, adminGratisCheck } = require("../middlewares/auth");
const { addImage, removeImage } = require("../controllers/rating");

router.post("/gratis/rating/add-image", authCheck, adminGratisCheck, addImage);
router.delete(
  "/gratis/rating/remove-image/:public_id",
  authCheck,
  adminGratisCheck,
  removeImage
);

module.exports = router;
