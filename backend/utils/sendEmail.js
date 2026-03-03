const nodemailer = require("nodemailer");

// Get transporter - created lazily to avoid ESM issues with newer Node.js versions
const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    console.warn("⚠️ SMTP credentials not configured.");
    return null;
  }

  return nodemailer.createTransport({
    host: host,
    port: Number(port),
    secure: false, // must be false for port 587
    auth: {
      user: user,
      pass: pass
    }
  });
};

// Professional email header CSS
const emailHeaderStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
  .container { max-width: 500px; margin: 20px auto; padding: 0; }
  .header { background: #1f2937; color: white; text-align: center; padding: 24px; border-radius: 8px 8px 0 0; }
  .logo { font-size: 28px; font-weight: 700; margin: 0; }
  .badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-top: 8px; letter-spacing: 0.5px; }
  .badge-approval { background: #10b981; color: white; }
  .badge-rejection { background: #ef4444; color: white; }
  .badge-block { background: #dc2626; color: white; }
  .badge-unblock { background: #2563eb; color: white; }
  .badge-removal { background: #f59e0b; color: white; }
  .content { background: white; padding: 32px 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
  .greeting { color: #374151; font-size: 16px; margin: 0 0 16px 0; font-weight: 500; }
  .description { color: #6b7280; font-size: 14px; margin: 0 0 16px 0; line-height: 1.6; }
  .purpose-box { border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 0 4px 4px 0; margin: 20px 0; }
  .purpose-box.approval { background: #d1fae5; border-left-color: #10b981; }
  .purpose-box.rejection { background: #fee2e2; border-left-color: #ef4444; }
  .purpose-box.block { background: #fee2e2; border-left-color: #dc2626; }
  .purpose-box.removal { background: #ffedd5; border-left-color: #f59e0b; }
  .purpose-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0; }
  .purpose-text { font-size: 14px; font-weight: 600; margin: 0; }
  .info-box { background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0; }
  .info-item { color: #374151; font-size: 13px; margin: 8px 0; }
  .info-label { font-weight: 600; color: #1f2937; }
  .instructions { background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0; }
  .step { color: #374151; font-size: 13px; margin: 8px 0; padding-left: 20px; position: relative; }
  .step:before { content: "->"; position: absolute; left: 0; color: #2563eb; font-weight: 700; }
  .button-link { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0; }
  a.button-link, a.button-link:link, a.button-link:visited, a.button-link:hover, a.button-link:active { color: #ffffff !important; text-decoration: none !important; }
  .warning-box { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 12px 16px; border-radius: 0 4px 4px 0; color: #92400e; font-size: 13px; margin: 20px 0; }
  .error-box { background: #fee2e2; border-left: 3px solid #dc2626; padding: 12px 16px; border-radius: 0 4px 4px 0; color: #991b1b; font-size: 13px; margin: 20px 0; }
  .footer { color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; line-height: 1.6; }
`;

/* ===============================
   APPROVAL EMAIL (WITH PASSWORD)
================================ */
const sendApprovalEmail = async (to, name, password) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("⚠️ Email not sent - transporter not configured. To:", to);
    return { sent: false, reason: "Email transporter not configured" };
  }

  const loginLink = "https://oibre-services-provider-web-fronten.vercel.app";

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to,
    subject: "Your Oibre Provider Account is Approved",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${emailHeaderStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Oibre</div>
              <div class="badge badge-approval">Account Approved</div>
            </div>
            <div class="content">
              <p class="greeting">Welcome to Oibre, ${name}!</p>

              <div class="purpose-box approval">
                <div class="purpose-label" style="color: #047857;">What is this?</div>
                <div class="purpose-text" style="color: #065f46;">Your service provider account approval details</div>
              </div>

              <p class="description">
                Great news. Your service provider account has been approved and is now active.
                Use the credentials below to log in to your provider dashboard.
              </p>

              <div class="info-box">
                <div class="info-item"><span class="info-label">Email:</span> ${to}</div>
                <div class="info-item"><span class="info-label">Password:</span> ${password}</div>
              </div>

              <div style="text-align: center;">
                <a href="${loginLink}" class="button-link" style="display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 6px;">Login to Provider Dashboard</a>
              </div>

              <div class="instructions">
                <div style="color: #6b7280; font-size: 12px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">How to Use:</div>
                <div class="step">Click the login button above</div>
                <div class="step">Sign in with your email and temporary password</div>
                <div class="step">Change your password immediately after login</div>
              </div>

              <div class="warning-box">
                <strong>Important:</strong> For security, do not share your password. Please update it after first login.
              </div>

              <div class="footer">
                <p style="margin: 0 0 8px 0;"><strong>Oibre</strong> | Local Services Platform</p>
                <p style="margin: 0; font-size: 11px;">This is an automated email. Please do not reply to this address.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { sent: true };
  } catch (error) {
    console.error("❌ Failed to send approval email:", error.message);
    return { sent: false, reason: error.message };
  }
};

/* ===============================
   REJECTION EMAIL
================================ */
const sendRejectionEmail = async (to, name, reason) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("⚠️ Email not sent - transporter not configured. To:", to);
    return { sent: false, reason: "Email transporter not configured" };
  }

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to,
    subject: "Your Oibre Provider Request - Update",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${emailHeaderStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Oibre</div>
              <div class="badge badge-rejection">Request Update</div>
            </div>
            <div class="content">
              <p class="greeting">Hello ${name},</p>
              <p class="description">Thank you for your interest in joining Oibre as a service provider.</p>

              <div class="purpose-box rejection">
                <div class="purpose-label" style="color: #b91c1c;">Application Status</div>
                <div class="purpose-text" style="color: #7f1d1d;">Your application has not been approved at this time</div>
              </div>

              <div class="error-box">
                <strong>Reason for Rejection:</strong><br>
                ${reason || "The application did not meet the required criteria."}
              </div>

              <p style="color: #6b7280; font-size: 13px;">You may reapply after addressing the mentioned concerns. Our team is here to help!</p>

              <p style="color: #6b7280; font-size: 13px;">For more information, please contact our support team at:<br>
              <strong>Email:</strong> support@oibre.com</p>

              <div class="footer">
                <p style="margin: 0 0 8px 0;"><strong>Oibre</strong> | Local Services Platform</p>
                <p style="margin: 0; font-size: 11px;">This is an automated email. Please do not reply to this address.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { sent: true };
  } catch (error) {
    console.error("❌ Failed to send rejection email:", error.message);
    return { sent: false, reason: error.message };
  }
};

/* ===============================
   BLOCK EMAIL
================================ */
const sendBlockEmail = async (to, name, reason) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("⚠️ Email not sent - transporter not configured. To:", to);
    return { sent: false, reason: "Email transporter not configured" };
  }

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to,
    subject: "Important: Your Oibre Provider Account Status",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${emailHeaderStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Oibre</div>
              <div class="badge badge-block">Account Status</div>
            </div>
            <div class="content">
              <p class="greeting">Hello ${name},</p>
              <p class="description">We are writing to inform you about an important change to your account.</p>

              <div class="purpose-box block">
                <div class="purpose-label" style="color: #b91c1c;">Account Blocked</div>
                <div class="purpose-text" style="color: #7f1d1d;">Your service provider account has been temporarily suspended</div>
              </div>

              <div class="error-box">
                <strong>Reason for Block:</strong><br>
                ${reason || "Policy violation or terms of service breach"}
              </div>

              <p style="color: #6b7280; font-size: 13px;">
                <strong>What happens next?</strong><br>
                - Your account is now inactive<br>
                - You cannot accept new service requests<br>
                - Existing requests may be reassigned
              </p>

              <p style="color: #6b7280; font-size: 13px;"><strong>Appeal Process:</strong><br>
              If you believe this is a mistake or would like to appeal, please contact our support team within 7 days at:<br>
              <strong>support@oibre.com</strong>
              </p>

              <div class="footer">
                <p style="margin: 0 0 8px 0;"><strong>Oibre</strong> | Local Services Platform</p>
                <p style="margin: 0; font-size: 11px;">This is an automated email. Please do not reply to this address.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { sent: true };
  } catch (error) {
    console.error("❌ Failed to send block email:", error.message);
    return { sent: false, reason: error.message };
  }
};

/* ===============================
   UNBLOCK EMAIL
================================ */
const sendUnblockEmail = async (to, name) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("⚠️ Email not sent - transporter not configured. To:", to);
    return { sent: false, reason: "Email transporter not configured" };
  }

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to,
    subject: "Your Oibre Provider Account Has Been Unblocked",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${emailHeaderStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Oibre</div>
              <div class="badge badge-unblock">Account Unblocked</div>
            </div>
            <div class="content">
              <p class="greeting">Hello ${name || "Provider"},</p>
              <p class="description">
                Your service provider account has been unblocked and is active again.
                Your profile will now be visible to customers.
              </p>

              <div class="purpose-box approval">
                <div class="purpose-label" style="color: #047857;">Status Update</div>
                <div class="purpose-text" style="color: #065f46;">Your account is now active</div>
              </div>

              <div class="footer">
                <p style="margin: 0 0 8px 0;"><strong>Oibre</strong> | Local Services Platform</p>
                <p style="margin: 0; font-size: 11px;">This is an automated email. Please do not reply to this address.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { sent: true };
  } catch (error) {
    console.error("❌ Failed to send unblock email:", error.message);
    return { sent: false, reason: error.message };
  }
};

/* ===============================
   REMOVAL APPROVED EMAIL
================================ */
const sendRemovalApprovedEmail = async (to, name, adminNote) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("⚠️ Email not sent - transporter not configured. To:", to);
    return { sent: false, reason: "Email transporter not configured" };
  }

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to,
    subject: "Your Oibre Provider Account Removal Request Was Approved",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${emailHeaderStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Oibre</div>
              <div class="badge badge-removal">Removal Approved</div>
            </div>
            <div class="content">
              <p class="greeting">Hello ${name || "Provider"},</p>
              <p class="description">
                Your request to remove your service provider account has been approved.
                Your provider account is now deleted from the active platform.
              </p>

              <div class="purpose-box removal">
                <div class="purpose-label" style="color: #b45309;">Request Status</div>
                <div class="purpose-text" style="color: #9a3412;">Your account removal has been completed</div>
              </div>

              ${
                adminNote
                  ? `<div class="info-box"><div class="info-item"><span class="info-label">Admin note:</span> ${adminNote}</div></div>`
                  : ""
              }

              <div class="warning-box">
                <strong>Important:</strong> If you did not request this removal, contact support immediately at support@oibre.com.
              </div>

              <div class="footer">
                <p style="margin: 0 0 8px 0;"><strong>Oibre</strong> | Local Services Platform</p>
                <p style="margin: 0; font-size: 11px;">This is an automated email. Please do not reply to this address.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { sent: true };
  } catch (error) {
    console.error("❌ Failed to send removal email:", error.message);
    return { sent: false, reason: error.message };
  }
};

/* ===============================
   PROVIDER PASSWORD RESET EMAIL
================================ */
const sendPasswordResetEmail = async (to, name, password) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("⚠️ Email not sent - transporter not configured. To:", to);
    return { sent: false, reason: "Email transporter not configured" };
  }

  const loginLink = "https://oibre-services-provider-web-fronten.vercel.app";

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to,
    subject: "Your Oibre Provider Login Password Was Reset",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${emailHeaderStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Oibre</div>
              <div class="badge badge-unblock">Password Reset</div>
            </div>
            <div class="content">
              <p class="greeting">Hello ${name || "Provider"},</p>

              <div class="purpose-box approval">
                <div class="purpose-label" style="color: #047857;">What is this?</div>
                <div class="purpose-text" style="color: #065f46;">Your updated provider login credentials</div>
              </div>

              <p class="description">
                Your provider password has been reset by admin. Use the temporary password below to login.
              </p>

              <div class="info-box">
                <div class="info-item"><span class="info-label">Email:</span> ${to}</div>
                <div class="info-item"><span class="info-label">Temporary Password:</span> ${password}</div>
              </div>

              <div style="text-align: center;">
                <a href="${loginLink}" class="button-link" style="display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 6px;">Login to Provider Dashboard</a>
              </div>

              <div class="warning-box">
                <strong>Important:</strong> Please change your password immediately after login.
              </div>

              <div class="footer">
                <p style="margin: 0 0 8px 0;"><strong>Oibre</strong> | Local Services Platform</p>
                <p style="margin: 0; font-size: 11px;">This is an automated email. Please do not reply to this address.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { sent: true };
  } catch (error) {
    console.error("❌ Failed to send password reset email:", error.message);
    return { sent: false, reason: error.message };
  }
};

/* ===============================
   CONTACT REPLY EMAIL
================================ */
const sendContactReplyEmail = async ({ to, customerName, subject, adminMessage }) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("⚠️ Email not sent - transporter not configured. To:", to);
    return { sent: false, reason: "Email transporter not configured" };
  }

  const safe = (value = "") =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, "\u0022")
      .replace(/'/g, "&#39;");

  const safeName = safe(customerName || "Customer");
  const safeSubject = safe(subject || "Your message to Oibre");
  const safeMessage = safe(adminMessage || "").replace(/\n/g, "<br/>");

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to,
    subject: `${subject || "Your message to Oibre"} - Oibre Support`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${emailHeaderStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Oibre</div>
              <div class="badge badge-unblock">Support Reply</div>
            </div>
            <div class="content">
              <p class="greeting">Hi ${safeName},</p>
              <p class="description">Thanks for reaching out to Oibre Support. Here is our response to your query.</p>
              <div class="info-box">
                <div class="info-item"><span class="info-label">Your Subject:</span> ${safeSubject}</div>
              </div>
              <div class="purpose-box approval">
                <div class="purpose-label" style="color:#1d4ed8;">Our Message</div>
                <div class="purpose-text" style="color:#1e3a8a; font-weight:500;">${safeMessage}</div>
              </div>
              <p style="color:#6b7280;font-size:13px;">If you need anything else, just reply to this email.</p>
              <div class="footer">
                <p style="margin:0 0 8px 0;"><strong>Oibre</strong> | Local Services Platform</p>
                <p style="margin:0; font-size:11px;">This email was sent by Oibre Support.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { sent: true };
  } catch (error) {
    console.error("❌ Failed to send contact reply email:", error.message);
    return { sent: false, reason: error.message };
  }
};

module.exports = {
  sendApprovalEmail,
  sendRejectionEmail,
  sendBlockEmail,
  sendUnblockEmail,
  sendRemovalApprovedEmail,
  sendPasswordResetEmail,
  sendContactReplyEmail
};
