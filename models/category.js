const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema;
const conn = require("../dbconnect/reseller");

const categorySchema = new mongoose.Schema(
  {
    estoreid: ObjectId,
    name: {
      type: String,
      trim: true,
      required: true,
      minlength: 2,
      maxlength: 32,
    },
    slug: {
      type: String,
      lowercase: true,
      index: true,
    },
    cat_code: ObjectId,
    images: {
      type: Array,
    },
    activate: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Category = (estoreid) =>
  conn[estoreid].model("GratisCategory", categorySchema);

module.exports = Category;
