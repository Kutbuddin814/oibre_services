const mongoose = require("mongoose");

const ChatConversationSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceProvider",
      required: true
    },
    contactUnlocked: {
      type: Boolean,
      default: false
    },
    lastMessageText: {
      type: String,
      default: ""
    },
    lastMessageAt: Date,
    lastMessageBy: {
      type: String,
      enum: ["system", "customer", "provider"],
      default: "system"
    },
    customerLastReadAt: Date,
    providerLastReadAt: Date
  },
  { timestamps: true }
);

ChatConversationSchema.index({ customerId: 1, providerId: 1 }, { unique: true });
ChatConversationSchema.index({ customerId: 1, updatedAt: -1 });
ChatConversationSchema.index({ providerId: 1, updatedAt: -1 });

module.exports = mongoose.model("ChatConversation", ChatConversationSchema);
