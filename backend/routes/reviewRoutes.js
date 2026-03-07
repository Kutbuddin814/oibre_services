const express = require("express");
const Review = require("../models/Review");
const ServiceRequest = require("../models/ServiceRequest");
const customerAuth = require("../middleware/customerAuth");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Setup multer for image upload
const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && 
                                process.env.CLOUDINARY_API_KEY && 
                                process.env.CLOUDINARY_API_SECRET;

let storage;
if (isCloudinaryConfigured) {
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "oibre/reviews",
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png"]
    }
  });
} else {
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "uploads/reviews/");
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    }
  });
}

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  }
});

/* =========================
   CREATE REVIEW
========================= */
router.post("/create", customerAuth, upload.single("image"), async (req, res) => {
  try {
    const { providerId, bookingId, rating, comment } = req.body;

    if (!providerId || !bookingId || !rating) {
      return res.status(400).json({ message: "Missing required fields: providerId, bookingId, rating" });
    }

    // Validate the booking exists and belongs to this customer
    const booking = await ServiceRequest.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.customerId.toString() !== req.customerId) {
      return res.status(403).json({ message: "You can only review your own bookings" });
    }

    // Check if booking is completed or cancelled
    if (booking.status !== "completed" && booking.status !== "cancelled") {
      return res.status(400).json({ message: "Can only review completed or cancelled bookings" });
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({ booking: bookingId });
    if (existingReview) {
      return res.status(400).json({ message: "You have already reviewed this booking" });
    }

    // Get image URL from upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = req.file.path || `/uploads/reviews/${req.file.filename}`;
    }

    const review = new Review({
      provider: providerId,
      customer: req.customerId,
      booking: bookingId,
      rating,
      comment: comment || "",
      image: imageUrl
    });

    await review.save();

    // Mark booking as reviewed
    await ServiceRequest.findByIdAndUpdate(bookingId, {
      reviewed: true,
      reviewedAt: new Date()
    });

    res.status(201).json({ message: "Feedback submitted successfully", review });
  } catch (err) {
    console.error("Review error:", err);
    res.status(500).json({ message: "Failed to submit feedback", error: err.message });
  }
});

module.exports = router;
