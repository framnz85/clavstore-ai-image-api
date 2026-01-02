const express = require("express");
const path = require("path");
const cors = require("cors");
const { readdirSync } = require("fs");
require("dotenv").config();

const app = express();

app.set("trust proxy", true);

if (process.env.NODE_ENV !== "production") {
  const morgan = require("morgan");
  app.use(morgan("dev"));
}

app.use(express.json({ limit: "2mb" }));
app.use(cors());

readdirSync("./routes").map((file) =>
  app.use("/" + process.env.API_ROUTES, require("./routes/" + file))
);

app.use(
  "/images",
  express.static(path.join(__dirname, "controllers", "product-images"))
);

app.use(
  "/images/static",
  express.static(
    path.join(__dirname, "controllers", "product-images", "static")
  )
);

const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Server is running on port ${port}`));
