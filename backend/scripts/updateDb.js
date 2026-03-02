const mongoose = require("mongoose");

// Use hardcoded MongoDB URI - update if needed
const mongoUri = "mongodb+srv://oibre:oibre123@oibre.dwiy0.mongodb.net/oibre?retryWrites=true&w=majority";

console.log("MongoDB URI:", mongoUri ? "SET" : "NOT SET");

if (!mongoUri) {
  console.error("MongoDB URI not set!");
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(mongoUri)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Define schemas
const providerRequestSchema = new mongoose.Schema({
  profilePhoto: String,
  skillCertificate: String
}, { collection: 'providerrequests' });

const serviceProviderSchema = new mongoose.Schema({
  profilePhoto: String,
  skillCertificate: String
}, { collection: 'serviceproviders' });

const ProviderRequest = mongoose.model("ProviderRequest", providerRequestSchema);
const ServiceProvider = mongoose.model("ServiceProvider", serviceProviderSchema);

// Mapping of old filenames to Cloudinary URLs (from your upload script output)
const cloudinaryUrlMap = {
  "1769431973941-profilePhoto.png": "https://res.cloudinary.com/dvyd0nzwb/image/upload/v1772385546/oibre/ggikfjdarmxkmtcaswhs.png",
  "1769431974050-skillCertificate.pdf": "https://res.cloudinary.com/dvyd0nzwb/image/upload/v1772385561/oibre/lhft7gvuhsqch9pgplsk.pdf"
};

async function updateCloudinaryUrls() {
  try {
    console.log("\n=== Updating ProviderRequest Collection ===");
    
    const requests = await ProviderRequest.find({
      $or: [
        { profilePhoto: { $regex: /\.(png|jpg|jpeg|pdf)$/i } },
        { skillCertificate: { $regex: /\.(png|jpg|jpeg|pdf)$/i } }
      ]
    });

    console.log(`Found ${requests.length} provider requests with local files`);

    let updatedCount = 0;
    for (const req of requests) {
      let needsUpdate = false;
      const updateObj = {};

      if (req.profilePhoto && cloudinaryUrlMap[req.profilePhoto]) {
        updateObj.profilePhoto = cloudinaryUrlMap[req.profilePhoto];
        needsUpdate = true;
        console.log(`  Updating profilePhoto: ${req.profilePhoto} -> ${updateObj.profilePhoto}`);
      }

      if (req.skillCertificate && cloudinaryUrlMap[req.skillCertificate]) {
        updateObj.skillCertificate = cloudinaryUrlMap[req.skillCertificate];
        needsUpdate = true;
        console.log(`  Updating skillCertificate: ${req.skillCertificate} -> ${updateObj.skillCertificate}`);
      }

      if (needsUpdate) {
        await ProviderRequest.updateOne({ _id: req._id }, { $set: updateObj });
        updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} provider requests\n`);

    console.log("=== Updating ServiceProvider Collection ===");
    
    const providers = await ServiceProvider.find({
      $or: [
        { profilePhoto: { $regex: /\.(png|jpg|jpeg|pdf)$/i } },
        { skillCertificate: { $regex: /\.(png|jpg|jpeg|pdf)$/i } }
      ]
    });

    console.log(`Found ${providers.length} service providers with local files`);

    updatedCount = 0;
    for (const provider of providers) {
      let needsUpdate = false;
      const updateObj = {};

      if (provider.profilePhoto && cloudinaryUrlMap[provider.profilePhoto]) {
        updateObj.profilePhoto = cloudinaryUrlMap[provider.profilePhoto];
        needsUpdate = true;
        console.log(`  Updating profilePhoto: ${provider.profilePhoto} -> ${updateObj.profilePhoto}`);
      }

      if (provider.skillCertificate && cloudinaryUrlMap[provider.skillCertificate]) {
        updateObj.skillCertificate = cloudinaryUrlMap[provider.skillCertificate];
        needsUpdate = true;
        console.log(`  Updating skillCertificate: ${provider.skillCertificate} -> ${updateObj.skillCertificate}`);
      }

      if (needsUpdate) {
        await ServiceProvider.updateOne({ _id: provider._id }, { $set: updateObj });
        updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} service providers\n`);
    console.log("=== Database Update Complete ===");
    
  } catch (error) {
    console.error("Error updating database:", error);
  } finally {
    mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

updateCloudinaryUrls();
