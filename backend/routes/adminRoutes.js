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
      
      // Handle profilePhoto - check if it's already a Cloudinary URL
      if (reqObj.profilePhoto) {
        if (reqObj.profilePhoto.startsWith('http')) {
          // Already a Cloudinary URL
          reqObj.profilePhoto = reqObj.profilePhoto;
        } else if (isCloudinaryConfigured) {
          // Cloudinary is configured but stored as filename - construct URL
          reqObj.profilePhoto = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/oibre/${reqObj.profilePhoto}`;
        } else {
          // Local storage
          reqObj.profilePhoto = `${baseURL}/uploads/${reqObj.profilePhoto}`;
        }
      }
      
      // Handle skillCertificate - check if it's already a Cloudinary URL
      if (reqObj.skillCertificate) {
        if (reqObj.skillCertificate.startsWith('http')) {
          // Already a Cloudinary URL - use as is
          reqObj.skillCertificate = reqObj.skillCertificate;
        } else if (isCloudinaryConfigured) {
          // Cloudinary is configured but stored as filename
          // Check if it's a PDF - PDFs are stored as raw files
          const ext = String(reqObj.skillCertificate).split('.').pop().toLowerCase();
          if (ext === 'pdf') {
            // PDF stored as raw - use /raw/upload/
            reqObj.skillCertificate = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/oibre/${reqObj.skillCertificate}`;
          } else {
            // Image - use /image/upload/
            reqObj.skillCertificate = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/oibre/${reqObj.skillCertificate}`;
          }
        } else {
          // Local storage
          reqObj.skillCertificate = `${baseURL}/uploads/${reqObj.skillCertificate}`;
        }
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

router.delete("/users/:id", async (req, res) => {
  try {
    const user = await Customer.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted" });
  } catch {
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

    request.status = "rejected";
    request.adminNote = (req.body?.adminNote || "").trim();
    await request.save();

    res.json({ message: "Removal request rejected" });
  } catch {
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

    const updated = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { status: String(status) },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Contact message not found" });
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

module.exports = router;
