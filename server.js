const express = require("express");
const path = require("path");
const cors = require("cors");
const { readdirSync } = require("fs");
require("dotenv").config();

const origins = require("./assets/origins.json");

const app = express();

app.set("trust proxy", true);

if (process.env.NODE_ENV !== "production") {
  const morgan = require("morgan");
  app.use(morgan("dev"));
}

app.use(express.json({ limit: "2mb" }));

const allowedOrigins = [
  ...origins.origins1,
  ...origins.origins2,
  ...origins.origins3,
  ...origins.origins4,
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  }),
);

readdirSync("./routes").map((file) =>
  app.use("/" + process.env.API_ROUTES, require("./routes/" + file)),
);

app.use(
  "/images",
  express.static(path.join(__dirname, "controllers", "product-images")),
);

app.use(
  "/images/static",
  express.static(
    path.join(__dirname, "controllers", "product-images", "static"),
  ),
);

const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Server is running on port ${port}`));
