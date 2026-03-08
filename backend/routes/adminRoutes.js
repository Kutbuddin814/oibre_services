const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const ProviderRequest = require("../models/ProviderRequest");
const ServiceProvider = require("../models/ServiceProvider");
const ServiceRequest = require("../models/ServiceRequest");
const Review = require("../models/Review");
const Customer = require("../models/Customer");
const Service = require("../models/Service");
const RemovalRequest = require("../models/RemovalRequest");
const DeletedServiceProvider = require("../models/DeletedServiceProvider");
const ProviderStatusHistory = require("../models/ProviderStatusHistory");
const ContactMessage = require("../models/ContactMessage");
const adminAuth = require("../middleware/adminAuth");

const {
  sendApprovalEmail,
  sendRejectionEmail,
  sendBlockEmail,
  sendUnblockEmail,
  sendRemovalApprovedEmail,
  sendRemovalRejectedEmail,
  sendPasswordResetEmail,
  sendContactReplyEmail
} = require("../utils/sendEmail");

const router = express.Router();

const PASSWORD_CHARS = "abcdefghijkmnpqrstuvwxyz23456789";
const generatePassword = (length = 10) => {
  let pwd = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * PASSWORD_CHARS.length);
    pwd += PASSWORD_CHARS[idx];
  }
  return pwd;
};

const queueEmail = (promise, label) => {
  Promise.resolve(promise).catch((err) => {
    console.error(`${label} EMAIL ERROR:`, err?.message || err);
  });
};

/* ===============================
   UPLOAD: SERVICE ICON IMAGES
================================ */
const serviceIconDir = path.join(__dirname, "../uploads/service-icons");

if (!fs.existsSync(serviceIconDir)) {
  fs.mkdirSync(serviceIconDir, { recursive: true });
}

const serviceIconStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, serviceIconDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${Date.now()}-service-icon${ext || ".png"}`);
  }
});

const uploadServiceIcon = multer({
  storage: serviceIconStorage
});

router.use(adminAuth);

router.get("/stats", async (req, res) => {
  try {
    const [totalUsers, totalProviders, totalRequests, pendingRequests, newContactMessages] = await Promise.all([
      Customer.countDocuments(),
      ServiceProvider.countDocuments(),
      ServiceRequest.countDocuments(),
      ProviderRequest.countDocuments({ status: "pending" }),
      ContactMessage.countDocuments({ status: "new" })
    ]);

    res.json({
      totalUsers,
      totalProviders,
      totalRequests,
      pendingRequests,
      newContactMessages
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// Check if Cloudinary is configured
const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && 
                                process.env.CLOUDINARY_API_KEY && 
                                process.env.CLOUDINARY_API_SECRET;

// Helper function to convert local file paths to Cloudinary URLs
const convertToCloudinaryUrl = (filename, baseURL) => {
  if (!filename) return "";
  if (filename.startsWith('http')) return filename; // Already a URL
  if (isCloudinaryConfigured) {
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/oibre/${filename}`;
  }
  return `${baseURL}/uploads/${filename}`;
};

router.get("/provider-requests", async (req, res) => {
  try {
    const requests = await ProviderRequest.find().sort({ createdAt: -1 });
    
    // Get the base URL from request
    const baseURL = `${req.protocol}://${req.get("host")}`;
    
    // Add full URLs to file paths
    const requestsWithUrls = requests.map(request => {
      const reqObj = request.toObject();
      
      // Handle profilePhoto - use URL as-is, don't rebuild
      if (reqObj.profilePhoto) {
        if (reqObj.profilePhoto.startsWith('http')) {
          // Already a Cloudinary URL - use it directly
          reqObj.profilePhoto = reqObj.profilePhoto;
        } else if (!isCloudinaryConfigured) {
          // Local storage fallback
          reqObj.profilePhoto = `${baseURL}/uploads/${reqObj.profilePhoto}`;
        }
      }
      
      // Handle skillCertificate - use URL as-is, don't rebuild
      if (reqObj.skillCertificate) {
        if (reqObj.skillCertificate.startsWith('http')) {
          // Already a full Cloudinary URL - use it directly
          reqObj.skillCertificate = reqObj.skillCertificate;
        } else if (!isCloudinaryConfigured) {
          // Local storage fallback
          reqObj.skillCertificate = `${baseURL}/uploads/${reqObj.skillCertificate}`;
        }
        // If Cloudinary is configured but it's just a publicId, still store as-is
        // The upload middleware now always returns full URLs
      }
      
      return reqObj;
    });
    
    res.json(requestsWithUrls);
  } catch {
    res.status(500).json({ message: "Failed to fetch requests" });
  }
});

