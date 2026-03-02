const express = require("express");
const Review = require("../models/Review");
const customerAuth = require("../middleware/customerAuth");

const router = express.Router();

/* =========================
   CREATE REVIEW
========================= */
router.post("/create", customerAuth, async (req, res) => {
  try {
    const { providerId, rating, comment } = req.body;

    if (!providerId || !rating) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const review = new Review({
      provider: providerId,          // ✅ matches schema
      customer: req.customerId,      // ✅ matches schema
      rating,
      comment
    });

    await review.save();

    res.status(201).json({ message: "Review submitted" });
  } catch (err) {
    console.error("Review error:", err);
    res.status(500).json({ message: "Failed to submit review" });
  }
});

module.exports = router;
