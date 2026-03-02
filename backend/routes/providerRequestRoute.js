const express = require("express");
const router = express.Router();

const ServiceRequest = require("../models/ServiceRequest");
const authMiddleware = require("../middleware/authMiddleware");

/* ================================
   GET REQUESTS FOR LOGGED PROVIDER
================================ */
router.get("/my-requests", authMiddleware, async (req, res) => {
  try {
    const requests = await ServiceRequest.find({
      providerId: req.providerId
    }).sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("FETCH REQUESTS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch requests" });
  }
});

/* ================================
   ACCEPT / UPDATE REQUEST
================================ */
router.put("/update/:id", authMiddleware, async (req, res) => {
  const { visitDate, visitTime, providerNote, status } = req.body;

  try {
    const request = await ServiceRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    request.visitDate = visitDate;
    request.visitTime = visitTime;
    request.providerNote = providerNote;
    request.status = status || "accepted";

    await request.save();

    res.json({ message: "Request updated successfully" });
  } catch (err) {
    console.error("UPDATE REQUEST ERROR:", err);
    res.status(500).json({ message: "Update failed" });
  }
});

module.exports = router;
