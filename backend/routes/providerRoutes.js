const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const dns = require("dns").promises;
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

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
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // If SMTP is not configured, return null so caller can fallback to dev logging.
  if (!host || !port || !user || !pass) {
    console.warn("SMTP credentials are not configured. Email sending will be disabled (dev fallback).");
    return null;
  }

  const isSecure = port === 465;
  const isPort587 = port === 587;

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    requireTLS: isPort587,
    auth: { user, pass },
    connectionTimeout: 5000,
    socketTimeout: 5000,
    pool: {
      maxConnections: 1,
      maxMessages: 5,
      rateDelta: 2000
    }
  });
};

const sendOtpEmail = async ({ to, otp }) => {
  const transporter = createMailer();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!transporter) {
    // Development fallback: log OTP to console. Do NOT enable this behaviour in production.
    console.warn(`⚠️ DEV OTP for ${to}: ${otp}`);
    console.warn(`⚠️ Email sending disabled! Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env`);
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
    await transporter.sendMail({
      from,
      to,
      subject,
      html
    });
    console.log(`✅ OTP email sent successfully to ${to}`);
    return { sentByEmail: true };
  } catch (err) {
    console.error("❌ PROVIDER OTP EMAIL ERROR:", err?.message || err);
    return { sentByEmail: false, error: err?.message };
  }
};

const generateOtp = () => String(crypto.randomInt(100000, 999999));

/* ===============================
   MULTER CONFIG
=============================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) => {
    const ext = file.originalname.split(".").pop();
    cb(null, `${Date.now()}-${file.fieldname}.${ext}`);
  }
});
const upload = multer({ storage });

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


      await EmailOtp.create({
        email,
        otpHash,
        expiresAt
      });

      const sendResult = await sendOtpEmail({ to: email, otp });

      if (sendResult.sentByEmail) {
        return res.json({ message: "OTP sent successfully to your email" });
      }

      // If email not sent because SMTP isn't configured
      if (process.env.NODE_ENV === "production") {
        console.error("❌ PRODUCTION: Email cannot be sent. SMTP credentials not configured!");
        return res.status(500).json({ 
          message: "Email service is temporarily unavailable. Please contact support."
        });
      }

      // Development mode fallback
      console.log(`🔧 DEV MODE: OTP=${otp} for ${email}`);
      return res.json({ 
        message: "OTP generated (dev mode). Check server logs for OTP.",
        otp: otp,
        warning: "Email not sent - SMTP not configured"
      });
    } catch (err) {
      console.error("EMAIL OTP SEND ERROR:", err.message);
      res.status(500).json({ message: "Failed to send OTP" });
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
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "skillCertificate", maxCount: 1 }
  ]),
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

        profilePhoto: req.files?.profilePhoto?.[0]?.filename,
        skillCertificate: req.files?.skillCertificate?.[0]?.filename,

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
