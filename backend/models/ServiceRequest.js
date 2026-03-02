const mongoose = require("mongoose");

const ServiceRequestSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceProvider" },
    status: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("ServiceRequest", ServiceRequestSchema);
