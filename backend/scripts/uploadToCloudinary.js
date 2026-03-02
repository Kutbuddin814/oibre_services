const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const cloudinary = require("cloudinary").v2;
const fs = require("fs");

// Check if Cloudinary is configured
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

console.log("Cloudinary Config Check:");
console.log("CLOUDINARY_CLOUD_NAME:", cloudName || "NOT SET");
console.log("CLOUDINARY_API_KEY:", apiKey || "NOT SET");
console.log("CLOUDINARY_API_SECRET:", apiSecret ? "SET" : "NOT SET");

if (!cloudName || !apiKey || !apiSecret) {
  console.error("\n❌ Error: Cloudinary environment variables are not set!");
  console.error("Please add these to your .env file:");
  console.error("CLOUDINARY_CLOUD_NAME=your_cloud_name");
  console.error("CLOUDINARY_API_KEY=your_api_key");
  console.error("CLOUDINARY_API_SECRET=your_api_secret");
  process.exit(1);
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret
});

const uploadsDir = path.join(__dirname, "../uploads");

async function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    const options = {
      folder: "oibre",
      resource_type: "auto"
    };
    
    cloudinary.uploader.upload(filePath, options, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

async function uploadAllFiles() {
  try {
    if (!fs.existsSync(uploadsDir)) {
      console.log("Uploads directory not found!");
      return;
    }

    const files = fs.readdirSync(uploadsDir);
    console.log(`\nFound ${files.length} files to upload\n`);
    
    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const stat = fs.statSync(filePath);
      
      // Skip directories
      if (stat.isDirectory()) continue;
      
      console.log(`Uploading: ${file}...`);
      
      try {
        const result = await uploadFile(filePath);
        console.log(`✓ Uploaded: ${file} -> ${result.secure_url}`);
        successCount++;
      } catch (error) {
        console.log(`✗ Failed: ${file} - ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n=== Upload Summary ===`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total: ${files.length}`);
    
  } catch (error) {
    console.error("Error:", error);
  }
}

uploadAllFiles();
