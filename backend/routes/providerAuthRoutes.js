const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ServiceProvider = require("../models/ServiceProvider");

const router = express.Router();

/* ===============================
   PROVIDER LOGIN (EMAIL + PASSWORD)
================================ */
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required"
      });
    }

    // 🔑 IMPORTANT: explicitly select password
    const provider = await ServiceProvider
      .findOne({
        email,
        status: "approved",
        verified: true
      })
      .select("+password");

    if (!provider) {
      return res.status(404).json({
        message: "Provider not approved or not found"
      });
    }

    // 🛑 extra safety (prevents bcrypt crash)
    if (!provider.password) {
      return res.status(400).json({
        message: "Provider password not set. Contact admin."
      });
    }

    const isMatch = await bcrypt.compare(password, provider.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid password"
      });
    }

    const token = jwt.sign(
      { id: provider._id, role: "provider" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      provider: {
        id: provider._id,
        name: provider.name,
        email: provider.email,
        serviceCategory: provider.serviceCategory
      }
    });

  } catch (err) {
    console.error("PROVIDER LOGIN ERROR:", err);
    res.status(500).json({
      message: "Login failed"
    });
  }
});

module.exports = router;
