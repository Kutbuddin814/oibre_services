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
    params: async (req, file) => {
      // Generate proper filename without extension (Cloudinary will add it)
      // Sanitize to only allow alphanumeric, hyphens, and underscores
      const originalName = path.parse(file.originalname).name;
      const sanitizedName = originalName
        .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace special chars with underscore
        .replace(/_+/g, '_') // Collapse multiple underscores
        .substring(0, 50); // Limit length
      
      const timestamp = Date.now();
      const publicId = `${sanitizedName}_${timestamp}`;
      
      // Use MIME type to determine resource type (more reliable than extension)
      if (file.mimetype === "application/pdf") {
        return {
          folder: "oibre",
          resource_type: "image",
          public_id: publicId,
          format: "pdf",
          type: "upload"
        };
      }
      
      // Images (jpg, png, jpeg)
      return {
        folder: "oibre",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png"],
        public_id: publicId,
        type: "upload"
      };
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
  upload = multer({ 
    storage, 
    fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB max file size
    }
  });
  console.log("Cloudinary Storage initialized");
} else {
  upload = multer({ 
    storage: localStorage, 
    fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB max file size
    }
  });
  console.log("Using local storage (Cloudinary not configured)");
}

// Wrapper to handle upload and get Cloudinary URLs
const uploadWithCloudinary = (req, res, next) => {
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "skillCertificate", maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    // If Cloudinary is configured, the file URLs are in req.files
    if (isCloudinaryConfigured && req.files) {
      req.fileCloudinaryUrls = {};

      if (req.files.profilePhoto && req.files.profilePhoto[0]) {
        req.fileCloudinaryUrls.profilePhoto = req.files.profilePhoto[0].path;
      }

      if (req.files.skillCertificate && req.files.skillCertificate[0]) {
        req.fileCloudinaryUrls.skillCertificate = req.files.skillCertificate[0].path;
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
