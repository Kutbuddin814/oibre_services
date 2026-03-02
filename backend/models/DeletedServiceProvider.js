const mongoose = require("mongoose");

const DeletedServiceProviderSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceProvider",
      index: true
    },
    removalRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RemovalRequest",
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
    reason: {
      type: String,
      trim: true,
      default: ""
    },
    adminNote: {
      type: String,
      trim: true,
      default: ""
    },
    removedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    approvedByAdminId: {
      type: mongoose.Schema.Types.ObjectId
    },
    providerSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("DeletedServiceProvider", DeletedServiceProviderSchema);
