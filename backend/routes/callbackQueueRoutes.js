const express = require("express");
const router = express.Router();
const CallbackRequest = require("../models/CallbackRequest");
const ServiceProvider = require("../models/ServiceProvider");
const adminAuth = require("../middleware/adminAuth");

// Get all callback requests (admin/provider dashboard)
router.get("/queue", adminAuth, async (req, res) => {
  try {
    const requests = await CallbackRequest.find()
      .populate("customerId", "name email phone")
      .populate("assignedProviderId", "name email phone")
      .sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update callback request status
router.post("/update-status", adminAuth, async (req, res) => {
  try {
    const { callbackId, status, providerId } = req.body;
    const update = { status };
    if (providerId) update.assignedProviderId = providerId;
    update.updatedAt = new Date();
    await CallbackRequest.findByIdAndUpdate(callbackId, update);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cancel/delete callback request
router.post("/cancel", adminAuth, async (req, res) => {
  try {
    const { callbackId } = req.body;
    await CallbackRequest.findByIdAndUpdate(callbackId, { status: "cancelled", updatedAt: new Date() });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
