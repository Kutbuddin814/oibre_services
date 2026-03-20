const express = require("express");
const router = express.Router();
const ServiceProvider = require("../models/ServiceProvider");
const Service = require("../models/Service");
const ServiceRequest = require("../models/ServiceRequest");
const Customer = require("../models/Customer");
const customerAuth = require("../middleware/customerAuth");
const CallbackRequest = require("../models/CallbackRequest");

// ==================== SERVICE CATEGORIES ====================
router.get("/services/categories", async (req, res) => {
  try {
    const categories = await Service.find({ isActive: true })
      .select("name category icon description estimatedPrice")
      .sort({ name: 1 });

    const grouped = {};
    categories.forEach((cat) => {
      const categoryKey = String(cat.category || cat.name || "General").trim();
      if (!grouped[categoryKey]) {
        grouped[categoryKey] = [];
      }
      grouped[categoryKey].push(cat);
    });

    res.json({ success: true, categories: grouped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== PROBLEM-BASED SELECTION ====================
router.get("/services/problems/:category", async (req, res) => {
  try {
    const { category } = req.params;
    
    // Search by exact category or by name (for fallback)
    const problems = await Service.find({
      $or: [
        { category: category },
        { name: category }
      ],
      isActive: true
    })
      .select("name estimatedPrice description")
      .limit(10);

    // If no results, return all active services as fallback
    let results = problems;
    if (results.length === 0) {
      results = await Service.find({ isActive: true })
        .select("name estimatedPrice description")
        .limit(10);
    }

    res.json({ success: true, problems: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== SMART PROVIDER FILTERING ====================
router.post("/providers/search", async (req, res) => {
  try {
    const { 
      serviceType, 
      category,
      location, 
      lat, 
      lng, 
      urgency = "regular", 
      sortBy = "rating",
      limit = 5 
    } = req.body;

    // Build query
    let query = {
      serviceCategory: category || serviceType,
      isActive: true,
      isVerified: true
    };

    // Location filtering
    if (lat && lng) {
      const radius = urgency === "emergency" ? 5 : 15; // 5km for emergency, 15km regular
      query.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat]
          },
          $maxDistance: radius * 1000 // Convert km to meters
        }
      };
    } else if (location) {
      query.location = { $regex: location, $options: "i" };
    }

    // Availability filtering
    if (urgency === "emergency") {
      query.emergencyAvailable = true;
    } else if (urgency === "today") {
      query.availableToday = true;
    }

    let providers = await ServiceProvider.find(query)
      .select("name serviceCategory rating totalReviews price distance profileImage emergencyAvailable availableToday responseTime")
      .lean();

    // Calculate distances if coordinates provided
    if (lat && lng) {
      providers = providers.map(p => {
        const dx = p.lat - lat;
        const dy = p.lng - lng;
        const distance = Math.sqrt(dx * dx + dy * dy) * 111; // Rough km conversion
        return { ...p, distance: Math.round(distance * 10) / 10 };
      });
    }

    // Smart sorting
    if (sortBy === "rating") {
      providers.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "distance") {
      providers.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    } else if (sortBy === "price") {
      providers.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === "response") {
      providers.sort((a, b) => (a.responseTime || 9999) - (b.responseTime || 9999));
    }

    // Group providers by sort type for recommended sections
    const topRated = providers.sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);
    const nearest = providers.sort((a, b) => (a.distance || 0) - (b.distance || 0)).slice(0, 3);
    const budget = providers.sort((a, b) => (a.price || 0) - (b.price || 0)).slice(0, 3);

    res.json({
      success: true,
      all: providers.slice(0, limit),
      topRated,
      nearest,
      budget,
      total: providers.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== PROVIDER DETAILS FOR CHATBOT ====================
router.get("/provider/:providerId/chat-preview", async (req, res) => {
  try {
    const { providerId } = req.params;
    const provider = await ServiceProvider.findById(providerId)
      .select(
        "name profileImage rating totalReviews price serviceCategory distance responseTime emergencyAvailable reviews"
      )
      .lean();

    if (!provider) {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    // Get top 2 reviews
    const recentReviews = (provider.reviews || [])
      .slice(0, 2)
      .map((r) => ({
        rating: r.rating,
        comment: r.comment?.substring(0, 80)
      }));

    const trusted = {
      isVerified: provider.isVerified || false,
      backgroundChecked: provider.backgroundChecked || false,
      experienced: (provider.yearExperience || 0) > 2
    };

    res.json({
      success: true,
      provider: {
        id: provider._id,
        name: provider.name,
        image: provider.profileImage,
        rating: provider.rating,
        reviews: provider.totalReviews,
        price: provider.price,
        distance: provider.distance,
        responseTime: provider.responseTime,
        emergency: provider.emergencyAvailable,
        trusted,
        recentReviews,
        category: provider.serviceCategory
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== FAVORITES / SAVED ====================
router.get("/favorites", customerAuth, async (req, res) => {
  try {
    const { customerId } = req;
    const customer = await Customer.findById(customerId)
      .select("favoriteProviders")
      .lean();

    if (!customer || !customer.favoriteProviders) {
      return res.json({ success: true, favorites: [] });
    }

    const favorites = await ServiceProvider.find({
      _id: { $in: customer.favoriteProviders }
    })
      .select("name profileImage rating price distance")
      .lean();

    res.json({ success: true, favorites });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/favorites/save", customerAuth, async (req, res) => {
  try {
    const { customerId } = req;
    const { providerId } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer.favoriteProviders) {
      customer.favoriteProviders = [];
    }

    if (!customer.favoriteProviders.includes(providerId)) {
      customer.favoriteProviders.push(providerId);
      await customer.save();
    }

    res.json({ success: true, message: "Saved to favorites" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/favorites/remove", customerAuth, async (req, res) => {
  try {
    const { customerId } = req;
    const { providerId } = req.body;

    const customer = await Customer.findById(customerId);
    customer.favoriteProviders = (customer.favoriteProviders || []).filter(
      (id) => id.toString() !== providerId
    );
    await customer.save();

    res.json({ success: true, message: "Removed from favorites" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== RECENT SEARCHES ====================
router.get("/searches/recent", customerAuth, async (req, res) => {
  try {
    const { customerId } = req;
    const customer = await Customer.findById(customerId)
      .select("recentChatbotSearches")
      .lean();

    const recent = (customer?.recentChatbotSearches || []).slice(0, 5);
    res.json({ success: true, recent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/searches/log", customerAuth, async (req, res) => {
  try {
    const { customerId } = req;
    const { serviceType, location } = req.body;

    await Customer.findByIdAndUpdate(
      customerId,
      {
        $push: {
          recentChatbotSearches: {
            $each: [{ serviceType, location, timestamp: new Date() }],
            $slice: -10 // Keep only last 10 searches
          }
        }
      },
      { new: true }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== PRICE ESTIMATION ====================
router.get("/estimate/price", async (req, res) => {
  try {
    const { serviceType, problem } = req.query;

    const service = await Service.findOne({
      $or: [
        { name: { $regex: problem || serviceType, $options: "i" } },
        { category: { $regex: serviceType, $options: "i" } }
      ]
    })
      .select("estimatedPrice priceRange")
      .lean();

    if (!service) {
      return res.json({ success: true, estimate: null });
    }

    res.json({
      success: true,
      estimate: {
        min: service.priceRange?.min || service.estimatedPrice * 0.8,
        max: service.priceRange?.max || service.estimatedPrice * 1.2,
        base: service.estimatedPrice
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== AVAILABILITY CHECK ====================
router.post("/check/availability", async (req, res) => {
  try {
    const { serviceType, location, urgency } = req.body;

    const query = {
      serviceCategory: serviceType,
      isActive: true
    };

    if (urgency === "emergency") {
      query.emergencyAvailable = true;
    } else if (urgency === "today") {
      query.availableToday = true;
    }

    const available = await ServiceProvider.countDocuments(query);

    res.json({
      success: true,
      available,
      hasProviders: available > 0,
      message:
        available > 0
          ? `Found ${available} providers available`
          : "No providers available. Would you like to request a callback?"
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== REQUEST CALLBACK ====================
router.post("/request-callback", customerAuth, async (req, res) => {
  try {
    const { customerId } = req;
    const { serviceType, location, preferredTime } = req.body;

    const callbackRequest = new CallbackRequest({
      customerId,
      serviceType,
      location,
      preferredTime,
      status: "pending"
    });
    await callbackRequest.save();

    res.json({
      success: true,
      message: "Request received. We'll notify you when a provider is available.",
      callbackId: callbackRequest._id
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
