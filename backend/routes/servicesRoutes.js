const express = require("express");
const Service = require("../models/Service");

const router = express.Router();

// Get all services
router.get("/", async (req, res) => {
  try {
    const services = await Service.find({ status: "active" })
      .select("name description icon iconImage status")
      .sort({ name: 1 });

    res.json(services);
  } catch (error) {
    console.error("SERVICES FETCH ERROR:", error);
    res.status(500).json({ message: "Failed to fetch services" });
  }
});

// Get service recommendations based on search query
router.get("/recommendations/:query", async (req, res) => {
  try {
    const searchQuery = decodeURIComponent(req.params.query).trim();

    if (!searchQuery || searchQuery.length === 0) {
      return res.json({
        hasMatches: false,
        exactMatch: null,
        recommendations: [],
        allServices: []
      });
    }

    // Find exact match (if search query matches a service name exactly)
    const exactMatch = await Service.findOne({
      name: { $regex: `^${searchQuery}$`, $options: "i" },
      status: "active"
    }).select("name description icon iconImage");

    // Find services that match the search query (partial match)
    const matchingServices = await Service.find({
      $or: [
        { name: { $regex: searchQuery, $options: "i" } },
        { description: { $regex: searchQuery, $options: "i" } }
      ],
      status: "active"
    })
      .select("name description icon iconImage")
      .sort({ name: 1 });

    // Get all services as fallback recommendations
    const allServices = await Service.find({ status: "active" })
      .select("name description icon iconImage")
      .sort({ name: 1 });

    // Build recommendations: exact match first, then other matching services, then all (limit to 5)
    let recommendations = [];

    if (exactMatch) {
      recommendations.push(exactMatch);
    }

    // Add other matching services (excluding exact match)
    matchingServices.forEach(service => {
      if (!exactMatch || service._id.toString() !== exactMatch._id.toString()) {
        recommendations.push(service);
      }
    });

    // If no matches found, return top services as recommendations
    if (recommendations.length === 0) {
      recommendations = allServices.slice(0, 5);
    } else {
      // Limit to 5 recommendations
      recommendations = recommendations.slice(0, 5);
    }

    res.json({
      hasMatches: matchingServices.length > 0,
      exactMatch: exactMatch || null,
      recommendations,
      totalAvailable: allServices.length,
      searchQuery
    });
  } catch (error) {
    console.error("RECOMMENDATIONS FETCH ERROR:", error);
    res.status(500).json({ message: "Failed to fetch recommendations" });
  }
});

module.exports = router;
