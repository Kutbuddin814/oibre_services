const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { sendBrevoEmail } = require("../utils/sendEmail");
const ServiceRequest = require("../models/ServiceRequest");
const Customer = require("../models/Customer");
const ServiceProvider = require("../models/ServiceProvider");
const Review = require("../models/Review");
const Notification = require("../models/Notification");
const customerAuth = require("../middleware/customerAuth");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const problemUploadDir = path.join(__dirname, "../uploads/service-problem-images");
if (!fs.existsSync(problemUploadDir)) {
  fs.mkdirSync(problemUploadDir, { recursive: true });
}

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

const bookingImageStorage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => ({
        folder: "oibre/service-problem-images",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        public_id: `problem_${Date.now()}_${Math.round(Math.random() * 1e6)}`
      })
    })
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, problemUploadDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
        cb(null, `problem_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
      }
    });

const bookingImageUpload = multer({
  storage: bookingImageStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  }
});

/**
 * Converts 24-hour time string (HH:MM) to 12-hour format with AM/PM
 */
const convertTo12HourFormat = (time24) => {
  if (!time24 || typeof time24 !== "string") return time24;

  // Check if it's already in 12-hour format
  if (/AM|PM/i.test(time24)) {
    return time24;
  }

  const parts = time24.split(":");
  if (parts.length < 2) return time24;

  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];

  if (isNaN(hours)) return time24;

  const meridiem = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${hours}:${minutes} ${meridiem}`;
};

