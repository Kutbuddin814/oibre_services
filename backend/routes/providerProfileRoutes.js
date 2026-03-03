const express = require("express");
const bcrypt = require("bcryptjs");
const ServiceProvider = require("../models/ServiceProvider");
const RemovalRequest = require("../models/RemovalRequest");
const authMiddleware = require("../middleware/authMiddleware");
const { upload } = require("../middleware/upload");

const router = express.Router();

/* ===============================
   GET LOGGED-IN PROVIDER PROFILE
================================ */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const provider = await ServiceProvider.findById(req.providerId).select(
      "-__v"
    );

    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    res.json(provider);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   UPDATE LOGGED-IN PROVIDER PROFILE
================================ */
router.put("/me", authMiddleware, upload.fields([
  { name: "profilePhoto", maxCount: 1 },
  { name: "skillCertificate", maxCount: 1 }
]), async (req, res) => {
  try {
    const { mobile, experience, availableTime } = req.body;

    const nextMobile = String(mobile || "").trim();
    const nextExperience = String(experience || "").trim();
    const nextAvailableTime = String(availableTime || "").trim();

    if (!/^[6-9]\d{9}$/.test(nextMobile)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" });
    }

    const mobileTaken = await ServiceProvider.findOne({
      mobile: nextMobile,
      _id: { $ne: req.providerId }
    });

    if (mobileTaken) {
      return res.status(409).json({ message: "Mobile number already in use" });
    }

    const updateData = {
      mobile: nextMobile,
      experience: nextExperience,
      availableTime: nextAvailableTime
    };

    // Add uploaded files to update data if present
    if (req.files?.profilePhoto?.[0]) {
      updateData.profilePhoto = req.files.profilePhoto[0].path;
    }

    if (req.files?.skillCertificate?.[0]) {
      updateData.skillCertificate = req.files.skillCertificate[0].path;
    }

    const provider = await ServiceProvider.findByIdAndUpdate(
      req.providerId,
      updateData,
      { new: true, runValidators: true }
    ).select("-__v");

    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    res.json({
      message: "Profile updated successfully",
      provider
    });
  } catch (err) {
    console.error("UPDATE PROVIDER PROFILE ERROR:", err);
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Mobile number already in use" });
    }
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

/* ===============================
   UPDATE LOGGED-IN PROVIDER LOCATION
================================ */
router.put("/location", authMiddleware, async (req, res) => {
  try {
    const { address, lat, lng } = req.body;

    if (!address || lat === undefined || lng === undefined) {
      return res.status(400).json({
        message: "address, lat and lng are required"
      });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        message: "lat and lng must be valid numbers"
      });
    }

    const provider = await ServiceProvider.findByIdAndUpdate(
      req.providerId,
      {
        address: String(address).trim(),
        location: {
          type: "Point",
          coordinates: [longitude, latitude]
        }
      },
      { new: true, runValidators: true }
    ).select("-__v");

    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    res.json({
      message: "Location updated successfully",
      provider
    });
  } catch (err) {
    console.error("UPDATE PROVIDER LOCATION ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   CHANGE LOGGED-IN PROVIDER PASSWORD
================================ */
router.put("/change-password", authMiddleware, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const provider = await ServiceProvider.findById(req.providerId).select("+password");
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, provider.password || "");
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const sameAsOld = await bcrypt.compare(newPassword, provider.password || "");
    if (sameAsOld) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    provider.password = await bcrypt.hash(newPassword, 10);
    await provider.save();

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    return res.status(500).json({ message: "Failed to change password" });
  }
});

/* ===============================
   SUBMIT REMOVAL REQUEST
================================ */
router.post("/removal-requests", authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;

    const provider = await ServiceProvider.findById(req.providerId);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    const existing = await RemovalRequest.findOne({
      providerId: req.providerId,
      status: "pending"
    });

    if (existing) {
      return res.status(409).json({
        message: "A removal request is already pending."
      });
    }

    const request = new RemovalRequest({
      providerId: provider._id,
      name: provider.name,
      email: provider.email,
      reason: (reason || "").trim()
    });

    await request.save();

    res.status(201).json({
      message: "Removal request submitted successfully."
    });
  } catch (err) {
    console.error("REMOVAL REQUEST ERROR:", err);
    res.status(500).json({ message: "Failed to submit removal request" });
  }
});

module.exports = router;
