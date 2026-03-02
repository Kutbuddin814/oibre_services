const mongoose = require("mongoose");

const ProviderRequestSchema = new mongoose.Schema({
  name: String,
  email: String,

  mobile: {
    type: String,
    unique: true,
    match: [/^[6-9]\d{9}$/, "Invalid mobile"]
  },

  qualification: String,
  serviceCategory: String,
  otherService: String,

  address: String,
  availableTime: String,
  experience: String,
  description: String,

  profilePhoto: String,
  skillCertificate: String,

  /* =========================
     LOCATION (NEW – REQUIRED)
  ========================= */
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number] // [lng, lat]
    }
  },
    averageRating: {
      type: Number,
      default: 0
    },
    reviewCount: {
      type: Number,
      default: 0
    },
  status: { type: String, default: "pending" },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ProviderRequest", ProviderRequestSchema);
