require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

// ===============================
// MIDDLEWARE
// ===============================
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://oibre-service-provider-frontend.vercel.app",
  "https://oibre-customer-frontend.vercel.app",
  "https://oibre-admin-frontend.vercel.app",
  "https://oibre-services-provider-web-fronten.vercel.app",
  process.env.REACT_APP_ADMIN_API_URL?.replace(/\/$/, ""),
  process.env.REACT_APP_CUSTOMER_API_URL?.replace(/\/$/, ""),
  process.env.REACT_APP_PROVIDER_API_URL?.replace(/\/$/, ""),
  process.env.REACT_APP_PROVIDER_WEB_API_URL?.replace(/\/$/, "")
].filter(Boolean);

console.log("✅ Allowed Origins:", allowedOrigins);
console.log("🌍 Environment Frontend URLs loaded");

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (same-server requests)
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn("⚠️  CORS Blocked - Origin:", origin);
        // For production, keep it strict. For debugging, you can allow all.
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// Preflight handler
app.options("*", cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disable ETag and caching for API responses
app.disable("etag");
app.use((req, res, next) => {
  if (req.headers) {
    delete req.headers['if-none-match'];
    delete req.headers['if-modified-since'];
  }
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

// Serve uploaded files from single uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===============================
// DATABASE CONNECTIONS
// ===============================
const ADMIN_MONGO_URI = process.env.ADMIN_MONGO_URI;
const CUSTOMER_MONGO_URI = process.env.CUSTOMER_MONGO_URI;
const PROVIDER_MONGO_URI = process.env.PROVIDER_MONGO_URI;
const PROVIDER_WEB_MONGO_URI = process.env.PROVIDER_WEB_MONGO_URI;

// Helper to connect to a database

// ===============================
// SERVER
// ===============================
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");

    app.listen(PORT, () => {
      console.log(`🚀 Oibre combined backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Failed:", err);
  });

// ===============================
// ROUTES
// ===============================

// Admin Routes
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adminPayoutRoutes = require("./routes/adminPayoutRoutes");
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/payouts", adminPayoutRoutes);

// Customer Routes
const customerAuthRoutes = require("./routes/customerAuthRoutes");
const customerRequestRoutes = require("./routes/customerRequestRoutes");
const providerRoutes = require("./routes/providerRoutes");
const notificationRoutes = require("./routes/notifications");
const reviewRoutes = require("./routes/reviews");
const servicesRoutes = require("./routes/servicesRoutes");
const contactRoutes = require("./routes/contactRoutes");

app.use("/api/customers", customerAuthRoutes);
app.use("/api/customer/requests", customerRequestRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/customer/notifications", notificationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/contact", contactRoutes);

// Payment Routes
const paymentRoutes = require("./routes/paymentRoutes");
app.use("/api/payments", paymentRoutes);

// Service Provider Web Routes
const providerAuthRoutes = require("./routes/providerAuthRoutes");
const providerProfileRoutes = require("./routes/providerProfileRoutes");
const providerRequestsRoutes = require("./routes/providerRequestsRoutes");
const providerPaymentRoutes = require("./routes/providerPaymentRoutes");
const providerEarningsRoutes = require("./routes/providerEarningsRoutes");

app.use("/api/provider/auth", providerAuthRoutes);
app.use("/api/provider", providerProfileRoutes);
app.use("/api/provider/payment", providerPaymentRoutes);
app.use("/api/provider/earnings", providerEarningsRoutes);
app.use("/api/provider/requests", providerRequestsRoutes);

// Public Services Endpoint (No authentication required)
const Service = require("./models/Service");
/*
app.get("/api/admin/services", async (req, res) => {
  try {
    const services = await Service.find({ status: "active" }).sort({ name: 1 });
    res.json(services);
  } catch (err) {
    console.error("Error fetching services:", err);
    res.status(500).json({ message: "Failed to fetch services" });
  }
});

*/

// Test route
app.get("/", (req, res) => {
  res.send("Oibre Backend Running - Combined");
});
app.get("/health", (req, res) => {
  res.status(200).json({ status: "Server is running" });
});
