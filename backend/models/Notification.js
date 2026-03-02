const mongoose = require("mongoose");

const UNREAD_RETENTION_DAYS = 30;
const defaultExpiry = () => {
  const dt = new Date();
  dt.setDate(dt.getDate() + UNREAD_RETENTION_DAYS);
  return dt;
};

const notificationSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    customerName: {
      type: String,
      default: "",
      trim: true
    },

    message: {
      type: String,
      required: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
    },

    read: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      default: defaultExpiry
    }
  },
  { timestamps: true }
);

notificationSchema.index({ customerId: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Notification", notificationSchema);
