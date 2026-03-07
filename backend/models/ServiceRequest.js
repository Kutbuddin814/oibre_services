const mongoose = require("mongoose");

const ServiceRequestSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerName: String,
    customerEmail: String,
    customerPhone: String,

    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceProvider" },
    providerName: String,

    serviceCategory: String,
    problemDescription: String,
    problemImage: String,

    address: String,
    locality: String,
    lat: Number,
    lng: Number,

    preferredDate: String,
    preferredTime: String,

    visitDate: String,
    visitTime: String,

    status: {
      type: String,
      enum: ["pending", "accepted", "in_progress", "completed", "cancelled"],
      default: "pending"
    },

    providerNote: String,
    customerCancelReason: String,

    completionOtp: String,
    completionOtpSentAt: Date,
    completionOtpExpiresAt: Date,

    reviewed: {
      type: Boolean,
      default: false
    },
    reviewedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("ServiceRequest", ServiceRequestSchema);
