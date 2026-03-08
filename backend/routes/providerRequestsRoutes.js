const express = require("express");
const router = express.Router();
const ServiceRequest = require("../models/ServiceRequest");
const ServiceProvider = require("../models/ServiceProvider");
const Notification = require("../models/Notification");
const Customer = require("../models/Customer");
const authMiddleware = require("../middleware/authMiddleware");
const { sendRejectionEmail, sendCompletionOtpEmail, sendBookingAcceptedEmail, sendBrevoEmail } = require("../utils/sendEmail");

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

      // Service can start only after customer approves provider's final quote.
      if (request.status === "accepted" && nextStatus === "in_progress" && request.priceStatus !== "price_approved") {
        return res.status(400).json({
          message: "Submit final price and wait for customer approval before starting service"
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
            serviceName: request.serviceCategory,
            visitDate: request.visitDate,
            visitTime: convertTo12HourFormat(request.visitTime)
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

/* ================================
   SUBMIT FINAL PRICE (QUOTE)
================================ */
router.put("/submit-price/:id", authMiddleware, async (req, res) => {
  try {
    const { finalPrice } = req.body;
    const parsedPrice = Number(finalPrice);

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ message: "Valid final price is required" });
    }

    const request = await ServiceRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    const minimumAllowed = Number(request.basePrice);
    if (Number.isFinite(minimumAllowed) && minimumAllowed > 0 && parsedPrice < minimumAllowed) {
      return res.status(400).json({
        message: `Final price cannot be below starting charge (Rs ${Math.round(minimumAllowed)})`
      });
    }

    if (request.providerId.toString() !== req.providerId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (!["accepted", "in_progress"].includes(request.status)) {
      return res.status(400).json({
        message: "Final price can be submitted only for accepted/in-progress requests"
      });
    }

    request.finalPrice = Math.round(parsedPrice);
    request.priceStatus = "price_sent";
    request.priceSentAt = new Date();
    await request.save();

    await createCustomerNotification(
      request,
      `Final quote received: Rs ${request.finalPrice}. Please approve in My Orders to continue.`
    );

    const customer = await Customer.findById(request.customerId).select("email name");
    if (customer?.email) {
      queueEmail(
        sendBrevoEmail({
          to: customer.email,
          subject: "Final Quote Received - Oibre",
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fb; margin: 0; padding: 0; }
                  .container { max-width: 620px; margin: 24px auto; }
                  .header { background: #1f2937; color: #fff; padding: 28px 24px; border-radius: 10px 10px 0 0; text-align: center; }
                  .logo { font-size: 34px; font-weight: 700; margin: 0; }
                  .badge { display: inline-block; margin-top: 12px; background: #2563eb; color: #fff; padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; }
                  .content { background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; padding: 24px; }
                  .title { margin: 0 0 12px; color: #111827; font-size: 22px; font-weight: 700; }
                  .subtitle { margin: 0 0 18px; color: #4b5563; line-height: 1.6; font-size: 15px; }
                  .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin: 16px 0; }
                  .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; margin: 0; font-weight: 700; }
                  .value { color: #111827; font-size: 15px; margin: 4px 0 12px; }
                  .price-box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; border-radius: 0 8px 8px 0; text-align: center; margin: 16px 0; }
                  .price { font-size: 32px; font-weight: 700; color: #2563eb; margin: 8px 0; }
                  .cta-wrap { text-align: center; margin: 24px 0 10px; }
                  .cta { display: inline-block; background: #2563eb; color: #fff !important; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 700; font-size: 14px; }
                  .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 14px; color: #6b7280; font-size: 12px; line-height: 1.6; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 class="logo">Oibre</h1>
                    <div class="badge">Final Quote Received</div>
                  </div>
                  <div class="content">
                    <h2 class="title">Hi ${customer.name || request.customerName || "Customer"},</h2>
                    <p class="subtitle">Your service provider has sent the final quote for <strong>${request.serviceCategory}</strong>.</p>
                    <div class="price-box">
                      <p style="margin: 0; font-size: 14px; color: #1e40af; font-weight: 600;">Final Quote Amount</p>
                      <div class="price">₹${request.finalPrice}</div>
                    </div>
                    <div class="card">
                      <p class="label">Service</p>
                      <p class="value">${request.serviceCategory || "-"}</p>
                      <p class="label">Provider</p>
                      <p class="value">${request.providerName || "-"}</p>
                    </div>
                    <p style="color: #374151; font-size: 14px; margin: 16px 0;">Open your <strong>My Orders</strong> page to review and approve the quote to proceed with the service.</p>
                    <div class="cta-wrap">
                      <a class="cta" href="${process.env.CUSTOMER_APP_URL || "https://oibre-customer-frontend.vercel.app"}/orders">View My Orders</a>
                    </div>
                    <div class="footer">
                      This is an automated email from Oibre.<br />
                      Please approve the quote to continue with your service booking.
                    </div>
                  </div>
                </div>
              </body>
            </html>
          `
        }),
        "PRICE QUOTE"
      );
    }

    return res.json({
      message: "Final price sent to customer",
      request: {
        id: request._id,
        finalPrice: request.finalPrice,
        priceStatus: request.priceStatus,
        priceSentAt: request.priceSentAt
      }
    });
  } catch (err) {
    console.error("Submit final price error:", err);
    return res.status(500).json({ message: "Failed to submit final price" });
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
      "Your service is marked completed. Please leave a review!"
    );

    // Send completion email to customer
    const customer = await Customer.findById(request.customerId).select("email name");
    if (customer?.email) {
      queueEmail(
        sendBrevoEmail({
          to: customer.email,
          subject: "Service Completed - Oibre",
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fb; margin: 0; padding: 0; }
                  .container { max-width: 620px; margin: 24px auto; }
                  .header { background: #1f2937; color: #fff; padding: 28px 24px; border-radius: 10px 10px 0 0; text-align: center; }
                  .logo { font-size: 34px; font-weight: 700; margin: 0; }
                  .badge { display: inline-block; margin-top: 12px; background: #10b981; color: #fff; padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; }
                  .content { background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; padding: 24px; }
                  .title { margin: 0 0 12px; color: #111827; font-size: 22px; font-weight: 700; }
                  .subtitle { margin: 0 0 18px; color: #4b5563; line-height: 1.6; font-size: 15px; }
                  .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin: 16px 0; }
                  .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; margin: 0; font-weight: 700; }
                  .value { color: #111827; font-size: 15px; margin: 4px 0 12px; }
                  .success-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0; }
                  .cta-wrap { text-align: center; margin: 24px 0 10px; }
                  .cta { display: inline-block; background: #10b981; color: #fff !important; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 700; font-size: 14px; }
                  .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 14px; color: #6b7280; font-size: 12px; line-height: 1.6; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 class="logo">Oibre</h1>
                    <div class="badge">✓ Service Completed</div>
                  </div>
                  <div class="content">
                    <h2 class="title">Hi ${customer.name || request.customerName || "Customer"},</h2>
                    <p class="subtitle">Great news! Your <strong>${request.serviceCategory}</strong> service has been marked as completed.</p>
                    <div class="success-box">
                      <p style="margin: 0; color: #065f46; font-weight: 600; font-size: 14px;">✓ Service completion verified successfully</p>
                    </div>
                    <div class="card">
                      <p class="label">Service</p>
                      <p class="value">${request.serviceCategory || "-"}</p>
                      <p class="label">Provider</p>
                      <p class="value">${request.providerName || "-"}</p>
                      <p class="label">Amount Paid</p>
                      <p class="value">₹${request.finalPrice || "-"}</p>
                    </div>
                    <p style="color: #374151; font-size: 14px; margin: 16px 0;">We hope you're satisfied with the service! Please take a moment to leave a review and help others make informed decisions.</p>
                    <div class="cta-wrap">
                      <a class="cta" href="${process.env.CUSTOMER_APP_URL || "https://oibre-customer-frontend.vercel.app"}/orders">Leave a Review</a>
                    </div>
                    <div class="footer">
                      Thank you for choosing Oibre!<br />
                      Need help? Contact our support team anytime.
                    </div>
                  </div>
                </div>
              </body>
            </html>
          `
        }),
        "SERVICE COMPLETED"
      );
    }

    // Send notification to provider
    const provider = await ServiceProvider.findById(request.providerId).select("email name");
    if (provider?.email) {
      queueEmail(
        sendBrevoEmail({
          to: provider.email,
          subject: "Service Marked Complete - Oibre",
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fb; margin: 0; padding: 0; }
                  .container { max-width: 620px; margin: 24px auto; }
                  .header { background: #1f2937; color: #fff; padding: 28px 24px; border-radius: 10px 10px 0 0; text-align: center; }
                  .logo { font-size: 34px; font-weight: 700; margin: 0; }
                  .badge { display: inline-block; margin-top: 12px; background: #10b981; color: #fff; padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; }
                  .content { background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; padding: 24px; }
                  .title { margin: 0 0 12px; color: #111827; font-size: 22px; font-weight: 700; }
                  .subtitle { margin: 0 0 18px; color: #4b5563; line-height: 1.6; font-size: 15px; }
                  .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin: 16px 0; }
                  .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; margin: 0; font-weight: 700; }
                  .value { color: #111827; font-size: 15px; margin: 4px 0 12px; }
                  .success-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0; color: #065f46; }
                  .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 14px; color: #6b7280; font-size: 12px; line-height: 1.6; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 class="logo">Oibre</h1>
                    <div class="badge">✓ Booking Complete</div>
                  </div>
                  <div class="content">
                    <h2 class="title">Hi ${provider.name || "Provider"},</h2>
                    <p class="subtitle">Your service booking has been successfully marked as completed!</p>
                    <div class="success-box">
                      <p style="margin: 0; font-weight: 600;">✓ OTP verified - Service completion confirmed</p>
                    </div>
                    <div class="card">
                      <p class="label">Service</p>
                      <p class="value">${request.serviceCategory || "-"}</p>
                      <p class="label">Customer</p>
                      <p class="value">${request.customerName || "-"}</p>
                      <p class="label">Amount</p>
                      <p class="value">₹${request.finalPrice || "-"}</p>
                    </div>
                    <p style="color: #374151; font-size: 14px; margin: 16px 0;">Payment settlement will be processed by admin. Check your earnings dashboard to track payout status.</p>
                    <div class="footer">
                      Thank you for providing quality service through Oibre!<br />
                      View your earnings in the provider dashboard.
                    </div>
                  </div>
                </div>
              </body>
            </html>
          `
        }),
        "PROVIDER COMPLETION"
      );
    }

    return res.json({ message: "Service marked completed successfully" });
  } catch (err) {
    console.error("Verify completion OTP error:", err);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
});

module.exports = router;
