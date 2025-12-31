const express = require("express");
const router = express.Router();

const { migrateImage } = require("../controllers/migrate");

router.post("/gratis/migrate", migrateImage);

module.exports = router;
