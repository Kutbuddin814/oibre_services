const mongoose = require("mongoose");

const BlacklistSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    reason: String, // "banned" or "deleted"
    bannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser"
    },
    message: String, // reason message shown to user
    bannedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Blacklist", BlacklistSchema);
