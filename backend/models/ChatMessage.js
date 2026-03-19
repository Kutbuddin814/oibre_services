const mongoose = require("mongoose");

const ChatMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true
    },
    senderType: {
      type: String,
      enum: ["system", "customer", "provider"],
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500
    }
  },
  { timestamps: true }
);

ChatMessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);
