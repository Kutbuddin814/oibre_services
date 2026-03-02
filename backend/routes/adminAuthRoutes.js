const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const AdminUser = require("../models/AdminUser");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

const ADMIN_SIGNUP_KEY = process.env.ADMIN_SIGNUP_KEY || "oibre123";

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, adminKey } = req.body;

    if (!name || !email || !password || !adminKey) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (adminKey !== ADMIN_SIGNUP_KEY) {
      return res.status(403).json({ message: "Invalid admin signup key" });
    }

    const existing = await AdminUser.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await AdminUser.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword
    });

    console.log("Admin created successfully:", admin.email);

    return res.status(201).json({
      message: "Admin account created",
      adminId: admin._id
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Signup failed", error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Missing email or password" });
    }

    const admin = await AdminUser.findOne({ email: email.toLowerCase() }).select("+password");
    if (!admin) {
      console.log("Admin not found for email:", email.toLowerCase());
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      console.log("Password mismatch for admin:", email);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Login failed", error: err.message });
  }
});

router.get("/me", adminAuth, async (req, res) => {
  try {
    const admin = await AdminUser.findById(req.adminId).select("-password");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    return res.json(admin);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch profile" });
  }
});

router.put("/change-password", adminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const admin = await AdminUser.findById(req.adminId).select("+password");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const isCurrentValid = await bcrypt.compare(String(currentPassword), admin.password);
    if (!isCurrentValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const isSamePassword = await bcrypt.compare(String(newPassword), admin.password);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    admin.password = await bcrypt.hash(String(newPassword), 10);
    await admin.save();

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Admin change-password error:", err);
    return res.status(500).json({ message: "Failed to change password" });
  }
});

module.exports = router;
