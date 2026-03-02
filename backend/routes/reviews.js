const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const mongoose = require("mongoose");

const Review = require("../models/Review");
const ServiceRequest = require("../models/ServiceRequest");
const ServiceProvider = require("../models/ServiceProvider");
const customerAuth = require("../middleware/customerAuth");

const router = express.Router();

const reviewUploadDir = path.join(__dirname, "../uploads/reviews");
if (!fs.existsSync(reviewUploadDir)) {
  fs.mkdirSync(reviewUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, reviewUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || ".jpg"}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  }
});

const recalculateProviderRating = async (providerIdStr) => {
  const allReviews = await Review.find({ provider: providerIdStr });
  const count = allReviews.length;
  const avg = count
    ? allReviews.reduce((sum, r) => sum + r.rating, 0) / count
    : 0;

  await ServiceProvider.findByIdAndUpdate(providerIdStr, {
    averageRating: avg.toFixed(1),
    reviewCount: count
  });
};

router.post("/create", customerAuth, upload.single("image"), async (req, res) => {
  try {
    const { providerId, bookingId, rating, comment } = req.body;

    const normalizedProviderId =
      providerId && typeof providerId === "object" ? providerId._id : providerId;
    const providerIdStr = String(normalizedProviderId || "").trim();
    const bookingIdStr = String(bookingId || "").trim();
    const numericRating = Number(rating);

    if (!providerIdStr || !bookingIdStr || !numericRating) {
      return res.status(400).json({ message: "Missing fields" });
    }

    if (
      !mongoose.Types.ObjectId.isValid(providerIdStr) ||
      !mongoose.Types.ObjectId.isValid(bookingIdStr)
    ) {
      return res.status(400).json({ message: "Invalid provider or booking id" });
    }

    const booking = await ServiceRequest.findById(bookingIdStr);
    if (!booking || !["completed", "cancelled"].includes(booking.status)) {
      return res.status(400).json({
        message: "You can submit feedback only after completion or cancellation"
      });
    }

    if (String(booking.providerId) !== providerIdStr) {
      return res.status(400).json({ message: "Provider does not match this booking" });
    }

    const alreadyReviewed = await Review.findOne({ booking: bookingIdStr });
    if (alreadyReviewed) {
      return res.status(400).json({
        message: "You have already reviewed this booking"
      });
    }

    await Review.create({
      provider: providerIdStr,
      customer: req.customerId,
      booking: bookingIdStr,
      rating: numericRating,
      comment,
      image: req.file ? `reviews/${req.file.filename}` : ""
    });

    await ServiceRequest.findByIdAndUpdate(bookingIdStr, {
      reviewed: true,
      reviewedAt: new Date()
    });

    await recalculateProviderRating(providerIdStr);

    res.json({ message: "Review submitted successfully" });
  } catch (err) {
    console.error("REVIEW ERROR:", err);
    if (err?.message === "Only image files are allowed") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Failed to submit review" });
  }
});

router.patch("/:reviewId", customerAuth, upload.single("image"), async (req, res) => {
  try {
    const reviewId = String(req.params.reviewId || "").trim();
    const comment = String(req.body?.comment || "").trim();
    const numericRating = Number(req.body?.rating);
    const removeImage = String(req.body?.removeImage || "").toLowerCase() === "true";

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: "Invalid review id" });
    }

    if (!comment) {
      return res.status(400).json({ message: "Comment is required" });
    }

    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (String(review.customer) !== String(req.customerId)) {
      return res.status(403).json({ message: "You can edit only your own review" });
    }

    review.comment = comment;
    review.rating = numericRating;
    if (req.file) {
      review.image = `reviews/${req.file.filename}`;
    } else if (removeImage) {
      review.image = "";
    }
    await review.save();
    await recalculateProviderRating(String(review.provider));

    return res.json({
      message: "Review updated successfully",
      review
    });
  } catch (err) {
    console.error("REVIEW UPDATE ERROR:", err);
    if (err?.message === "Only image files are allowed") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Failed to update review" });
  }
});

module.exports = router;
