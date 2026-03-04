const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const { sendBrevoEmail } = require("../utils/sendEmail");
const crypto = require("crypto");
const Customer = require("../models/Customer");
const EmailOtp = require("../models/EmailOtp");
const customerAuth = require("../middleware/customerAuth");

const router = express.Router();
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const isGmail = (email) =>
  /@gmail\.com$/i.test(String(email || "")) ||
  /@googlemail\.com$/i.test(String(email || ""));

const createMailer = () => {
  // Brevo API is used via sendBrevoEmail - no SMTP transporter needed
  return null;
};

const sendOtpEmail = async ({ to, otp }) => {
  const subject = "Oibre - Customer Signup Verification Code";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
          .container { max-width: 500px; margin: 20px auto; padding: 0; }
          .header { background: #1f2937; color: white; text-align: center; padding: 24px; border-radius: 8px 8px 0 0; }
          .logo { font-size: 28px; font-weight: 700; margin: 0; }
          .badge { display: inline-block; background: #10b981; color: white; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-top: 8px; letter-spacing: 0.5px; }
          .content { background: white; padding: 32px 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
          .greeting { color: #374151; font-size: 16px; margin: 0 0 16px 0; font-weight: 500; }
          .description { color: #6b7280; font-size: 14px; margin: 0 0 16px 0; line-height: 1.6; }
          .purpose-box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 0 4px 4px 0; margin: 20px 0; }
          .purpose-label { color: #1e40af; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0; }
          .purpose-text { color: #3730a3; font-size: 14px; font-weight: 600; margin: 0; }
          .code-section { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 24px; border-radius: 8px; border: 2px dashed #10b981; text-align: center; margin: 24px 0; }
          .code-label { color: #166534; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0; font-weight: 700; }
          .code { font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #059669; font-family: 'Courier New', monospace; margin: 0; }
          .instructions { background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0; }
          .step { color: #374151; font-size: 13px; margin: 8px 0; padding-left: 20px; position: relative; }
          .step:before { content: "→"; position: absolute; left: 0; color: #2563eb; font-weight: 700; }
          .expiry-info { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 12px 16px; border-radius: 0 4px 4px 0; color: #92400e; font-size: 13px; margin: 20px 0; }
          .warning { background: #fee2e2; border-left: 3px solid #dc2626; padding: 12px 16px; border-radius: 0 4px 4px 0; color: #991b1b; font-size: 13px; margin: 20px 0; }
          .footer { color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Oibre</div>
            <div class="badge">✓ Customer Signup</div>
          </div>
          <div class="content">
            <p class="greeting">Welcome to Oibre! 👋</p>
            
            <div class="purpose-box">
              <div class="purpose-label">📋 What is this?</div>
              <div class="purpose-text">Your One-Time Password (OTP) for Customer Signup</div>
            </div>

            <p class="description">
              Thank you for signing up! Please use the verification code below to complete your customer account registration.
            </p>
            
            <div class="code-section">
              <div class="code-label">Your Customer Signup OTP:</div>
              <div class="code">${otp}</div>
            </div>

            <div class="instructions">
              <div style="color: #6b7280; font-size: 12px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">How to Use:</div>
              <div class="step">Go back to the signup form</div>
              <div class="step">Paste or enter this 6-digit code</div>
              <div class="step">Click "Verify OTP" to complete signup</div>
            </div>

            <div class="expiry-info">
              ⏱️ <strong>Valid for 10 minutes only</strong> - This code will expire on first use after verification
            </div>

            <div class="warning">
              🔐 <strong>Never share this code!</strong> Oibre support will never ask for your OTP. This is only for your account verification.
            </div>

            <p style="color: #6b7280; font-size: 13px; margin: 20px 0 0 0;">
              <strong>After verification, you'll be able to:</strong><br>
              ✓ Browse verified local service providers<br>
              ✓ Post service requests and connect with professionals<br>
              ✓ Track service requests in real-time<br>
              ✓ Rate and review service providers<br>
            </p>

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
    if (!result.sent) {
      console.error("CUSTOMER OTP EMAIL ERROR:", result.reason);
    }
  } catch (err) {
    console.error("CUSTOMER OTP EMAIL ERROR:", err?.message || err);
  }
};

const generateOtp = () => String(crypto.randomInt(100000, 999999));

/* ===============================
   FREE GEO CODING (OpenStreetMap)
=============================== */
const getLatLng = async (address, locality) => {
  const queries = [
    address,
    `${locality}, Goa, India`,
    "Vasco da Gama, Goa, India"
  ];

  for (const q of queries) {
    try {
      const res = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            q,
            format: "json",
            limit: 1
          },
          headers: {
            "User-Agent": "Oibre-App/1.0 (contact: dev@oibre.com)"
          },
          timeout: 10000
        }
      );

      if (res.data && res.data.length > 0) {
        return [
          parseFloat(res.data[0].lon),
          parseFloat(res.data[0].lat)
        ];
      }
    } catch (err) {
      // Silently fail and try next query
    }
  }

  throw new Error("Address could not be located");
};

/* =========================
   EMAIL OTP
========================= */
router.post("/email-otp/send", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if email already exists in registered customers
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(409).json({ message: "Email already registered. Please login or use another email." });
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

    sendOtpEmail({ to: email, otp }).catch((err) => {
      console.error("EMAIL OTP BACKGROUND SEND ERROR:", err?.message || err);
    });

    res.json({ message: "OTP generated and email is being sent" });
  } catch (err) {
    console.error("EMAIL OTP SEND ERROR:", err.message);
    res.status(500).json({ message: "Failed to send OTP", error: err.message });
  }
});

router.post("/email-otp/verify", async (req, res) => {
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
});



/* =========================
   SIGNUP
========================= */
router.post("/register", async (req, res) => {
  try {
    const { name, email, mobile, password, locality, address, emailOtpId } = req.body;

    if (await Customer.findOne({ mobile })) {
      return res.status(400).json({ message: "Mobile already registered" });
    }

    if (email && await Customer.findOne({ email })) {
      return res.status(400).json({ message: "Email already registered" });
    }

    if (email && !isGmail(email)) {
      if (!emailOtpId) {
        return res.status(400).json({
          message: "Please verify your email with OTP before signup."
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
    }

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : null;

    const coordinates = await getLatLng(address, locality);
    console.log("CUSTOMER COORDINATES:", coordinates);

    const customer = new Customer({
      name,
      email: email || null,
      mobile,
      password: hashedPassword,
      locality,
      address,
      location: {
        type: "Point",
        coordinates
      }
    });

    await customer.save();
    res.json({ message: "Signup successful" });

  } catch (err) {
    console.error("REGISTER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});


/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
  try {
    const { mobile, password } = req.body;

    const customer = await Customer.findOne({ mobile }).select("+password");
    if (!customer) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!customer.password) {
      return res.status(400).json({ message: "Please login using Google" });
    }

    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: customer._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, customer });

  } catch {
    res.status(500).json({ message: "Login failed" });
  }
});

/* =========================
   GET LOGGED IN CUSTOMER
========================= */
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const customer = await Customer.findById(decoded.id).select("-password");

    res.json(customer);
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
});

/* =========================
   GET CUSTOMER PROFILE (ALIAS)
========================= */
router.get("/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const customer = await Customer.findById(decoded.id).select("-password");

    res.json(customer);
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
});

/* =========================
   UPDATE CUSTOMER PROFILE
========================= */
router.put("/profile", customerAuth, async (req, res) => {
  try {
    const {
      name = "",
      email = "",
      mobile = "",
      address = ""
    } = req.body || {};

    const nextName = String(name).trim();
    const nextEmail = String(email).trim().toLowerCase();
    const nextMobile = String(mobile).trim();
    const nextAddress = String(address).trim();

    if (!nextName || !nextMobile || !nextAddress) {
      return res.status(400).json({
        message: "Name, mobile and address are required"
      });
    }

    if (!/^[6-9]\d{9}$/.test(nextMobile)) {
      return res.status(400).json({
        message: "Mobile number must be a valid 10-digit Indian number"
      });
    }

    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address"
      });
    }

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const duplicateMobile = await Customer.findOne({
      _id: { $ne: customer._id },
      mobile: nextMobile
    });
    if (duplicateMobile) {
      return res.status(409).json({ message: "Mobile number already in use" });
    }

    if (nextEmail) {
      const duplicateEmail = await Customer.findOne({
        _id: { $ne: customer._id },
        email: nextEmail
      });
      if (duplicateEmail) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    const localityForGeocode = String(customer.locality || "").trim();
    const addressChanged = nextAddress !== String(customer.address || "").trim();
    if (addressChanged) {
      try {
        const coordinates = await getLatLng(nextAddress, localityForGeocode || "Goa");
        customer.location = {
          type: "Point",
          coordinates
        };
      } catch (err) {
        return res.status(400).json({
          message: "Address could not be located. Please enter a valid address."
        });
      }
    }

    customer.name = nextName;
    customer.email = nextEmail || null;
    customer.mobile = nextMobile;
    customer.address = nextAddress;

    await customer.save();

    const updated = await Customer.findById(customer._id).select("-password");
    return res.json({
      message: "Profile updated successfully",
      customer: updated
    });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err.message);
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

/* =========================
   UPDATE CUSTOMER LOCATION
========================= */
router.put("/location", customerAuth, async (req, res) => {
  try {
    const { lat, lng, address, locality } = req.body || {};

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: "Valid latitude and longitude are required" });
    }

    if (!address || !String(address).trim() || !locality || !String(locality).trim()) {
      return res.status(400).json({ message: "Address and locality are required" });
    }

    const customer = await Customer.findByIdAndUpdate(
      req.customerId,
      {
        address: String(address).trim(),
        locality: String(locality).trim(),
        location: {
          type: "Point",
          coordinates: [longitude, latitude]
        }
      },
      { new: true }
    ).select("-password");

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json({
      message: "Location updated successfully",
      customer
    });
  } catch (err) {
    console.error("UPDATE CUSTOMER LOCATION ERROR:", err.message);
    res.status(500).json({ message: "Failed to update location" });
  }
});

/* =========================
   CHANGE PASSWORD (LOCAL ONLY)
========================= */
router.put("/change-password", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const customer = await Customer.findById(decoded.id).select("+password authProvider");

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (customer.authProvider === "google" || !customer.password) {
      return res.status(403).json({
        message: "Password change is not available for Google login accounts"
      });
    }

    const isMatch = await bcrypt.compare(String(currentPassword), customer.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const isSameAsOld = await bcrypt.compare(String(newPassword), customer.password);
    if (isSameAsOld) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    customer.password = await bcrypt.hash(String(newPassword), 10);
    await customer.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err.message);
    res.status(500).json({ message: "Failed to change password" });
  }
});

/* =========================
   CHANGE EMAIL - SEND OTP
========================= */
router.post("/change-email/send-otp", customerAuth, async (req, res) => {
  try {
    const { newEmail } = req.body;
    
    if (!newEmail) {
      return res.status(400).json({ message: "New email is required" });
    }

    const cleanEmail = String(newEmail).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (cleanEmail === customer.email) {
      return res.status(400).json({ message: "New email must be different from current email" });
    }

    const existingEmail = await Customer.findOne({
      _id: { $ne: customer._id },
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
                <p>Hello,</p>
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

/* =========================
   CHANGE EMAIL - VERIFY OTP
========================= */
router.post("/change-email/verify-otp", customerAuth, async (req, res) => {
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

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    customer.email = cleanEmail;
    await customer.save();

    await EmailOtp.deleteOne({ _id: record._id });

    const updated = await Customer.findById(customer._id).select("-password");
    res.json({
      message: "Email changed successfully",
      customer: updated
    });
  } catch (err) {
    console.error("CHANGE EMAIL VERIFY OTP ERROR:", err.message);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
});

/* =========================
   GOOGLE LOGIN (UNCHANGED)
========================= */
router.post("/google-login", async (req, res) => {
  try {
    const { email } = req.body;

    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(404).json({ message: "Email not registered" });
    }

    const token = jwt.sign(
      { id: customer._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, customer });
  } catch {
    res.status(500).json({ message: "Google login failed" });
  }
});

module.exports = router;
