const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    mobile: String,
    password: { type: String, default: null, select: false },
    googleId: String,
    address: String,
    locality: String,
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: [Number]
    },
    authProvider: String,
    status: {
      type: String,
      enum: ["active", "banned"],
      default: "active"
    },
    bannedAt: Date,
    banReason: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", CustomerSchema);
