const express = require("express");
const nodemailer = require("nodemailer");
const ContactMessage = require("../models/ContactMessage");

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s-]{8,20}$/;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createMailer = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 10000
  });
};

const sendContactEmails = async (payload) => {
  const transporter = createMailer();
  if (!transporter) return;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const notifyTo = process.env.CONTACT_NOTIFY_EMAIL || "oibre38@gmail.com";
  const safeName = escapeHtml(payload.name);
  const safeEmail = escapeHtml(payload.email);
  const safePhone = escapeHtml(payload.phone);
  const safeSubject = escapeHtml(payload.subject);
  const safeMessage = escapeHtml(payload.message).replace(/\n/g, "<br/>");

  await transporter.sendMail({
    from,
    to: notifyTo,
    subject: `[Contact] ${payload.subject}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f3f4f6;padding:18px;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#111827;color:#ffffff;padding:18px 22px;">
            <h2 style="margin:0;font-size:24px;">Oibre</h2>
            <p style="margin:8px 0 0;font-size:13px;opacity:.9;">New Contact Message</p>
          </div>
          <div style="padding:18px 22px;">
            <p style="margin:0 0 10px;color:#334155;">A customer submitted a contact form.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
              <p style="margin:0 0 8px;"><strong>Name:</strong> ${safeName}</p>
              <p style="margin:0 0 8px;"><strong>Email:</strong> ${safeEmail}</p>
              <p style="margin:0 0 8px;"><strong>Phone:</strong> ${safePhone}</p>
              <p style="margin:0 0 8px;"><strong>Subject:</strong> ${safeSubject}</p>
              <p style="margin:0 0 6px;"><strong>Message:</strong></p>
              <p style="margin:0;color:#334155;line-height:1.6;">${safeMessage}</p>
            </div>
          </div>
        </div>
      </div>
    `
  });

  await transporter.sendMail({
    from,
    to: payload.email,
    subject: "We received your message - Oibre",
    html: `
      <div style="font-family:Arial,sans-serif;background:#f3f4f6;padding:18px;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#111827;color:#ffffff;padding:22px;text-align:center;">
            <h2 style="margin:0;font-size:44px;line-height:1;">Oibre</h2>
            <div style="margin-top:12px;display:inline-block;background:#10b981;color:#ffffff;padding:8px 16px;border-radius:999px;font-weight:700;font-size:13px;">
              Contact Request Received
            </div>
          </div>
          <div style="padding:22px;">
            <p style="margin:0 0 12px;font-size:15px;color:#334155;">Hi ${safeName},</p>
            <p style="margin:0 0 12px;color:#334155;line-height:1.6;">
              Thanks for contacting Oibre. We received your message and our support team will get back to you soon.
            </p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
              <p style="margin:0;color:#334155;"><strong>Your subject:</strong> ${safeSubject}</p>
            </div>
            <p style="margin:18px 0 0;color:#475569;">Regards,<br/>Oibre Support Team</p>
          </div>
        </div>
      </div>
    `
  });
};

router.post("/", async (req, res) => {
  try {
    const {
      name = "",
      email = "",
      phone = "",
      subject = "",
      message = ""
    } = req.body || {};

    const clean = {
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone).trim(),
      subject: String(subject).trim(),
      message: String(message).trim()
    };

    if (!clean.name || !clean.email || !clean.phone || !clean.subject || !clean.message) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (!EMAIL_REGEX.test(clean.email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    if (!PHONE_REGEX.test(clean.phone)) {
      return res.status(400).json({ message: "Please enter a valid phone number." });
    }

    if (clean.message.length < 10) {
      return res.status(400).json({ message: "Message must be at least 10 characters." });
    }

    await ContactMessage.create(clean);
    sendContactEmails(clean).catch((mailError) => {
      console.error("CONTACT EMAIL ERROR:", mailError.message || mailError);
    });
    return res.status(201).json({ message: "Message sent successfully." });
  } catch (error) {
    console.error("CONTACT SUBMIT ERROR:", error);
    return res.status(500).json({ message: "Failed to send message. Please try again." });
  }
});

module.exports = router;
