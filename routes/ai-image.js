const express = require("express");
const router = express.Router();
const multer = require("multer");

const { searchProduct } = require("../controllers/ai-image");
const { buildIndex } = require("../controllers/index-builder");

const upload = multer({ storage: multer.memoryStorage() });

router.get("/gratis/ai-image/build", buildIndex);
router.post("/gratis/ai-image/search", upload.single("photo"), searchProduct);

module.exports = router;
