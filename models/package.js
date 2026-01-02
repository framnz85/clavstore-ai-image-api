const mongoose = require("mongoose");
const conn = require("../dbconnect/reseller");

const packageSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    images: Array,
    defaultPackage: {
      type: String,
      enum: ["basic", "dedicated", "single"],
      default: "basic",
    },
    regularPrice: Number,
    promoPrice: Number,
    installmentPrice: Number,
    downPayment: Number,
    installTerm1: Number,
    installTerm3: Number,
    installTerm6: Number,
    installTerm12: Number,
    hostingFee: Number,
    hostingStart: Number,
    setupCommission: Number,
    hostingCommission: Number,
    groupChatLink: String,
    default: Boolean,
    allowGuide: { type: Boolean, default: true },
    trainTitle: String,
    allowTraining: Boolean,
    training: [
      {
        title: String,
        lessons: Array,
      },
    ],
  },
  { timestamps: true }
);

packageSchema.index({ name: "text" });

const Package = (estoreid) =>
  conn[estoreid].model("GratisPackage", packageSchema);

module.exports = Package;
