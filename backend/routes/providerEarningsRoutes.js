const express = require("express");
const router = express.Router();
const ServiceRequest = require("../models/ServiceRequest");
const authMiddleware = require("../middleware/authMiddleware");

/**
 * GET /api/provider/earnings/summary
 * Get provider's earnings summary
 */
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const providerId = req.providerId;

    // Get all completed bookings with online payment for this provider
    const completedBookings = await ServiceRequest.find({
      providerId: providerId,
      status: "completed",
      paymentStatus: "online_paid"
    }).select("finalPrice commission providerEarning payoutStatus payoutDate");

    // Calculate totals
    let totalEarned = 0;
    let pendingPayout = 0;
    let paidEarnings = 0;
    let pendingCount = 0;
    let paidCount = 0;

    completedBookings.forEach((booking) => {
      const earning = booking.providerEarning || (booking.finalPrice * 0.9); // 90% to provider

      totalEarned += earning;

      if (booking.payoutStatus === "paid") {
        paidEarnings += earning;
        paidCount++;
      } else {
        pendingPayout += earning;
        pendingCount++;
      }
    });

    res.json({
      success: true,
      earnings: {
        totalEarned: Math.round(totalEarned),
        pendingPayout: Math.round(pendingPayout),
        paidEarnings: Math.round(paidEarnings),
        totalBookings: completedBookings.length,
        pendingCount: pendingCount,
        paidCount: paidCount
      }
    });
  } catch (error) {
    console.error("Get Earnings Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching earnings summary",
      error: error.message
    });
  }
});

/**
 * GET /api/provider/earnings/history
 * Get provider's detailed earnings history
 */
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const providerId = req.providerId;

    const bookings = await ServiceRequest.find({
      providerId: providerId,
      status: "completed",
      paymentStatus: "online_paid"
    })
      .select(
        "serviceCategory finalPrice commission providerEarning payoutStatus payoutDate customerName createdAt"
      )
      .sort({ createdAt: -1 });

    const history = bookings.map((booking) => {
      const earning = booking.providerEarning || Math.round(booking.finalPrice * 0.9);
      const commission = booking.commission || Math.round(booking.finalPrice * 0.1);

      return {
        bookingId: booking._id,
        serviceCategory: booking.serviceCategory,
        customerName: booking.customerName,
        totalAmount: booking.finalPrice,
        commission: commission,
        earning: earning,
        payoutStatus: booking.payoutStatus || "pending",
        payoutDate: booking.payoutDate,
        serviceDate: booking.createdAt
      };
    });

    res.json({
      success: true,
      count: history.length,
      history: history
    });
  } catch (error) {
    console.error("Get Earnings History Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching earnings history",
      error: error.message
    });
  }
});

module.exports = router;
