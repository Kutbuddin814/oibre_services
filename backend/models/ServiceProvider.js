const mongoose = require("mongoose");

const ServiceProviderSchema = new mongoose.Schema(
  {
    /* =========================
       BASIC DETAILS
    ========================= */
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true,
      select: false // 🔐 never return password
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      match: [/^[6-9]\d{9}$/, "Invalid mobile number"]
    },

    /* =========================
       SERVICE DETAILS
    ========================= */
    serviceCategory: {
      type: String,
      required: true
    },

    qualification: String,
    otherService: String,

    experience: {
      type: String
    },

    availableTime: String,

    description: String,

    address: {
      type: String,
      required: true
    },

    /* =========================
       FILES
    ========================= */
    profilePhoto: String,
    skillCertificate: String,

    /* =========================
       LOCATION (OpenStreetMap)
       [longitude, latitude]
    ========================= */
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true
      }
    },

    /* =========================
       PRICING
    ========================= */
    basePrice: {
      type: Number,
      default: 200
    },

    /* =========================
       STATUS
    ========================= */
    status: {
      type: String,
      enum: ["approved", "blocked"],
      default: "approved"
    },

    verified: {
      type: Boolean,
      default: true
    },
    averageRating: {
      type: Number,
      default: 0
    },
    reviewCount: {
      type: Number,
      default: 0
    },

    /* =========================
       PAYMENT DETAILS
    ========================= */
    paymentDetails: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: String,
      upiId: String,
      panNumber: String
    },

    paymentDetailsCompleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

/* =========================
   GEO INDEX (CRITICAL)
========================= */
ServiceProviderSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("ServiceProvider", ServiceProviderSchema);
