const express = require("express");
const Service = require("../models/Service");

const router = express.Router();

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

module.exports = router;
