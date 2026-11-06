const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema;
const conn = require("../dbconnect/reseller");

const paymentSchema = new mongoose.Schema(
  {
    estoreid: ObjectId,
    bankName: String,
    accName: String,
    accNumber: String,
    accDetails: String,
    msgLink: String,
    buttonText: String,
    images: Array,
    purpose: {
      type: String,
      enum: ["basic", "single", "multiple", "dedicated"],
      default: "basic",
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Payment = (estoreid) =>
  conn[estoreid].model("GratisPayment", paymentSchema);

module.exports = Payment;