router.post("/provider-requests/approve/:id", async (req, res) => {
  try {
    const request = await ProviderRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    const existingProvider = await ServiceProvider.findOne({
      $or: [{ email: request.email }, { mobile: request.mobile }]
    });

    if (existingProvider) {
      await ProviderRequest.findByIdAndDelete(req.params.id);
      return res.status(409).json({
        message: "Provider already approved earlier (duplicate email/mobile)"
      });
    }

    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const provider = new ServiceProvider({
      name: request.name,
      email: request.email,
      mobile: request.mobile,
      qualification: request.qualification,
      serviceCategory: request.serviceCategory,
      otherService: request.otherService,
      address: request.address,
      availableTime: request.availableTime,
      experience: request.experience,
      description: request.description,
      location: request.location,
      profilePhoto: request.profilePhoto,
      skillCertificate: request.skillCertificate,
      password: hashedPassword,
      status: "approved",
      verified: true
    });

    await provider.save();
    queueEmail(
      sendApprovalEmail(request.email, request.name, plainPassword),
      "PROVIDER APPROVAL"
    );
    await ProviderRequest.findByIdAndDelete(req.params.id);

    res.json({ message: "Provider approved and credentials sent" });
  } catch (err) {
    console.error("APPROVAL ERROR:", err);
    res.status(500).json({ message: "Approval failed" });
  }
});

