const express = require("express");
const router = express.Router();

const { authCheck, adminGratisCheck } = require("../middlewares/auth");
const { addImage, removeImage } = require("../controllers/job");

router.post("/gratis/job/add-image", authCheck, adminGratisCheck, addImage);
router.delete(
  "/gratis/job/remove-image/:public_id",
  authCheck,
  adminGratisCheck,
  removeImage,
);

module.exports = router;
