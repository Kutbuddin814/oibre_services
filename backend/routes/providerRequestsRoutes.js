const express = require("express");
const router = express.Router();
const ServiceRequest = require("../models/ServiceRequest");
const ServiceProvider = require("../models/ServiceProvider");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/authMiddleware");
const { sendRejectionEmail, sendCompletionOtpEmail, sendBookingAcceptedEmail } = require("../utils/sendEmail");

const MAX_DATE_FORWARD_DAYS = 2;

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

const parseDateOnly = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    const date = new Date(Date.UTC(y, m - 1, d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const m = Number(slashMatch[1]);
    const d = Number(slashMatch[2]);
    const y = Number(slashMatch[3]);
    const date = new Date(Date.UTC(y, m - 1, d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const maskEmail = (email) => {
  if (!email || typeof email !== "string" || !email.includes("@")) return "";
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const head = name.slice(0, 2);
  return `${head}${"*".repeat(Math.max(name.length - 2, 1))}@${domain}`;
};

const createCustomerNotification = async (request, message) => {
  if (!request?.customerId || !message) return;
  try {
    await Notification.create({
      customerId: request.customerId,
      customerName: request.customerName || "",
      bookingId: request._id,
      message
    });
  } catch (err) {
    console.error("Failed to create customer notification:", err);
  }
};

const queueEmail = (promise, label) => {
  Promise.resolve(promise).catch((err) => {
    console.error(`${label} EMAIL ERROR:`, err?.message || err);
  });
};

/* ================================
   GET REQUESTS FOR LOGGED PROVIDER
================================ */
router.get("/my-requests", authMiddleware, async (req, res) => {
  try {
    const requests = await ServiceRequest.find({
      providerId: req.providerId,
    }).sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (err) {
    console.error("Fetch requests error:", err);
    res.status(500).json({ message: "Failed to fetch requests" });
  }
});

/* ================================
   ACCEPT & SCHEDULE REQUEST
================================ */
router.put("/update/:id", authMiddleware, async (req, res) => {
  const { visitDate, visitTime, providerNote, status } = req.body;

  try {
    const request = await ServiceRequest.findById(req.params.id);
    const previousStatus = request?.status;

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.providerId.toString() !== req.providerId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const nextStatus = status || request.status;

    // Completion is OTP-gated: first send OTP while keeping status in_progress.
    if (nextStatus === "completed") {
      if (request.status !== "in_progress") {
        return res.status(400).json({
          message: "Completion OTP can be sent only when request is in progress"
        });
      }
      if (!request.customerEmail) {
        return res.status(400).json({
          message: "Customer email is missing for this booking. Cannot send OTP."
        });
      }
      if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return res.status(500).json({
          message: "Email service is not configured on provider backend."
        });
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      request.completionOtp = otp;
      request.completionOtpSentAt = new Date();
      request.completionOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      if (providerNote !== undefined) request.providerNote = providerNote;
      await request.save();

      sendCompletionOtpEmail(request.customerEmail, request.customerName, otp).catch((emailErr) => {
        console.error("Failed to send completion OTP email:", emailErr?.message || emailErr);
      });

      await createCustomerNotification(
        request,
        "Completion OTP has been sent to your email. Share it with provider only after service is done."
      );

      return res.json({
        message: "Completion OTP generated. Email is being sent to customer.",
        otpRequired: true,
        otpSentTo: maskEmail(request.customerEmail)
      });
    }

    const allowedTransitions = {
      pending: ["accepted", "cancelled"],
      accepted: ["in_progress", "cancelled"],
      in_progress: ["cancelled"],
      completed: [],
      cancelled: []
    };

    if (nextStatus !== request.status) {
      const allowed = allowedTransitions[request.status] || [];
      if (!allowed.includes(nextStatus)) {
        return res.status(400).json({
          message: `Invalid status transition from ${request.status} to ${nextStatus}`
        });
      }
      request.status = nextStatus;
    }

    if (visitDate !== undefined) request.visitDate = visitDate;
    if (visitTime !== undefined) request.visitTime = visitTime;
    if (providerNote !== undefined) request.providerNote = providerNote;

    if (request.status === "cancelled") {
      const reason = String(request.providerNote || "").trim();
      if (!reason) {
        return res.status(400).json({ message: "Cancellation reason is required" });
      }
      request.providerNote = reason;
    }

    if (request.status === "accepted" && (!request.visitDate || !request.visitTime)) {
      return res.status(400).json({ message: "Visit date and time are required to accept request" });
    }

    if (request.status === "accepted" && request.visitDate === getTodayIsoLocal()) {
      const selectedMinutes = parseTimeToMinutes(request.visitTime);
      const nowMinutes = getCurrentMinutesLocal();
      if (selectedMinutes !== null && selectedMinutes < nowMinutes) {
        return res.status(400).json({
          message: "Visit time cannot be in the past for today"
        });
      }
    }

    // Keep provider selected date near customer's preferred date (forward only).
    // Time can vary freely, but date cannot go backward.
    if (request.status === "accepted" && request.visitDate && request.preferredDate) {
      const preferred = parseDateOnly(request.preferredDate);
      const selected = parseDateOnly(request.visitDate);

      if (!preferred || !selected) {
        return res.status(400).json({
          message: "Invalid visit or preferred date format"
        });
      }

      const diffDays = Math.round(
        (selected.getTime() - preferred.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays < 0 || diffDays > MAX_DATE_FORWARD_DAYS) {
        return res.status(400).json({
          message: `Visit date must be between preferred date and ${MAX_DATE_FORWARD_DAYS} days after it`
        });
      }
    }

    await request.save();

    if (request.status !== previousStatus) {
      if (request.status === "accepted") {
        const provider = await ServiceProvider.findById(req.providerId).select("mobile name");

        await createCustomerNotification(
          request,
          `Your booking is accepted. Scheduled for ${request.visitDate} at ${convertTo12HourFormat(request.visitTime)}.`
        );

        queueEmail(
          sendBookingAcceptedEmail({
            to: request.customerEmail,
            customerName: request.customerName,
            providerName: provider?.name || request.providerName,
            providerMobile: provider?.mobile || "",
            visitDate: request.visitDate,
            visitTime: convertTo12HourFormat(request.visitTime),
            serviceCategory: request.serviceCategory
          }),
          "BOOKING ACCEPTED"
        );
      } else if (request.status === "in_progress") {
        await createCustomerNotification(
          request,
          "Your provider has started the service (In Progress)."
        );
      } else if (request.status === "cancelled") {
        await createCustomerNotification(
          request,
          `Your booking was cancelled by provider. Reason: ${request.providerNote}`
        );
      }
    }

    // If provider rejected/cancelled the request, send an email to customer (if available)
    if (request.status === "cancelled") {
      queueEmail(
        sendRejectionEmail(request.customerEmail, request.customerName, providerNote),
        "BOOKING REJECTED"
      );
    }

    res.json({ message: "Request updated successfully" });
  } catch (err) {
    console.error("Update request error:", err);
    res.status(500).json({ message: "Update failed" });
  }
});

router.post("/verify-completion/:id", authMiddleware, async (req, res) => {
  try {
    const otp = String(req.body?.otp || "").trim();
    if (!otp) {
      return res.status(400).json({ message: "OTP is required" });
    }

    const request = await ServiceRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.providerId.toString() !== req.providerId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (request.status !== "in_progress") {
      return res.status(400).json({ message: "Only in-progress requests can be completed" });
    }

    if (!request.completionOtp || !request.completionOtpExpiresAt) {
      return res.status(400).json({ message: "Completion OTP not generated. Send OTP first." });
    }

    if (request.completionOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired. Send a new OTP." });
    }

    if (request.completionOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    request.status = "completed";
    request.completedAt = new Date();
    request.completionOtpVerifiedAt = new Date();
    request.completionOtp = undefined;
    request.completionOtpExpiresAt = undefined;
    await request.save();

    await createCustomerNotification(
      request,
      "Your service is marked completed after OTP verification."
    );

    return res.json({ message: "Service marked completed successfully" });
  } catch (err) {
    console.error("Verify completion OTP error:", err);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
});

module.exports = router;
