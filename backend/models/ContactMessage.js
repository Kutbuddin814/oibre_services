const mongoose = require("mongoose");

const ContactMessageSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    subject: String,
    message: String,
    status: {
      type: String,
      enum: ["new", "in_progress", "closed"],
      default: "new"
    },
    lastReplyMessage: {
      type: String,
      default: ""
    },
    lastReplySubject: {
      type: String,
      default: ""
    },
    repliedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ContactMessage", ContactMessageSchema);