const getTodayIsoLocal = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseTimeToMinutes = (value) => {
  if (!value || typeof value !== "string" || !value.includes(":")) return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const getCurrentMinutesLocal = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

const createMailer = () => {
  // Brevo API is used via sendBrevoEmail - no SMTP transporter needed
  return null;
};

const sendProviderBookingEmail = async ({ provider, customer, request }) => {
  if (!provider?.email) return;

  const providerPortalUrl = process.env.REACT_APP_PROVIDER_WEB_API_URL || "http://localhost:3000";

  const prettyDate = (() => {
    try {
      return new Date(request.preferredDate).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch {
      return request.preferredDate;
    }
  })();

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fb; margin: 0; padding: 0; }
          .container { max-width: 620px; margin: 24px auto; }
          .header { background: #1f2937; color: #fff; padding: 28px 24px; border-radius: 10px 10px 0 0; text-align: center; }
          .logo { font-size: 34px; font-weight: 700; line-height: 1; margin: 0; }
          .badge { display: inline-block; margin-top: 12px; background: #10b981; color: #fff; padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; }
          .content { background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; padding: 24px; }
          .title { margin: 0 0 12px; color: #111827; font-size: 22px; font-weight: 700; }
          .subtitle { margin: 0 0 18px; color: #4b5563; line-height: 1.6; font-size: 15px; }
          .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin: 16px 0; }
          .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; margin: 0; font-weight: 700; }
          .value { color: #111827; font-size: 15px; margin: 4px 0 12px; line-height: 1.5; }
          .problem { white-space: pre-wrap; }
          .cta-wrap { text-align: center; margin: 24px 0 10px; }
          .cta { display: inline-block; background: #2563eb; color: #fff !important; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 700; font-size: 14px; }
          .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 14px; color: #6b7280; font-size: 12px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="logo">Oibre</h1>
            <div class="badge">New Booking Request</div>
          </div>

          <div class="content">
            <h2 class="title">Hi ${provider.name}, you have a new request.</h2>
            <p class="subtitle">
              A customer has submitted a service booking. Review the details below and respond from your provider dashboard.
            </p>

            <div class="card">
              <p class="label">Customer</p>
              <p class="value">${customer.name}</p>

              <p class="label">Phone</p>
              <p class="value">${customer.mobile || "-"}</p>

              <p class="label">Email</p>
              <p class="value">${customer.email || "-"}</p>

              <p class="label">Service</p>
              <p class="value">${request.serviceCategory || "-"}</p>

              <p class="label">Preferred Date</p>
              <p class="value">${prettyDate}</p>

              <p class="label">Preferred Time</p>
              <p class="value">${convertTo12HourFormat(request.preferredTime)}</p>

              <p class="label">Address</p>
              <p class="value">${request.address || "-"}</p>

              <p class="label">Problem Description</p>
              <p class="value problem">${request.problemDescription || "-"}</p>
            </div>

            <div class="cta-wrap">
              <a class="cta" href="${providerPortalUrl}" target="_blank" rel="noreferrer">Open Provider Dashboard</a>
            </div>

            <div class="footer">
              This is an automated email from Oibre.<br />
              Please login to your provider account to accept or manage the request.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const result = await sendBrevoEmail({
      to: provider.email,
      subject: `New Service Request from ${customer.name}`,
      html
    });
    if (!result.sent) {
      console.error(`❌ Failed to send booking email to ${provider.email}:`, result.reason);
    }
  } catch (err) {
    console.error(`❌ Failed to send booking email:`, err?.message || err);
  }
};

const sendProviderCancellationEmail = async ({ provider, request, reason }) => {
  if (!provider?.email) return;

  const prettyDate = (() => {
    try {
      return new Date(request.preferredDate).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch {
      return request.preferredDate;
    }
  })();

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fb; margin: 0; padding: 0; }
          .container { max-width: 620px; margin: 24px auto; }
          .header { background: #1f2937; color: #fff; padding: 28px 24px; border-radius: 10px 10px 0 0; text-align: center; }
          .logo { font-size: 34px; font-weight: 700; line-height: 1; margin: 0; }
          .badge { display: inline-block; margin-top: 12px; background: #ef4444; color: #fff; padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; }
          .content { background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; padding: 24px; }
          .title { margin: 0 0 12px; color: #111827; font-size: 22px; font-weight: 700; }
          .subtitle { margin: 0 0 18px; color: #4b5563; line-height: 1.6; font-size: 15px; }
          .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin: 16px 0; }
          .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; margin: 0; font-weight: 700; }
          .value { color: #111827; font-size: 15px; margin: 4px 0 12px; line-height: 1.5; }
          .reason-box { background: #fee2e2; border-left: 4px solid #dc2626; padding: 12px 14px; border-radius: 0 8px 8px 0; color: #7f1d1d; font-size: 14px; white-space: pre-wrap; }
          .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 14px; color: #6b7280; font-size: 12px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="logo">Oibre</h1>
            <div class="badge">Booking Cancelled</div>
          </div>

          <div class="content">
            <h2 class="title">Hi ${provider.name || "Provider"}, a customer cancelled a booking.</h2>
            <p class="subtitle">The customer has cancelled the service request assigned to you. See details below.</p>

            <div class="card">
              <p class="label">Customer</p>
              <p class="value">${request.customerName || "-"}</p>

              <p class="label">Service</p>
              <p class="value">${request.serviceCategory || "-"}</p>

              <p class="label">Preferred Date</p>
              <p class="value">${prettyDate || "-"}</p>

              <p class="label">Preferred Time</p>
              <p class="value">${convertTo12HourFormat(request.preferredTime) || "-"}</p>

              <p class="label">Address</p>
              <p class="value">${request.address || "-"}</p>
            </div>

            <p class="label" style="margin-bottom: 8px;">Cancellation Reason</p>
            <div class="reason-box">${reason}</div>

            <div class="footer">
              This is an automated email from Oibre.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const result = await sendBrevoEmail({
      to: provider.email,
      subject: `Booking Cancelled by Customer - ${request.serviceCategory || "Service"}`,
      html
    });
    if (!result.sent) {
      console.error(`Failed to send cancellation email to ${provider.email}:`, result.reason);
    }
  } catch (err) {
    console.error("Failed to send provider cancellation email:", err?.message || err);
  }
};

/* =========================
   CREATE SERVICE REQUEST
========================= */
router.post("/create", customerAuth, bookingImageUpload.single("problemImage"), async (req, res) => {
  try {
    const {
      providerId,
      serviceCategory,
      problemDescription,
      preferredDate,
      preferredTime,
      address: bodyAddress,
      locality: bodyLocality,
      lat: bodyLat,
      lng: bodyLng
    } = req.body;

    if (!problemDescription || !preferredDate || !preferredTime) {
      return res.status(400).json({
        message: "Problem, date and time are required"
      });
    }

    if (preferredDate === getTodayIsoLocal()) {
      const selectedMinutes = parseTimeToMinutes(preferredTime);
      const nowMinutes = getCurrentMinutesLocal();
      if (selectedMinutes !== null && selectedMinutes < nowMinutes) {
        return res.status(400).json({
          message: "Preferred time cannot be in the past for today"
        });
      }
    }

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({ message: "Invalid providerId" });
    }

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const provider = await ServiceProvider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    const request = new ServiceRequest({
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: customer.mobile,
      customerEmail: customer.email,

      providerId: provider._id,
      providerName: provider.name,   // ✅ NEW

      serviceCategory,
      problemDescription,
      problemImage: req.file?.path || req.file?.filename || "",

      // Prefer explicit location sent in body (e.g., from user's chosen location),
      // otherwise fall back to registered customer address/locality.
      address: bodyAddress || customer.address,
      locality: bodyLocality || customer.locality,
      lat: bodyLat || (customer.location?.coordinates ? customer.location.coordinates[1] : undefined),
      lng: bodyLng || (customer.location?.coordinates ? customer.location.coordinates[0] : undefined),

      preferredDate,
      preferredTime,

      status: "pending"
    });

    await request.save();

    await Notification.create({
      customerId: customer._id,
      customerName: customer.name || "",
      bookingId: request._id,
      message: `Booking request sent to ${provider.name}. Waiting for provider response.`
    });

    sendProviderBookingEmail({ provider, customer, request }).catch((mailErr) => {
      console.error("PROVIDER BOOKING EMAIL ERROR:", mailErr?.message || mailErr);
      // Email failure should not fail booking creation.
    });

    res.status(201).json({
      message: "Service request sent to provider!"
    });

  } catch (err) {
    console.error("BOOKING ERROR:", err);
    if (err?.message === "Only image files are allowed") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Booking failed" });
  }
});
/* =========================
   GET CUSTOMER ORDERS
========================= */
router.get("/my-requests", customerAuth, async (req, res) => {
  try {
    const requests = await ServiceRequest.find({
      customerId: req.customerId,
    })
      .populate("providerId", "name serviceCategory")
      .sort({ createdAt: -1 });

    // Backfill reviewed state for older bookings (before reviewed flag existed)
    const bookingIds = requests.map((r) => r._id);
    const reviewedRows = await Review.find({
      customer: req.customerId,
      booking: { $in: bookingIds }
    }).select("booking -_id");

    const reviewedBookingSet = new Set(reviewedRows.map((r) => String(r.booking)));
    const response = requests.map((r) => {
      const row = r.toObject();
      row.reviewed = Boolean(row.reviewed) || reviewedBookingSet.has(String(r._id));
      return row;
    });

    res.status(200).json(response);
  } catch (err) {
    console.error("Customer orders error:", err);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

/* =========================
   CANCEL CUSTOMER REQUEST
========================= */
router.put("/cancel/:id", customerAuth, async (req, res) => {
  try {
    const reason = String(req.body?.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ message: "Cancellation reason is required" });
    }

    const request = await ServiceRequest.findOne({
      _id: req.params.id,
      customerId: req.customerId
    });

    if (!request) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (["completed", "cancelled"].includes(request.status)) {
      return res.status(400).json({ message: `Cannot cancel a ${request.status} booking` });
    }

    request.status = "cancelled";
    request.customerCancelReason = reason;
    request.completionOtp = undefined;
    request.completionOtpSentAt = undefined;
    request.completionOtpExpiresAt = undefined;

    await request.save();

    await Notification.create({
      customerId: req.customerId,
      customerName: request.customerName || "",
      bookingId: request._id,
      message: "Your booking was cancelled successfully."
    });

    const provider = await ServiceProvider.findById(request.providerId).select("name email");
    if (provider?.email) {
      sendProviderCancellationEmail({ provider, request, reason }).catch((mailErr) => {
        console.error("PROVIDER CANCELLATION EMAIL ERROR:", mailErr?.message || mailErr);
      });
    }

    return res.json({
      message: "Booking cancelled successfully",
      request
    });
  } catch (err) {
    console.error("CUSTOMER CANCEL REQUEST ERROR:", err);
    return res.status(500).json({ message: "Failed to cancel booking" });
  }
});

module.exports = router;
