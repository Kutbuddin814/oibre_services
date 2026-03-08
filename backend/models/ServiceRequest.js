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
    reviewedAt: Date,

    // Final Price & Payment Fields
    estimatedPrice: Number,
    finalPrice: Number,
    priceStatus: {
      type: String,
      enum: ["pending", "price_sent", "price_approved"],
      default: "pending"
    },
    priceSentAt: Date,
    priceApprovedAt: Date,

    // Payment Information
    paymentMethod: {
      type: String,
      enum: ["cod", "online"],
      default: "cod"
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "cod_paid", "online_paid", "failed", "refunded"],
      default: "pending"
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    paymentFailureReason: String,
    paidAt: Date,

    // Payout Information (Admin Settlement)
    payoutStatus: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "pending"
    },
    payoutAmount: Number,
    commission: Number,
    providerEarning: Number,
    payoutDate: Date,
    paidByAdmin: String // Admin user ID/name who marked as paid
  },
  { timestamps: true }
);

module.exports = mongoose.model("ServiceRequest", ServiceRequestSchema);
