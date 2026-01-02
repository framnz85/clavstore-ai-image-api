const express = require("express");
const router = express.Router();

const { migrateImage, migrateImageByStore } = require("../controllers/migrate");

router.post("/gratis/migrate", migrateImage);
router.post("/gratis/migrate-by-store", migrateImageByStore);

module.exports = router;
