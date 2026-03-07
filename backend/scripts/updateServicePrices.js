require('dotenv').config();
const mongoose = require("mongoose");
const ServiceProvider = require("../models/ServiceProvider");

console.log("🚀 Starting service price migration...\n");

// Service-based pricing (same as registration form)
const SERVICE_HOURLY_CHARGES = {
  // Basic services (₹200 – ₹300 / hour)
  "Cleaning": 250,
  "Laundry": 250,
  "Taxi": 250,
  "Babysitter": 250,
  "Mover & Packer": 300,
  
  // Skilled services (₹300 – ₹500 / hour)
  "Electrician": 400,
  "Plumber": 350,
  "Mechanic": 400,
  "Carpenter": 400,
  "Painter": 350,
  "Pest Control": 350,
  
  // Professional services (₹500 – ₹800 / hour)
  "AC Service": 500,
  "Appliance Repair": 500,
  "Salon at Home": 600,
  "Tutor": 500
};

const updateServicePrices = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error("❌ MONGO_URI not found in environment variables");
      console.log("Make sure .env file exists in backend folder with MONGO_URI");
      process.exit(1);
    }
    
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);

    console.log("✓ Connected to MongoDB");

    // Get all service providers
    const providers = await ServiceProvider.find({});
    console.log(`\nFound ${providers.length} service providers`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const provider of providers) {
      const serviceCategory = provider.serviceCategory;
      const newBasePrice = SERVICE_HOURLY_CHARGES[serviceCategory] || 300;
      const currentPrice = provider.basePrice || 200;

      if (currentPrice !== newBasePrice) {
        provider.basePrice = newBasePrice;
        await provider.save();
        console.log(`✓ Updated ${provider.name} (${serviceCategory}): ₹${currentPrice} → ₹${newBasePrice}`);
        updatedCount++;
      } else {
        console.log(`- Skipped ${provider.name} (${serviceCategory}): Already ₹${currentPrice}`);
        skippedCount++;
      }
    }

    console.log(`\n✅ Migration Complete!`);
    console.log(`   Updated: ${updatedCount} providers`);
    console.log(`   Skipped: ${skippedCount} providers`);
    console.log(`   Total: ${providers.length} providers\n`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration Error:", error.message);
    process.exit(1);
  }
};

updateServicePrices();
