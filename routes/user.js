const express = require("express");
const router = express.Router();

const { authCheck, adminGratisCheck } = require("../middlewares/auth");
const { addImage, removeImage } = require("../controllers/user");

router.post("/gratis/user/add-image", authCheck, adminGratisCheck, addImage);
router.delete(
  "/gratis/user/remove-image/:public_id",
  authCheck,
  adminGratisCheck,
  removeImage
);

module.exports = router;
