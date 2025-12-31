const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema;
const conn = require("../dbconnect/reseller");
const Country = require("./country");

const estoreSchema = new mongoose.Schema(
  {
    storeType: {
      type: String,
      default: "store",
      enum: ["store", "warehouse"],
    },
    name: {
      type: String,
      required: true,
    },
    email: String,
    image: Object,
    logo: Object,
    logoSetting: Object,
    images: {
      type: Array,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    status: {
      type: String,
      default: "active",
      enum: ["pending", "pause", "stop", "active"],
    },
    country: {
      type: ObjectId,
      ref: Country,
      required: true,
    },
    headerColor: { type: String, default: "#009A57" },
    carouselColor: String,
    showRandomItems: {
      type: Boolean,
      default: true,
    },
    showCategories: {
      type: Boolean,
      default: true,
    },
    showBestSeller: {
      type: Boolean,
      default: true,
    },
    showBrands: {
      type: Boolean,
      default: true,
    },
    showBrandsInMenu: {
      type: Boolean,
      default: true,
    },
    showItemsForYou: {
      type: Boolean,
      default: true,
    },
    orderChange: {
      type: Number,
      default: 0,
    },
    paymentChange: {
      type: Number,
      default: 0,
    },
    categoryChange: {
      type: Number,
      default: 0,
    },
    brandChange: {
      type: Number,
      default: 0,
    },
    productChange: {
      type: Number,
      default: 0,
    },
    userChange: {
      type: Number,
      default: 0,
    },
    locationChange: {
      type: Number,
      default: 0,
    },
    estoreChange: {
      type: Number,
      default: 0,
    },
    invites: {
      type: Number,
      default: 0,
    },
    imageStorage: {
      type: String,
      enum: ["clavmall", "cloudinary"],
    },
    storeDescription: String,
    storeAddress: String,
    storeContact: String,
    locationType: {
      type: String,
      enum: ["anywhere", "specific"],
      default: "anywhere",
    },
    minorder: String,
    maxorder: String,
    delfee: { type: String, default: "0" },
    delfeetype: {
      type: String,
      enum: ["percent", "number"],
      default: "percent",
    },
    deltime: String,
    deltimetype: {
      type: String,
      enum: ["days", "hours"],
      default: "days",
    },
    delloc: String,
    discount: { type: String, default: "0" },
    discounttype: {
      type: String,
      enum: ["percent", "number"],
      default: "percent",
    },
    servefee: String,
    servefeetype: {
      type: String,
      enum: ["percent", "number"],
      default: "percent",
    },
    referral: String,
    referraltype: {
      type: String,
      enum: ["percent", "number"],
      default: "percent",
    },
    maxMass: { type: Number, default: 9999999 },
    massPrice: { type: Number, default: 9999999 },
    maxVolume: { type: Number, default: 9999999 },
    volumePrice: { type: Number, default: 9999999 },
    productLimit: {
      type: Number,
      default: 50,
    },
    categoryLimit: {
      type: Number,
      default: 10,
    },
    userLimit: {
      type: Number,
      default: 20,
    },
    scannerType: {
      type: String,
      enum: ["webcam", "barScan"],
    },
    billingHistory: [
      {
        upgradeType: String,
        payment: String,
        totalPrice: String,
        payStatus: {
          type: String,
          enum: ["Paid", "Pending"],
        },
        duration: Number,
        referenceId: String,
      },
    ],
    upgradeType: String,
    upPackage: ObjectId,
    upStatus: {
      type: String,
      enum: ["Active", "Pending"],
    },
    recurring1: Number,
    approval: {
      type: String,
      enum: ["Approved", "For Approval", "Pending"],
    },
    upPackage2: ObjectId,
    upStatus2: {
      type: String,
      enum: ["Active", "Pending"],
    },
    recurring2: Number,
    approval2: {
      type: String,
      enum: ["Approved", "For Approval", "Pending"],
    },
    upStatus3: {
      type: String,
      enum: ["Active", "Pending"],
    },
    recurring3: Number,
    approval3: {
      type: String,
      enum: ["Approved", "For Approval", "Pending"],
    },
    upEndDate: Date,
    upEndDate2: Date,
    lifetime: {
      type: Boolean,
      default: false,
    },
    raffleActivation: Boolean,
    raffleTitle: String,
    rafflePrize: String,
    raffleEntryAmount: Number,
    raffleEntryCount: Number,
    unlimitedEntry: Boolean,
    raffleDate: Date,
    raffleHistory: [
      {
        winner: String,
        raffleTitle: String,
        rafflePrize: String,
        raffleDate: String,
      },
    ],
    resellid: ObjectId,
    showInApp: { type: Boolean, default: false },
    showInList: { type: Boolean, default: false },
    webHomepage: {
      type: String,
      enum: ["Home", "Stores", "Random"],
      default: "Home",
    },
    appHomepage: {
      type: String,
      enum: ["Home", "Stores", "Random"],
      default: "Home",
    },
    reseller: {
      appName: String,
      allowGuide: { type: Boolean, default: true },
      status: { type: Boolean, default: false },
      dedicatedDetails: String,
      androidAppLink: String,
      androidAppDesc: String,
      androidAppYoutubeId: String,
      windowsAppLink: String,
      windowsAppDesc: String,
      windowsAppYoutubeId: String,
      iosAppLink: String,
      iosAppDesc: String,
      iosAppYoutubeId: String,
      macosAppLink: String,
      macosAppDesc: String,
      macosAppYoutubeId: String,
      affilaiteVideo: String,
      affilaiteDetails: String,
      withdrawChatlink: String,
    },
    accessibility: {
      moderator: {
        type: Array,
        default: [
          "dashboard",
          "orders",
          "editorders",
          "cancelorders",
          "deleteorders",
          "createvoid",
          "category",
          "brand",
          "payment",
          "location",
          "product",
          "products",
          "sales",
          "inventory",
          "users",
          "guide",
          "setting",
          "cartprice",
          "barcode",
          "stores",
          "contact",
          "about",
        ],
      },
      cashier: {
        type: Array,
        default: [
          "dashboard",
          "orders",
          "editorders",
          "cancelorders",
          "deleteorders",
          "createvoid",
          "category",
          "brand",
          "payment",
          "location",
          "product",
          "products",
          "sales",
          "inventory",
          "users",
          "guide",
          "setting",
          "cartprice",
          "barcode",
          "stores",
          "contact",
          "about",
        ],
      },
      customer: {
        type: Array,
        default: ["stores", "contact", "about"],
      },
    },
    allocation: {
      admin: { type: Number, default: 100 },
      moderator: { type: Number, default: 0 },
      cashier: { type: Number, default: 0 },
    },
    unitName: {
      weight: {
        type: String,
        enum: ["mg", "g", "kg"],
        default: "g",
      },
      dimension: {
        type: String,
        enum: ["m", "cm", "mm"],
        default: "m",
      },
    },
    contact: [
      {
        socmed: String,
        link: String,
      },
    ],
    tutorial: [
      {
        title: String,
        link: String,
      },
    ],
    orderInitStat: {
      type: String,
      default: "Not Processed",
      enum: ["Not Processed", "Waiting Payment", "Processing"],
    },
    orderInitRemarks: {
      type: String,
      default: "Order was created.",
    },
    orderStatus: {
      type: String,
      default: "Delivering",
      enum: ["Not Processed", "Waiting Payment", "Processing", "Delivering"],
    },
    defaultEstore: Boolean,
    receiptSetting: {
      showLogo: Boolean,
      showAddress: Boolean,
      showContact: Boolean,
      showOrderCode: Boolean,
      customDetails: [
        {
          description: String,
          value: String,
        },
      ],
      showOrderedBy: Boolean,
      showOrderStatus: Boolean,
      showCusPhone: Boolean,
      showCusAddress: Boolean,
      showOrderType: Boolean,
      showPayment: Boolean,
      showUnitOfMeasure: Boolean,
      showLocNumber: Boolean,
      showExpiration: Boolean,
      showSenior: Boolean,
      showVat: Boolean,
      showCashier: Boolean,
      showDateOrdered: Boolean,
      showReceivedBy: Boolean,
      customDetails2: [
        {
          description: String,
          value: String,
        },
      ],
      customeNote: String,
    },
    vatExempt: Number,
    vatExemptType: {
      type: String,
      enum: ["percent", "number"],
      default: "percent",
    },
    zeroRate: Number,
    zeroRateType: {
      type: String,
      enum: ["percent", "number"],
      default: "percent",
    },
    domain: String,
    subdomain: String,
    indexing: { type: Boolean, default: false },
  },
  { timestamps: true }
);

estoreSchema.index(
  {
    name: "text",
    slug: "text",
    email: "text",
    storeDescription: "text",
    storeAddress: "text",
    storeContact: "text",
  },
  {
    weights: {
      name: 5,
      storeDescription: 3,
      slug: 2,
      email: 1,
      storeAddress: 1,
      storeContact: 1,
    },
  }
);

const Estore = (estoreid) => conn[estoreid].model("GratisEstore", estoreSchema);

module.exports = Estore;
