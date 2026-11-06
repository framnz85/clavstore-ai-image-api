const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema;
const conn = require("../dbconnect/reseller");
const Estore = require("../models/estore");

const userSchema = new mongoose.Schema(
  {
    refid: ObjectId,
    refCommission: Number,
    estoreid: {
      type: ObjectId,
      ref: Estore,
    },
    estoreids: [
      {
        type: ObjectId,
      },
    ],
    image: Object,
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    emailConfirm: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      required: true,
    },
    showPass: String,
    picture: String,
    role: {
      type: String,
      default: "customer",
      enum: ["admin", "moderator", "cashier", "customer"],
    },
    address: {
      details: String,
      zipcode: String,
      country: {},
      addiv1: {},
      addiv2: {},
      addiv3: {},
    },
    homeAddress: {
      details: String,
      country: {},
      addiv1: {},
      addiv2: {},
      addiv3: {},
    },
    addInstruct: String,
    verifyCode: String,
    nextSteps: {
      type: Number,
      default: 0,
    },
    endPoint: [],
    dayNotify: {
      type: Number,
      default: 0,
    },
    adsArray: Array,
    superAdmin: Boolean,
    resellid: ObjectId,
    deleteAccount: { request: Boolean, reasons: Array },
    wishlist: [{ type: ObjectId, ref: "Product" }],
    changeStore: { type: Boolean, default: false },
    wholesale: { type: Boolean, default: true },
    allowServerBusy: { type: Boolean, default: true },
    server: {
      type: String,
      default: "server1",
      enum: ["server1", "server2", "server3", "server4", "server5"],
    },
  },
  { timestamps: true }
);

userSchema.index(
  {
    name: "text",
    email: "text",
    phone: "text",
    address: "text",
  },
  {
    weights: {
      name: 5,
      email: 3,
      phone: 2,
      address: 1,
    },
  }
);

const User = (estoreid) => conn[estoreid].model("GratisUser", userSchema);

module.exports = User;
