const express = require("express");
const bcrypt = require("bcryptjs");
const { sendBrevoEmail } = require("../utils/sendEmail");
const ServiceProvider = require("../models/ServiceProvider");
const RemovalRequest = require("../models/RemovalRequest");
const EmailOtp = require("../models/EmailOtp");
const authMiddleware = require("../middleware/authMiddleware");
const { upload } = require("../middleware/upload");
const { validateAndNormalizePhone, getPhoneErrorMessage } = require("../utils/phoneValidation");

const router = express.Router();
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

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

    const validatedMobile = validateAndNormalizePhone(mobile);
    if (!validatedMobile) {
      return res.status(400).json({ message: getPhoneErrorMessage() });
    }

    const nextExperience = String(experience || "").trim();
    const nextAvailableTime = String(availableTime || "").trim();

    const mobileTaken = await ServiceProvider.findOne({
      mobile: validatedMobile,
      _id: { $ne: req.providerId }
    });

    if (mobileTaken) {
      return res.status(409).json({ message: "Mobile number already in use" });
    }

    const updateData = {
      mobile: validatedMobile,
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
   CHANGE EMAIL - SEND OTP
================================ */
router.post("/change-email/send-otp", authMiddleware, async (req, res) => {
  try {
    const { newEmail } = req.body;
    
    if (!newEmail) {
      return res.status(400).json({ message: "New email is required" });
    }

    const cleanEmail = String(newEmail).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    const provider = await ServiceProvider.findById(req.providerId);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    if (cleanEmail === provider.email) {
      return res.status(400).json({ message: "New email must be different from current email" });
    }

    const existingEmail = await ServiceProvider.findOne({
      _id: { $ne: provider._id },
      email: cleanEmail
    });
    if (existingEmail) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const lastOtp = await EmailOtp.findOne({ email: cleanEmail }).sort({ createdAt: -1 });
    if (lastOtp && Date.now() - lastOtp.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      return res.status(429).json({ message: "Please wait before requesting another OTP" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await EmailOtp.create({
      email: cleanEmail,
      otpHash,
      expiresAt
    });

    await sendBrevoEmail({
      to: cleanEmail,
      subject: "Oibre - Email Change Verification Code",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; }
              .container { max-width: 500px; margin: 20px auto; }
              .header { background: #1f2937; color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: center; }
              .logo { font-size: 28px; font-weight: 700; }
              .content { background: white; padding: 32px 24px; border-radius: 0 0 8px 8px; }
              .code-box { background: #f0fdf4; border: 2px dashed #10b981; padding: 24px; text-align: center; border-radius: 8px; margin: 24px 0; }
              .code { font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #059669; font-family: monospace; }
              .footer { color: #6b7280; font-size: 12px; margin-top: 24px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">Oibre</div>
              </div>
              <div class="content">
                <p>Hello Provider,</p>
                <p>You requested to change your email on Oibre. Enter this code to verify your new email:</p>
                <div class="code-box">
                  <div class="code">${otp}</div>
                </div>
                <p style="color: #6b7280; font-size: 13px;">This code expires in 10 minutes.</p>
                <p style="color: #991b1b; background: #fee2e2; padding: 12px; border-radius: 4px; font-size: 13px;">⚠️ Do not share this code with anyone.</p>
                <div class="footer">
                  <p>Oibre | Local Services Platform</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `
    }).catch((err) => {
      console.error("Email OTP send error:", err?.message);
    });

    res.json({ message: "OTP sent to new email address" });
  } catch (err) {
    console.error("CHANGE EMAIL SEND OTP ERROR:", err.message);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

/* ===============================
   CHANGE EMAIL - VERIFY OTP
================================ */
router.post("/change-email/verify-otp", authMiddleware, async (req, res) => {
  try {
    const { newEmail, otp } = req.body;

    if (!newEmail || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const cleanEmail = String(newEmail).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const record = await EmailOtp.findOne({ email: cleanEmail }).sort({ createdAt: -1 });
    if (!record) {
      return res.status(404).json({ message: "OTP not found. Request a new one" });
    }

    if (Date.now() > record.expiresAt.getTime()) {
      return res.status(400).json({ message: "OTP expired. Request a new one" });
    }

    const isMatch = await bcrypt.compare(cleanOtp, record.otpHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const provider = await ServiceProvider.findById(req.providerId);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    provider.email = cleanEmail;
    await provider.save();

    await EmailOtp.deleteOne({ _id: record._id });

    const updated = await ServiceProvider.findById(provider._id).select("-password -__v");
    res.json({
      message: "Email changed successfully",
      provider: updated
    });
  } catch (err) {
    console.error("CHANGE EMAIL VERIFY OTP ERROR:", err.message);
    res.status(500).json({ message: "Failed to verify OTP" });
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
