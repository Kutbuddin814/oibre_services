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

    const total = categories.length;

      res.json({
        success: true,
        categories: grouped,
        total
      });
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

    // Build query (case-insensitive, urgency, location)
    let query = {
      serviceCategory: { $regex: serviceType, $options: "i" },
      status: "approved",
      verified: true
    };
    if (urgency === "emergency") query.emergencyAvailable = true;
    if (urgency === "today") query.availableToday = true;
    // 'later' = no extra filter
    if (lat && lng) {
      query.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat]
          },
          $maxDistance: 30000 // 30km
        }
      };
    } else if (location) {
      query.location = { $regex: location, $options: "i" };
    }

    let providers = await ServiceProvider.find(query)
      .select("name serviceCategory averageRating reviewCount basePrice pricePerKm profilePhoto emergencyAvailable availableToday responseTime location")
      .lean();

    // Calculate distances if coordinates provided
    if (lat && lng) {
      providers = providers.map(p => {
        let plat, plng;
        if (
          p.location &&
          Array.isArray(p.location.coordinates) &&
          p.location.coordinates.length === 2
        ) {
          [plng, plat] = p.location.coordinates;
        } else {
          return null; // skip invalid provider
        }
        const dx = plat - lat;
        const dy = plng - lng;
        const distance = Math.sqrt(dx * dx + dy * dy) * 111;
        const finalDistance = Math.round(distance * 10) / 10;

        const distanceCharge = Math.round(finalDistance * 10);

        const totalPrice = p.basePrice + distanceCharge;

        return {
          ...p,
          distance: finalDistance,
          finalPrice: totalPrice,
          basePrice: p.basePrice,
          distanceCharge   // 🔥 ADD THIS
        };
      }).filter(Boolean);;
    }

    // Smart sorting
    let sortedProviders = [...providers];
    if (sortBy === "rating") {
      sortedProviders.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    } else if (sortBy === "distance") {
      sortedProviders.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    } else if (sortBy === "price") {
      sortedProviders.sort((a, b) => (a.finalPrice || a.basePrice) - (b.finalPrice || b.basePrice));
    } else if (sortBy === "response") {
      sortedProviders.sort((a, b) => (a.responseTime || 9999) - (b.responseTime || 9999));
    }

    // Group providers by sort type for recommended sections
    const topRated = [...providers]
      .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
      .slice(0, 4);
    const nearest = [...providers]
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, 4);
    const budget = [...providers]
      .sort((a, b) => (a.finalPrice || a.basePrice) - (b.finalPrice || b.basePrice))
      .slice(0, 4);

    // Fallback if no providers found
    if (providers.length === 0) {
      return res.json({
        success: true,
        message: "❌ No providers found near you",
        options: [
          { label: "Change location", value: "change-location" },
          { label: "Try different service", value: "try-different-service" },
          { label: "Request callback", value: "callback" }
        ],
        all: [],
        topRated: [],
        nearest: [],
        budget: [],
        total: 0
      });
    }

    res.json({
      success: true,
      all: sortedProviders.slice(0, limit),
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

    const favoritesRaw = await ServiceProvider.find({
      _id: { $in: customer.favoriteProviders }
    })
      .select("name profileImage averageRating basePrice pricePerKm location")
      .lean();

    const favorites = favoritesRaw.map((p) => {
      // 🔥 TEMP distance (same for all)
      const distance = 5;

      // 🔥 Calculate distance charge
      const distanceCharge = Math.round(distance * (p.pricePerKm || 10));

      // 🔥 Final price (same as chatbot)
      const finalPrice = p.basePrice + distanceCharge;

      return {
        ...p,
        distance,
        distanceCharge,
        finalPrice
      };
    });

    res.json({ success: true, favorites });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Route is already correct: /chatbot/favorites/save
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
      serviceCategory: { $regex: serviceType, $options: "i" },
      status: "approved",
      verified: true
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