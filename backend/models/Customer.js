const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    mobile: String,
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
    authProvider: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", CustomerSchema);