router.post("/provider-requests/reject/:id", async (req, res) => {
  try {
    const { reason } = req.body;
    const request = await ProviderRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    queueEmail(
      sendRejectionEmail(request.email, request.name, reason),
      "PROVIDER REJECTION"
    );
    await ProviderRequest.findByIdAndDelete(req.params.id);

    res.json({ message: "Provider rejected" });
  } catch {
    res.status(500).json({ message: "Rejection failed" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await Customer.find().sort({ createdAt: -1 });
    res.json(users);
  } catch {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Ban user
router.post("/users/:id/ban", adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await Customer.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status === "banned") {
      return res.status(400).json({ message: "User is already banned" });
    }

    user.status = "banned";
    user.bannedAt = new Date();
    user.banReason = reason || "Violation of terms and conditions";
    await user.save();

    // Add to blacklist
    const Blacklist = require("../models/Blacklist");
    await Blacklist.findOneAndUpdate(
      { email: user.email?.toLowerCase() },
      {
        email: user.email?.toLowerCase(),
        reason: "banned",
        bannedBy: req.adminId,
        message: user.banReason,
        bannedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Send ban email
    if (user.email) {
      const { sendBrevoEmail } = require("../utils/sendEmail");
      const subject = "Oibre Customer Account Banned";
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 30px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">⚠️ Account Banned</h1>
                      <p style="margin: 10px 0 0 0; color: #fee2e2; font-size: 14px; font-weight: 500;">Oibre Customer Platform</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; font-size: 16px; color: #111827; line-height: 1.6;">
                        Dear <strong>${user.name || "Customer"}</strong>,
                      </p>
                      
                      <p style="margin: 0 0 25px 0; font-size: 15px; color: #374151; line-height: 1.6;">
                        Your <strong>Oibre Customer Account</strong> has been temporarily banned from accessing our platform.
                      </p>
                      
                      <!-- Reason Box -->
                      <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #991b1b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Ban Reason</p>
                        <p style="margin: 0; font-size: 15px; color: #7f1d1d; font-weight: 600; line-height: 1.5;">
                          ${user.banReason}
                        </p>
                      </div>
                      
                      <p style="margin: 0 0 20px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                        <strong>What this means:</strong><br>
                        • You cannot login to your customer account<br>
                        • You cannot book new services<br>
                        • Your existing bookings may be affected<br>
                        • Your account data is preserved
                      </p>
                      
                      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 0 6px 6px 0;">
                        <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                          <strong>📧 Appeal Process:</strong> If you believe this ban is a mistake or would like to appeal, please contact our support team immediately at <a href="mailto:support@oibre.com" style="color: #d97706; text-decoration: underline;">support@oibre.com</a>
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0 0 8px 0; font-size: 14px; color: #111827; font-weight: 600;">Oibre</p>
                      <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280;">Your Local Services Platform</p>
                      <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                        This is an automated email from the Oibre Customer Platform. Please do not reply to this message.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
      sendBrevoEmail({ to: user.email, subject, html }).catch(err => 
        console.error("Ban email error:", err)
      );
    }

    res.json({ message: "User banned successfully", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to ban user" });
  }
});

// Unban user
router.post("/users/:id/unban", adminAuth, async (req, res) => {
  try {
    const user = await Customer.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status !== "banned") {
      return res.status(400).json({ message: "User is not banned" });
    }

    user.status = "active";
    user.bannedAt = null;
    user.banReason = null;
    await user.save();

    // Remove from blacklist
    const Blacklist = require("../models/Blacklist");
    await Blacklist.deleteOne({ email: user.email?.toLowerCase(), reason: "banned" });

    // Send unban email
    if (user.email) {
      const { sendBrevoEmail } = require("../utils/sendEmail");
      const subject = "Oibre Customer Account Restored";
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px 30px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">✅ Account Restored</h1>
                      <p style="margin: 10px 0 0 0; color: #d1fae5; font-size: 14px; font-weight: 500;">Oibre Customer Platform</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; font-size: 16px; color: #111827; line-height: 1.6;">
                        Dear <strong>${user.name || "Customer"}</strong>,
                      </p>
                      
                      <div style="background: #d1fae5; border-left: 4px solid #059669; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #065f46; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">🎉 Good News!</p>
                        <p style="margin: 0; font-size: 15px; color: #047857; font-weight: 600; line-height: 1.5;">
                          Your <strong>Oibre Customer Account</strong> has been unbanned and fully restored.
                        </p>
                      </div>
                      
                      <p style="margin: 0 0 20px 0; font-size: 15px; color: #374151; line-height: 1.6;">
                        You can now access all platform features including:
                      </p>
                      
                      <p style="margin: 0 0 20px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                        ✓ Login to your customer account<br>
                        ✓ Book services from providers<br>
                        ✓ View and manage your bookings<br>
                        ✓ Access your complete account history
                      </p>
                      
                      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 0 6px 6px 0;">
                        <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                          <strong>⚠️ Important Reminder:</strong> Please ensure you follow our terms and conditions to avoid any future issues. Repeated violations may result in permanent account suspension.
                        </p>
                      </div>
                      
                      <div style="text-align: center; margin: 30px 0 20px 0;">
                        <a href="https://oibre-customer-frontend.vercel.app" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">Access Your Account</a>
                      </div>
                      
                      <p style="margin: 20px 0 0 0; font-size: 13px; color: #6b7280; line-height: 1.6; text-align: center;">
                        Thank you for being part of the Oibre community!
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0 0 8px 0; font-size: 14px; color: #111827; font-weight: 600;">Oibre</p>
                      <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280;">Your Local Services Platform</p>
                      <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                        This is an automated email from the Oibre Customer Platform. Please do not reply to this message.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
      sendBrevoEmail({ to: user.email, subject, html }).catch(err => 
        console.error("Unban email error:", err)
      );
    }

    res.json({ message: "User unbanned successfully", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to unban user" });
  }
});

// Delete user (permanent blacklist)
router.delete("/users/:id", adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await Customer.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userEmail = user.email;
    const userName = user.name;
    const deleteReason = reason || "Account permanently deleted by administrator";

    // Add to permanent blacklist
    const Blacklist = require("../models/Blacklist");
    await Blacklist.findOneAndUpdate(
      { email: userEmail?.toLowerCase() },
      {
        email: userEmail?.toLowerCase(),
        reason: "deleted",
        bannedBy: req.adminId,
        message: deleteReason,
        bannedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Delete user
    await Customer.findByIdAndDelete(req.params.id);

    // Send deletion email
    if (userEmail) {
      const { sendBrevoEmail } = require("../utils/sendEmail");
      const subject = "Oibre Customer Account Permanently Deleted";
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%); padding: 40px 30px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🚫 Account Deleted</h1>
                      <p style="margin: 10px 0 0 0; color: #fecaca; font-size: 14px; font-weight: 500;">Oibre Customer Platform</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; font-size: 16px; color: #111827; line-height: 1.6;">
                        Dear <strong>${userName || "Customer"}</strong>,
                      </p>
                      
                      <p style="margin: 0 0 25px 0; font-size: 15px; color: #374151; line-height: 1.6;">
                        Your <strong>Oibre Customer Account</strong> has been permanently deleted from our platform.
                      </p>
                      
                      <!-- Reason Box -->
                      <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #991b1b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Deletion Reason</p>
                        <p style="margin: 0; font-size: 15px; color: #7f1d1d; font-weight: 600; line-height: 1.5;">
                          ${deleteReason}
                        </p>
                      </div>
                      
                      <!-- Critical Warning Box -->
                      <div style="background: #450a0a; border: 2px solid #dc2626; padding: 20px; margin: 30px 0; border-radius: 8px;">
                        <p style="margin: 0 0 12px 0; font-size: 14px; color: #fef2f2; font-weight: 700; text-align: center;">⚠️ PERMANENT BLACKLIST NOTICE ⚠️</p>
                        <p style="margin: 0; font-size: 13px; color: #fecaca; line-height: 1.6; text-align: center;">
                          Your email address <strong style="color: #ffffff;">${userEmail}</strong> has been permanently blacklisted.
                        </p>
                      </div>
                      
                      <p style="margin: 0 0 15px 0; font-size: 14px; color: #111827; font-weight: 600;">This means:</p>
                      <p style="margin: 0 0 20px 0; font-size: 14px; color: #6b7280; line-height: 1.8;">
                        ❌ You cannot create a new <strong>Oibre Customer</strong> account<br>
                        ❌ You cannot register as an <strong>Oibre Service Provider</strong><br>
                        ❌ You cannot access <strong>any Oibre platform</strong> with this email<br>
                        ❌ This action is <strong style="color: #dc2626;">permanent and irreversible</strong>
                      </p>
                      
                      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 0 6px 6px 0;">
                        <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                          <strong>📧 Appeal Process:</strong> If you believe this deletion is an error, please contact our support team immediately at <a href="mailto:support@oibre.com" style="color: #d97706; text-decoration: underline;">support@oibre.com</a> with your account details.
                        </p>
                      </div>
                      
                      <p style="margin: 25px 0 0 0; font-size: 13px; color: #9ca3af; line-height: 1.6; text-align: center;">
                        All your account data, bookings, and history have been permanently removed from our systems.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0 0 8px 0; font-size: 14px; color: #111827; font-weight: 600;">Oibre</p>
                      <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280;">Your Local Services Platform</p>
                      <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                        This is an automated email from the Oibre Customer Platform. Please do not reply to this message.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
      sendBrevoEmail({ to: userEmail, subject, html }).catch(err => 
        console.error("Deletion email error:", err)
      );
    }

    res.json({ message: "User deleted and email blacklisted permanently" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

router.get("/providers", async (req, res) => {
  try {
    const baseURL = `${req.protocol}://${req.get("host")}`;
    
    const [providers, ratingStats] = await Promise.all([
      ServiceProvider.find().sort({ createdAt: -1 }),
      Review.aggregate([
        {
          $group: {
            _id: "$provider",
            averageRating: { $avg: "$rating" },
            reviewCount: { $sum: 1 }
          }
        }
      ])
    ]);

    const ratingMap = new Map(
      ratingStats.map((row) => [
        String(row._id),
        {
          averageRating: Number((row.averageRating || 0).toFixed(1)),
          reviewCount: row.reviewCount || 0
        }
      ])
    );

    const providersWithLiveRatings = providers.map((provider) => {
      const doc = provider.toObject();
      const stats = ratingMap.get(String(provider._id));
      // Convert profilePhoto to full URL
      doc.profilePhoto = convertToCloudinaryUrl(provider.profilePhoto, baseURL);
      return {
        ...doc,
        averageRating: stats ? stats.averageRating : 0,
        reviewCount: stats ? stats.reviewCount : 0
      };
    });

    res.json(providersWithLiveRatings);
  } catch {
    res.status(500).json({ message: "Failed to fetch providers" });
  }
});

router.patch("/providers/:id/status", async (req, res) => {
  try {
    const { status, blockReason } = req.body;
    if (!["approved", "blocked"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const reason = String(blockReason || "").trim();
    if (status === "blocked" && !reason) {
      return res.status(400).json({ message: "Block reason is required" });
    }

    const provider = await ServiceProvider.findById(req.params.id);

    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    const previousStatus = provider.status;
    provider.status = status;
    await provider.save();

    // Send status emails
    if (status === "blocked" && previousStatus !== "blocked") {
      queueEmail(
        sendBlockEmail(provider.email, provider.name, reason),
        "PROVIDER BLOCK"
      );
    } else if (status === "approved" && previousStatus === "blocked") {
      queueEmail(
        sendUnblockEmail(provider.email, provider.name),
        "PROVIDER UNBLOCK"
      );
    }

    const action = status === "blocked" ? "blocked" : "unblocked";
    await ProviderStatusHistory.create({
      providerId: provider._id,
      email: provider.email,
      name: provider.name,
      action,
      reason: status === "blocked" ? reason : "Provider unblocked by admin",
      previousStatus,
      newStatus: status,
      adminId: req.adminId || null,
      changedAt: new Date()
    });

    res.json({ message: "Provider status updated", provider });
  } catch (err) {
    console.error("PROVIDER STATUS UPDATE ERROR:", err);
    res.status(500).json({ message: "Failed to update provider status" });
  }
});

router.post("/providers/:id/reset-password", async (req, res) => {
  try {
    const provider = await ServiceProvider.findById(req.params.id).select("+password");
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    const plainPassword = generatePassword();
    provider.password = await bcrypt.hash(plainPassword, 10);
    await provider.save();

    queueEmail(
      sendPasswordResetEmail(provider.email, provider.name, plainPassword),
      "PROVIDER PASSWORD RESET"
    );

    res.json({ message: "Password reset and emailed to provider." });
  } catch (err) {
    console.error("PROVIDER PASSWORD RESET ERROR:", err);
    res.status(500).json({ message: "Failed to reset provider password" });
  }
});

/* ===============================
   REMOVAL REQUESTS
================================ */
router.get("/removal-requests", async (req, res) => {
  try {
    const requests = await RemovalRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch {
    res.status(500).json({ message: "Failed to fetch removal requests" });
  }
});

router.patch("/removal-requests/:id/approve", async (req, res) => {
  try {
    const request = await RemovalRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Removal request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Removal request already processed" });
    }

    const adminNote = (req.body?.adminNote || "").trim();
    const provider = await ServiceProvider.findById(request.providerId).select("+password");

    if (provider) {
      await DeletedServiceProvider.create({
        providerId: provider._id,
        removalRequestId: request._id,
        email: provider.email,
        name: provider.name,
        reason: request.reason || "",
        adminNote,
        removedAt: new Date(),
        approvedByAdminId: req.adminId || null,
        providerSnapshot: provider.toObject()
      });

      await ServiceProvider.findByIdAndDelete(request.providerId);
    } else {
      await DeletedServiceProvider.create({
        providerId: request.providerId,
        removalRequestId: request._id,
        email: request.email || "",
        name: request.name || "",
        reason: request.reason || "",
        adminNote,
        removedAt: new Date(),
        approvedByAdminId: req.adminId || null,
        providerSnapshot: {
          missingAtDeletion: true,
          providerId: request.providerId,
          email: request.email || "",
          name: request.name || ""
        }
      });
    }

    const notificationEmail = request.email || provider?.email;
    if (notificationEmail) {
      queueEmail(
        sendRemovalApprovedEmail(notificationEmail, request.name || provider?.name, adminNote),
        "PROVIDER REMOVAL APPROVAL"
      );
    }

    request.status = "approved";
    request.adminNote = adminNote;
    await request.save();

    res.json({ message: "Provider removed, archived, and email sent" });
  } catch (err) {
    console.error("REMOVAL APPROVAL ERROR:", err);
    res.status(500).json({ message: "Failed to approve removal request" });
  }
});

router.patch("/removal-requests/:id/reject", async (req, res) => {
  try {
    const request = await RemovalRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Removal request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Removal request already processed" });
    }

    const adminNote = (req.body?.adminNote || "").trim();
    
    // Get provider details for email
    const provider = await ServiceProvider.findById(request.providerId);
    const notificationEmail = request.email || provider?.email;
    
    if (notificationEmail) {
      queueEmail(
        sendRemovalRejectedEmail(notificationEmail, request.name || provider?.name, adminNote),
        "PROVIDER REMOVAL REJECTION"
      );
    }

    request.status = "rejected";
    request.adminNote = adminNote;
    await request.save();

    res.json({ message: "Removal request rejected and email sent" });
  } catch (err) {
    console.error("REMOVAL REJECTION ERROR:", err);
    res.status(500).json({ message: "Failed to reject removal request" });
  }
});

router.get("/reports/summary", async (req, res) => {
  try {
    const [totalUsers, totalProviders, totalRequests, pendingApprovals] = await Promise.all([
      Customer.countDocuments(),
      ServiceProvider.countDocuments(),
      ServiceRequest.countDocuments(),
      ProviderRequest.countDocuments({ status: "pending" })
    ]);

    res.json({
      generatedAt: new Date().toISOString(),
      totals: {
        totalUsers,
        totalProviders,
        totalRequests,
        pendingApprovals
      }
    });
  } catch {
    res.status(500).json({ message: "Failed to generate report" });
  }
});

router.get("/export/all", async (req, res) => {
  try {
    const [users, providers, providerRequests] = await Promise.all([
      Customer.find(),
      ServiceProvider.find(),
      ProviderRequest.find()
    ]);

    res.json({
      exportedAt: new Date().toISOString(),
      users,
      providers,
      providerRequests
    });
  } catch {
    res.status(500).json({ message: "Failed to export data" });
  }
});

/* ===============================
   SERVICES MANAGEMENT
================================ */

// Get all services
router.get("/services", async (req, res) => {
  try {
    const services = await Service.find().sort({ name: 1 });
    res.json(services);
  } catch {
    res.status(500).json({ message: "Failed to fetch services" });
  }
});

// Add new service
router.post("/services", uploadServiceIcon.single("iconImage"), async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Service name is required" });
    }

    const existingService = await Service.findOne({ name: { $regex: `^${name}$`, $options: "i" } });
    if (existingService) {
      return res.status(409).json({ message: "Service already exists" });
    }

    const newService = new Service({
      name: name.trim(),
      description: description || "",
      icon: icon || "\uD83D\uDD27",
      iconImage: req.file?.path || req.file ? `service-icons/${req.file.filename}` : "",
      status: "active"
    });

    await newService.save();
    res.status(201).json({ message: "Service added successfully", service: newService });
  } catch (err) {
    console.error("Error adding service:", err);
    res.status(500).json({ message: "Failed to add service" });
  }
});

// Update service
router.patch("/services/:id", uploadServiceIcon.single("iconImage"), async (req, res) => {
  try {
    const { name, description, icon, status } = req.body;
    const updateData = {};

    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (icon) updateData.icon = icon;
    if (status) updateData.status = status;
    if (req.file) updateData.iconImage = req.file?.path || `service-icons/${req.file.filename}`;

    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updatedService) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.json({ message: "Service updated successfully", service: updatedService });
  } catch {
    res.status(500).json({ message: "Failed to update service" });
  }
});

// Delete service
router.delete("/services/:id", async (req, res) => {
  try {
    const deletedService = await Service.findByIdAndDelete(req.params.id);
    if (!deletedService) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.json({ message: "Service deleted successfully" });
  } catch {
    res.status(500).json({ message: "Failed to delete service" });
  }
});

/* ===============================
   CONTACT MESSAGES
================================ */
router.get("/contact-messages", async (req, res) => {
  try {
    const { status, q } = req.query;
    const query = {};

    if (status && ["new", "in_progress", "closed"].includes(String(status))) {
      query.status = String(status);
    }

    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim(), "i");
      query.$or = [
        { name: rx },
        { email: rx },
        { phone: rx },
        { subject: rx },
        { message: rx }
      ];
    }

    const messages = await ContactMessage.find(query).sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error("FETCH CONTACT MESSAGES ERROR:", err);
    res.status(500).json({ message: "Failed to fetch contact messages" });
  }
});

router.patch("/contact-messages/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["new", "in_progress", "closed"].includes(String(status))) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Get the original message to check old status
    const originalMessage = await ContactMessage.findById(req.params.id);
    if (!originalMessage) {
      return res.status(404).json({ message: "Contact message not found" });
    }

    const oldStatus = originalMessage.status;
    const newStatus = String(status);

    const updated = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { status: newStatus },
      { new: true }
    );

    // Send email notification based on status change
    if (updated && updated.email && oldStatus !== newStatus) {
      const { sendBrevoEmail } = require("../utils/sendEmail");

      // Case 1: Message closed
      if (newStatus === "closed" && oldStatus !== "closed") {
        const subject = "Your Oibre Support Request Has Been Closed";
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 40px 30px; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">✅ Support Request Closed</h1>
                        <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 14px; font-weight: 500;">Oibre Support Team</p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="margin: 0 0 20px 0; font-size: 16px; color: #111827; line-height: 1.6;">
                          Dear <strong>${updated.name || "Valued Customer"}</strong>,
                        </p>
                        
                        <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                          <p style="margin: 0 0 8px 0; font-size: 12px; color: #1e40af; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Status Update</p>
                          <p style="margin: 0; font-size: 15px; color: #1e3a8a; font-weight: 600; line-height: 1.5;">
                            Your support request has been marked as <strong>CLOSED</strong>.
                          </p>
                        </div>
                        
                        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 25px 0; border-radius: 8px;">
                          <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; font-weight: 600;">Your Original Message:</p>
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #111827; font-weight: 600;">${updated.subject || "No Subject"}</p>
                          <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">${updated.message?.substring(0, 200) || ""}${updated.message?.length > 200 ? "..." : ""}</p>
                        </div>
                        
                        <p style="margin: 0 0 20px 0; font-size: 14px; color: #374151; line-height: 1.6;">
                          We believe your issue has been addressed. If you need further assistance or would like to reopen this request, please reply to this email or contact us again.
                        </p>
                        
                        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 0 6px 6px 0;">
                          <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                            <strong>📧 Need More Help?</strong> Reply to this email or contact us at <a href="mailto:support@oibre.com" style="color: #d97706; text-decoration: underline;">support@oibre.com</a>
                          </p>
                        </div>
                        
                        <p style="margin: 25px 0 0 0; font-size: 13px; color: #6b7280; line-height: 1.6; text-align: center;">
                          Thank you for contacting Oibre. We appreciate your patience!
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0 0 8px 0; font-size: 14px; color: #111827; font-weight: 600;">Oibre</p>
                        <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280;">Your Local Services Platform</p>
                        <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                          This is an automated notification from Oibre Support.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;
        sendBrevoEmail({ to: updated.email, subject, html }).catch(err => 
          console.error("Contact closed email error:", err)
        );
      }

      // Case 2: Message reopened (was closed, now changed to new or in_progress)
      if (oldStatus === "closed" && newStatus !== "closed") {
        const subject = "Your Oibre Support Request Has Been Reopened";
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px 30px; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🔄 Support Request Reopened</h1>
                        <p style="margin: 10px 0 0 0; color: #d1fae5; font-size: 14px; font-weight: 500;">Oibre Support Team</p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="margin: 0 0 20px 0; font-size: 16px; color: #111827; line-height: 1.6;">
                          Dear <strong>${updated.name || "Valued Customer"}</strong>,
                        </p>
                        
                        <div style="background: #d1fae5; border-left: 4px solid #059669; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                          <p style="margin: 0 0 8px 0; font-size: 12px; color: #065f46; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Status Update</p>
                          <p style="margin: 0; font-size: 15px; color: #047857; font-weight: 600; line-height: 1.5;">
                            Your support request has been <strong>REOPENED</strong> and our team is reviewing it.
                          </p>
                        </div>
                        
                        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 25px 0; border-radius: 8px;">
                          <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; font-weight: 600;">Your Original Message:</p>
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #111827; font-weight: 600;">${updated.subject || "No Subject"}</p>
                          <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">${updated.message?.substring(0, 200) || ""}${updated.message?.length > 200 ? "..." : ""}</p>
                        </div>
                        
                        <p style="margin: 0 0 20px 0; font-size: 14px; color: #374151; line-height: 1.6;">
                          We're taking another look at your request. Our support team will review the details and get back to you as soon as possible.
                        </p>
                        
                        <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0; border-radius: 0 6px 6px 0;">
                          <p style="margin: 0; font-size: 13px; color: #1e3a8a; line-height: 1.5;">
                            <strong>📌 Current Status:</strong> ${newStatus === "new" ? "New - Awaiting Review" : "In Progress - Being Handled"}
                          </p>
                        </div>
                        
                        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 0 6px 6px 0;">
                          <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                            <strong>💬 Additional Information?</strong> If you have more details to add, reply to this email or contact us at <a href="mailto:support@oibre.com" style="color: #d97706; text-decoration: underline;">support@oibre.com</a>
                          </p>
                        </div>
                        
                        <p style="margin: 25px 0 0 0; font-size: 13px; color: #6b7280; line-height: 1.6; text-align: center;">
                          We're here to help you! Thank you for your patience.
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0 0 8px 0; font-size: 14px; color: #111827; font-weight: 600;">Oibre</p>
                        <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280;">Your Local Services Platform</p>
                        <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                          This is an automated notification from Oibre Support.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;
        sendBrevoEmail({ to: updated.email, subject, html }).catch(err => 
          console.error("Contact reopened email error:", err)
        );
      }
    }

    res.json({ message: "Status updated", data: updated });
  } catch (err) {
    console.error("UPDATE CONTACT STATUS ERROR:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

router.post("/contact-messages/:id/reply", async (req, res) => {
  try {
    const messageId = req.params.id;
    const adminMessage = String(req.body?.message || "").trim();
    const customSubject = String(req.body?.subject || "").trim();

    if (!adminMessage) {
      return res.status(400).json({ message: "Reply message is required." });
    }

    const record = await ContactMessage.findById(messageId);
    if (!record) {
      return res.status(404).json({ message: "Contact message not found" });
    }

    if (!record.email) {
      return res.status(400).json({ message: "Customer email is missing for this message." });
    }

    const finalSubject = customSubject || `Re: ${record.subject || "Your message to Oibre"}`;

    queueEmail(
      sendContactReplyEmail({
        to: record.email,
        customerName: record.name,
        subject: finalSubject,
        adminMessage
      }),
      "CONTACT REPLY"
    );

    record.status = "in_progress";
    record.lastReplySubject = finalSubject;
    record.lastReplyMessage = adminMessage;
    record.repliedAt = new Date();
    await record.save();

    res.json({
      message: "Reply email queued successfully.",
      data: {
        id: record._id,
        status: record.status,
        lastReplySubject: record.lastReplySubject,
        lastReplyMessage: record.lastReplyMessage,
        repliedAt: record.repliedAt
      }
    });
  } catch (err) {
    console.error("CONTACT REPLY EMAIL ERROR:", err);
    res.status(500).json({ message: "Failed to send reply email." });
  }
});

/* ===============================
   MIGRATION: UPDATE SERVICE PRICES
================================ */
router.post("/migrate/update-service-prices", async (req, res) => {
  try {
    // Service-based pricing
    const SERVICE_HOURLY_CHARGES = {
      // Basic services
      "Cleaning": 250,
      "Laundry": 250,
      "Taxi": 250,
      "Babysitter": 250,
      "Mover & Packer": 300,
      
      // Skilled services
      "Electrician": 400,
      "Plumber": 350,
      "Mechanic": 400,
      "Carpenter": 400,
      "Painter": 350,
      "Pest Control": 350,
      
      // Professional services
      "AC Service": 500,
      "Appliance Repair": 500,
      "Salon at Home": 600,
      "Tutor": 500
    };

    const providers = await ServiceProvider.find({});
    let updatedCount = 0;
    let skippedCount = 0;
    const updates = [];

    for (const provider of providers) {
      const serviceCategory = provider.serviceCategory;
      const newBasePrice = SERVICE_HOURLY_CHARGES[serviceCategory] || 300;
      const currentPrice = provider.basePrice || 200;

      if (currentPrice !== newBasePrice) {
        provider.basePrice = newBasePrice;
        await provider.save();
        updates.push({
          name: provider.name,
          service: serviceCategory,
          oldPrice: currentPrice,
          newPrice: newBasePrice
        });
        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    res.json({
      message: "Service prices updated successfully",
      updated: updatedCount,
      skipped: skippedCount,
      total: providers.length,
      updates
    });
  } catch (err) {
    console.error("PRICE MIGRATION ERROR:", err);
    res.status(500).json({ message: "Failed to update service prices" });
  }
});

module.exports = router;
