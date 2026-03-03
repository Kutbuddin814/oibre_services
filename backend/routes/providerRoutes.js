const express = require("express");
const router = express.Router();
const axios = require("axios");
const dns = require("dns").promises;
const { uploadWithCloudinary } = require("../middleware/upload");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendBrevoEmail } = require("../utils/sendEmail");

const ProviderRequest = require("../models/ProviderRequest");
const ServiceProvider = require("../models/ServiceProvider");
const EmailOtp = require("../models/EmailOtp");

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
const EMAIL_DNS_TIMEOUT_MS = 5000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const hasMxRecord = async (domain) => {
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("DNS lookup timed out")), EMAIL_DNS_TIMEOUT_MS)
      )
    ]);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
};

const createMailer = () => {
  // Brevo API is now used via sendBrevoEmail - no SMTP transporter needed
  return null;
};

const sendOtpEmail = async ({ to, otp }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`⚠️ DEV OTP for ${to}: ${otp}`);
    console.warn(`⚠️ Email sending disabled! Configure SMTP_USER, SMTP_PASS in .env`);
    return { sentByEmail: false, warning: "Email credentials not configured" };
  }

  const subject = "Oibre - Service Provider Registration Verification Code";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
          .container { max-width: 500px; margin: 20px auto; padding: 0; }
          .header { background: #1f2937; color: white; text-align: center; padding: 24px; border-radius: 8px 8px 0 0; }
          .logo { font-size: 28px; font-weight: 700; margin: 0; }
          .badge { display: inline-block; background: #8b5cf6; color: white; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-top: 8px; letter-spacing: 0.5px; }
          .content { background: white; padding: 32px 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
          .greeting { color: #374151; font-size: 16px; margin: 0 0 16px 0; font-weight: 500; }
          .description { color: #6b7280; font-size: 14px; margin: 0 0 16px 0; line-height: 1.6; }
          .purpose-box { background: #f3f0ff; border-left: 4px solid #8b5cf6; padding: 12px 16px; border-radius: 0 4px 4px 0; margin: 20px 0; }
          .purpose-label { color: #6d28d9; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0; }
          .purpose-text { color: #7c3aed; font-size: 14px; font-weight: 600; margin: 0; }
          .code-section { background: linear-gradient(135deg, #f3f0ff 0%, #ede9fe 100%); padding: 24px; border-radius: 8px; border: 2px dashed #8b5cf6; text-align: center; margin: 24px 0; }
          .code-label { color: #6d28d9; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0; font-weight: 700; }
          .code { font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #7c3aed; font-family: 'Courier New', monospace; margin: 0; }
          .instructions { background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0; }
          .step { color: #374151; font-size: 13px; margin: 8px 0; padding-left: 20px; position: relative; }
          .step:before { content: "→"; position: absolute; left: 0; color: #8b5cf6; font-weight: 700; }
          .expiry-info { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 12px 16px; border-radius: 0 4px 4px 0; color: #92400e; font-size: 13px; margin: 20px 0; }
          .warning { background: #fee2e2; border-left: 3px solid #dc2626; padding: 12px 16px; border-radius: 0 4px 4px 0; color: #991b1b; font-size: 13px; margin: 20px 0; }
          .footer { color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Oibre</div>
            <div class="badge">✓ Provider Signup</div>
          </div>
          <div class="content">
            <p class="greeting">Welcome to Oibre! 👋</p>
            
            <div class="purpose-box">
              <div class="purpose-label">📋 What is this?</div>
              <div class="purpose-text">Your One-Time Password (OTP) for Service Provider Signup</div>
            </div>

            <p class="description">
              Thank you for signing up! Please use the verification code below to complete your service provider registration.
            </p>
            
            <div class="code-section">
              <div class="code-label">Your Provider Signup OTP:</div>
              <div class="code">${otp}</div>
            </div>

            <div class="instructions">
              <div style="color: #6b7280; font-size: 12px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">How to Use:</div>
              <div class="step">Go back to the registration form</div>
              <div class="step">Paste or enter this 6-digit code</div>
              <div class="step">Click "Verify OTP" to complete signup</div>
            </div>

            <div class="expiry-info">
              ⏰ <strong>Valid for 10 minutes only</strong> — Don't share this code with anyone
            </div>

            <div class="footer">
              <p style="margin: 0 0 8px 0;"><strong>Oibre</strong> | Local Services Platform</p>
              <p style="margin: 0; font-size: 11px;">This is an automated email. Please do not reply to this address.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const result = await sendBrevoEmail({ to, subject, html });
    if (result.sent) {
      console.log(`✅ OTP email sent successfully to ${to}`);
      return { sentByEmail: true };
    } else {
      console.error("❌ PROVIDER OTP EMAIL ERROR:", result.reason);
      return { sentByEmail: false, error: result.reason };
    }
  } catch (err) {
    console.error("❌ PROVIDER OTP EMAIL ERROR:", err?.message || err);
    return { sentByEmail: false, error: err?.message };
  }
};

const generateOtp = () => String(crypto.randomInt(100000, 999999));

/* ===============================
   SEARCH PROVIDERS BY LOCATION & CATEGORY
=============================== */
router.get("/", async (req, res) => {
  try {
    const { lat, lng, serviceCategory } = req.query;

    let filter = { status: "approved" };

    if (serviceCategory && serviceCategory.trim()) {
      const category = serviceCategory.trim();
      filter.$or = [
        { serviceCategory: { $regex: category, $options: "i" } },
        { otherService: { $regex: category, $options: "i" } }
      ];
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    let providers;

    // ✅ STRICT numeric validation
    if (!isNaN(latitude) && !isNaN(longitude)) {
      providers = await ServiceProvider.find({
        ...filter,
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude]
            },
            $maxDistance: 20000
          }
        }
      })
        .select("-password")
        .limit(50)
        .lean();
    } else {
      providers = await ServiceProvider.find(filter)
        .sort({ averageRating: -1 })
        .select("-password")
        .limit(50)
        .lean();
    }

    // ✅ Calculate distance and final price for each provider
    providers = providers.map((provider) => {
      let distanceKm = null;

      if (!isNaN(latitude) && !isNaN(longitude)) {
        const R = 6371; // Earth's radius in kilometers
        const dLat =
          (latitude - provider.location.coordinates[1]) * Math.PI / 180;
        const dLng =
          (longitude - provider.location.coordinates[0]) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(provider.location.coordinates[1] * Math.PI / 180) *
            Math.cos(latitude * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.asin(Math.sqrt(a));
        distanceKm = Math.round(R * c * 10) / 10;
      }

      const basePrice = provider.basePrice || 200;
      let distanceCharge = 0;

      if (distanceKm) {
        // ₹15 per km - realistic pricing
        distanceCharge = Math.round(distanceKm * 15);
      }

      const finalPrice = basePrice + distanceCharge;

      return {
        ...provider,
        distanceKm,
        finalPrice
      };
    });

    res.json(providers);
  } catch (err) {
    console.error("SEARCH PROVIDERS ERROR:", err.message);
    res.status(500).json({ message: "Failed to search providers" });
  }
});

/* ===============================
   GET PROVIDER PROFILE WITH REVIEWS
=============================== */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.query;

    const provider = await ServiceProvider.findById(id)
      .select("-password")
      .lean();

    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    // Fetch reviews for this provider
    const Review = require("../models/Review");
    const reviews = await Review.find({ provider: id })
      .select("rating text customerName customerPhoto createdAt")
      .lean()
      .sort({ createdAt: -1 });

    // Calculate distance if location is provided
    let distanceKm = null;
    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      if (isFinite(latitude) && isFinite(longitude)) {
        // Haversine formula for distance calculation
        const R = 6371; // Earth's radius in kilometers
        const dLat = (latitude - provider.location.coordinates[1]) * Math.PI / 180;
        const dLng = (longitude - provider.location.coordinates[0]) * Math.PI / 180;
        const a = 
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(provider.location.coordinates[1] * Math.PI / 180) * 
          Math.cos(latitude * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.asin(Math.sqrt(a));
        distanceKm = Math.round(R * c * 10) / 10; // Round to 1 decimal place
      }
    }

    // Calculate final price based on distance
    const basePrice = provider.basePrice || 200;
    let distanceCharge = 0;

    if (distanceKm) {
      // ₹15 per km - realistic pricing
      distanceCharge = Math.round(distanceKm * 15);
    }

    const finalPrice = basePrice + distanceCharge;

    res.json({
      provider,
      reviews,
      distanceKm,
      finalPrice
    });
  } catch (err) {
    console.error("GET PROVIDER ERROR:", err.message);
    res.status(500).json({ message: "Failed to fetch provider" });
  }
});

/* ===============================
   FREE GEO CODING (OpenStreetMap)
=============================== */
const getLatLng = async (address) => {
  const res = await axios.get(
    "https://nominatim.openstreetmap.org/search",
    {
      params: { q: address, format: "json", limit: 1 },
      headers: { "User-Agent": "Oibre-App/1.0" },
      timeout: 10000
    }
  );

  if (!res.data.length) {
    throw new Error("Invalid address or not found");
  }

  return [
    parseFloat(res.data[0].lon),
    parseFloat(res.data[0].lat)
  ];
};

/* ===============================
   REGISTER PROVIDER (FIELD SAFE)
=============================== */
router.post(
  "/email-otp/send",
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ message: "Please enter a valid email address" });
      }

      const emailDomain = String(email).toLowerCase().split("@")[1] || "";
      const domainHasMx = emailDomain ? await hasMxRecord(emailDomain) : false;
      if (!domainHasMx) {
        return res.status(400).json({
          message: "Email domain does not exist. Please use a valid email address."
        });
      }

      const lastOtp = await EmailOtp.findOne({ email }).sort({ createdAt: -1 });
      if (lastOtp && Date.now() - lastOtp.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
        return res.status(429).json({
          message: "Please wait before requesting another OTP."
        });
      }

      const otp = generateOtp();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + OTP_TTL_MS);

      // Save OTP to database FIRST
      const otpRecord = await EmailOtp.create({
        email,
        otpHash,
        expiresAt
      });

      // Try to send email, but don't fail the request if it doesn't work
      const sendResult = await sendOtpEmail({ to: email, otp }).catch((err) => {
        console.error("⚠️ Email failed, but OTP saved to DB:", err.message);
        return { sentByEmail: false, warning: err.message };
      });

      // ALWAYS return success if OTP was saved to DB (email can be retried)
      const response = {
        message: sendResult.sentByEmail 
          ? "OTP sent successfully to your email" 
          : "OTP generated. Check your email (or spam folder)",
        otpId: otpRecord._id,
        emailSent: sendResult.sentByEmail
      };

      // Add OTP to response only in dev/test mode
      if (process.env.NODE_ENV !== "production") {
        response.otp = otp;
      }

      return res.json(response);
    } catch (err) {
      console.error("❌ EMAIL OTP SEND ERROR:", err.message);
      console.error("Error details:", err);
      
      // More helpful error message
      let errorMsg = "Failed to generate OTP";
      if (err.message.includes("ECONNREFUSED")) {
        errorMsg = "Email server connection failed. Check SMTP credentials.";
      } else if (err.message.includes("Invalid credentials")) {
        errorMsg = "Email SMTP credentials are invalid.";
      } else if (err.message.includes("timeout")) {
        errorMsg = "Email server timeout. Please try again.";
      }
      
      res.status(500).json({ message: errorMsg });
    }
  }
);

router.post(
  "/email-otp/verify",
  async (req, res) => {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ message: "email and otp are required" });
      }

      const record = await EmailOtp.findOne({ email }).sort({ createdAt: -1 });
      if (!record) {
        return res.status(400).json({ message: "OTP not found. Please request a new one." });
      }

      if (record.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ message: "OTP expired. Please request a new one." });
      }

      const match = await bcrypt.compare(String(otp), record.otpHash);
      if (!match) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      record.verifiedAt = new Date();
      await record.save();

      res.json({ message: "Email verified", otpId: record._id });
    } catch (err) {
      console.error("EMAIL OTP VERIFY ERROR:", err.message);
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  }
);

