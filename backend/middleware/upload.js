const multer = require("multer");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const fs = require("fs");

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Create Cloudinary storage engine
const createCloudinaryStorage = () => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "oibre",
      allowed_formats: ["jpg", "jpeg", "png", "pdf"],
      resource_type: "auto"
    }
  });
};

// Local storage fallback (for development when Cloudinary not configured)
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)
    );
  }
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype === "application/pdf"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

// Use Cloudinary if configured, otherwise use local storage
let upload;
const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && 
                                process.env.CLOUDINARY_API_KEY && 
                                process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  const storage = createCloudinaryStorage();
  upload = multer({ storage, fileFilter });
  console.log("Cloudinary Storage initialized");
} else {
  upload = multer({ storage: localStorage, fileFilter });
  console.log("Using local storage (Cloudinary not configured)");
}

// Wrapper to handle upload and get Cloudinary URLs
const uploadWithCloudinary = async (req, res, next) => {
  upload.any()(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    // If Cloudinary is configured, the file URLs are in req.files[].path
    if (isCloudinaryConfigured && req.files) {
      req.fileCloudinaryUrls = {};
      for (const file of req.files) {
        // Cloudinary stores the URL in file.path
        if (file.path) {
          req.fileCloudinaryUrls[file.fieldname] = file.path;
        }
      }
    }
    next();
  });
};

// Function to copy uploaded file to other backends (for local storage)
const copyFileToBackends = (filename) => {
  if (isCloudinaryConfigured) {
    console.log("File copy not needed - using Cloudinary");
    return;
  }

  const sourcePath = path.join(__dirname, "../uploads", filename);
  
  // Target directories for other backends
  const targetDirs = [
    path.join(__dirname, "../../admin/backend/uploads"),
    path.join(__dirname, "../../customer/backend/uploads"),
    path.join(__dirname, "../../service-provider-web/backend/uploads")
  ];

  targetDirs.forEach(targetDir => {
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.copyFileSync(sourcePath, path.join(targetDir, filename));
      console.log(`✅ Copied ${filename} to ${targetDir}`);
    } catch (err) {
      console.error(`Error copying file to ${targetDir}:`, err.message);
    }
  });
};

module.exports = { upload, uploadWithCloudinary, copyFileToBackends };
