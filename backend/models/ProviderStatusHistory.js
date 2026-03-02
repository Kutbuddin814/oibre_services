const mongoose = require("mongoose");

const ProviderStatusHistorySchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceProvider",
      required: true,
      index: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      index: true
    },
    name: {
      type: String,
      trim: true,
      default: ""
    },
    action: {
      type: String,
      enum: ["blocked", "unblocked"],
      required: true,
      index: true
    },
    reason: {
      type: String,
      trim: true,
      default: ""
    },
    previousStatus: {
      type: String,
      trim: true,
      default: ""
    },
    newStatus: {
      type: String,
      trim: true,
      default: ""
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId
    },
    changedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("ProviderStatusHistory", ProviderStatusHistorySchema);