// Check if email already exists (approved or pending)
router.get(
  "/exists",
  async (req, res) => {
    try {
      const email = String(req.query.email || "").trim();
      if (!email) return res.status(400).json({ message: "email is required" });

      const approved = await ServiceProvider.findOne({ email });
      if (approved) return res.json({ exists: true, status: "approved" });

      const pending = await ProviderRequest.findOne({ email });
      if (pending) return res.json({ exists: true, status: "pending" });

      return res.json({ exists: false });
    } catch (err) {
      console.error("EMAIL EXISTS CHECK ERROR:", err.message);
      return res.status(500).json({ message: "Failed to check email" });
    }
  }
);

router.post(
  "/register",
  uploadWithCloudinary,
  async (req, res) => {
    try {
      const {
        name,
        email,
        mobile,
        qualification,
        serviceCategory,
        otherService,
        address,
        availableTime,
        experience,
        description,
        emailOtpId
      } = req.body;

      /* ===============================
         VALIDATION
      =============================== */
      if (!name || !email || !mobile || !serviceCategory || !address || !availableTime) {
        return res.status(400).json({
          message: "Missing required fields"
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({
          message: "Please enter a valid email address"
        });
      }

      const emailDomain = String(email).toLowerCase().split("@")[1] || "";
      const domainHasMx = emailDomain ? await hasMxRecord(emailDomain) : false;
      if (!domainHasMx) {
        return res.status(400).json({
          message: "Email domain does not exist. Please use a valid email address."
        });
      }

      // Validate phone number (Indian format: 10 digits, starts with 6-9)
      const mobileStr = String(mobile || "").trim();
      if (!mobileStr) {
        return res.status(400).json({
          message: "Please enter a mobile number"
        });
      }
      if (!/^\d{10}$/.test(mobileStr)) {
        return res.status(400).json({
          message: "Mobile number must be exactly 10 digits"
        });
      }
      const firstDigit = mobileStr.charAt(0);
      if (!/^[6-9]$/.test(firstDigit)) {
        return res.status(400).json({
          message: "Mobile number must start with 6, 7, 8, or 9"
        });
      }

      if (!emailOtpId) {
        return res.status(400).json({
          message: "Please verify your email with OTP before submitting."
        });
      }

      const otpRecord = await EmailOtp.findById(emailOtpId);
      if (
        !otpRecord ||
        otpRecord.email !== email ||
        !otpRecord.verifiedAt ||
        otpRecord.consumedAt ||
        otpRecord.expiresAt.getTime() < Date.now()
      ) {
        return res.status(400).json({
          message: "Email verification is invalid or expired."
        });
      }

      otpRecord.consumedAt = new Date();
      await otpRecord.save();

      // Validate "Other" service has valid custom service name
      if (serviceCategory === "Other") {
        if (!otherService || !otherService.trim()) {
          return res.status(400).json({
            message: "Please specify your service when selecting 'Other'"
          });
        }
        if (otherService.trim().length < 3) {
          return res.status(400).json({
            message: "Service name must be at least 3 characters long"
          });
        }
        if (!/^[A-Za-z\s]+$/.test(otherService)) {
          return res.status(400).json({
            message: "Service name should contain only letters and spaces"
          });
        }
      }

      /* ===============================
         DUPLICATE CHECKS (PRECISE)
      =============================== */

      // Approved providers
      const emailApproved = await ServiceProvider.findOne({ email });
      if (emailApproved) {
        return res.status(409).json({
          field: "email",
          message: "Email already registered and approved"
        });
      }

      const mobileApproved = await ServiceProvider.findOne({ mobile });
      if (mobileApproved) {
        return res.status(409).json({
          field: "mobile",
          message: "Mobile number already registered and approved"
        });
      }

      // Pending requests
      const emailPending = await ProviderRequest.findOne({ email });
      if (emailPending) {
        return res.status(409).json({
          field: "email",
          message: "Email already submitted and pending approval"
        });
      }

      const mobilePending = await ProviderRequest.findOne({ mobile });
      if (mobilePending) {
        return res.status(409).json({
          field: "mobile",
          message: "Mobile number already submitted and pending approval"
        });
      }

      /* ===============================
         GEO LOCATION
      =============================== */
      const coordinates = await getLatLng(address);

      const providerRequest = new ProviderRequest({
        name,
        email,
        mobile,
        qualification,
        serviceCategory,
        otherService: serviceCategory === "Other" ? otherService.trim() : null,
        address,
        availableTime,
        experience,
        description,

        location: {
          type: "Point",
          coordinates
        },

        profilePhoto: req.fileCloudinaryUrls?.profilePhoto || "",
        skillCertificate: req.fileCloudinaryUrls?.skillCertificate || "",

        status: "pending",
        verified: false
      });

      await providerRequest.save();

      res.status(201).json({
        message: "Registration submitted. Waiting for admin approval."
      });

    } catch (err) {
      console.error("PROVIDER REGISTER ERROR:", err.message);
      res.status(500).json({
        message: err.message || "Registration failed"
      });
    }
  }
);

module.exports = router;
