const mongoose = require("mongoose");

const emailOtpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },

  otpHash: {   // ✅ IMPORTANT
    type: String,
    required: true
  },

  expiresAt: {
    type: Date,
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  verifiedAt: {
    type: Date
  },

  consumedAt: {
    type: Date
  }
});

// TTL index
emailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
emailOtpSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model("EmailOtp", emailOtpSchema);