const mongoose = require("mongoose");
const conn = require("../dbconnect/reseller");

const ratingSchema = new mongoose.Schema(
  {
    userid: {
      type: Object,
      ref: "GratisUser",
      required: true,
    },
    prodid: {
      type: Object,
      required: true,
    },
    estoreid: {
      type: Object,
      required: true,
    },
    rate: {
      type: Number,
      required: true,
      default: 0,
    },
    images: {
      type: Array,
    },
    review: String,
  },
  { timestamps: true }
);

const Rating = (estoreid) => conn[estoreid].model("GratisRating", ratingSchema);

module.exports = Rating;
