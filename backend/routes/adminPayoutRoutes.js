const express = require("express");
const router = express.Router();
const ServiceRequest = require("../models/ServiceRequest");
const ServiceProvider = require("../models/ServiceProvider");
const adminAuth = require("../middleware/adminAuth");

const COMMISSION_PERCENTAGE = 10; // 10% commission

/**
 * GET /api/admin/payouts/pending
 * Get all pending payouts (completed, online_paid, not yet settled)
 */
router.get("/pending", adminAuth, async (req, res) => {
  try {
    // Find all completed bookings with online payment that haven't been paid to provider yet
    const pendingPayouts = await ServiceRequest.aggregate([
      {
        $match: {
          status: "completed",
          paymentStatus: "online_paid",
          payoutStatus: "pending"
        }
      },
      {
        $lookup: {
          from: "serviceproviders",
          localField: "providerId",
          foreignField: "_id",
          as: "provider"
        }
      },
      {
        $unwind: {
          path: "$provider",
          preserveNullAndEmptyArrays: true // Keep records even if no provider found
        }
      },
      {
        $project: {
          _id: 1,
          bookingId: "$_id",
          providerId: 1,
          providerName: 1,
          providerEmail: { $ifNull: ["$provider.email", ""] },
          providerPhone: { $ifNull: ["$provider.mobile", ""] },
          paymentDetails: { $ifNull: ["$provider.paymentDetails", null] },
          paymentDetailsCompleted: { $ifNull: ["$provider.paymentDetailsCompleted", false] },
          serviceCategory: 1,
          finalPrice: 1,
          paymentStatus: 1,
          completedAt: "$updatedAt",
          createdAt: 1
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    // Add commission and earning calculations
    const payoutsWithCalculations = pendingPayouts.map((payout) => {
      const commission = Math.round(payout.finalPrice * COMMISSION_PERCENTAGE / 100);
      const providerEarning = payout.finalPrice - commission;

      return {
        ...payout,
        totalAmount: payout.finalPrice,
        commission: commission,
        providerEarning: providerEarning,
        canPay: payout.paymentDetailsCompleted // Can only pay if details are complete
      };
    });

    res.json({
      success: true,
      count: payoutsWithCalculations.length,
      payouts: payoutsWithCalculations,
      commissionPercentage: COMMISSION_PERCENTAGE
    });
  } catch (error) {
    console.error("Get Pending Payouts Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching pending payouts",
      error: error.message
    });
  }
});

/**
 * GET /api/admin/payouts/history
 * Get all settled payouts
 */
router.get("/history", adminAuth, async (req, res) => {
  try {
    const paidPayouts = await ServiceRequest.aggregate([
      {
        $match: {
          status: "completed",
          paymentStatus: "online_paid",
          payoutStatus: "paid"
        }
      },
      {
        $lookup: {
          from: "serviceproviders",
          localField: "providerId",
          foreignField: "_id",
          as: "provider"
        }
      },
      {
        $unwind: "$provider"
      },
      {
        $project: {
          _id: 1,
          bookingId: "$_id",
          providerId: 1,
          providerName: 1,
          providerEmail: "$provider.email",
          serviceCategory: 1,
          finalPrice: 1,
          commission: 1,
          providerEarning: 1,
          payoutDate: 1,
          paidByAdmin: 1,
          createdAt: 1
        }
      },
      {
        $sort: { payoutDate: -1 }
      }
    ]);

    res.json({
      success: true,
      count: paidPayouts.length,
      payouts: paidPayouts
    });
  } catch (error) {
    console.error("Get Payout History Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payout history",
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/payouts/:bookingId/mark-paid
 * Mark a payout as paid
 */
router.put("/:bookingId/mark-paid", adminAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { adminName } = req.body;

    if (!adminName) {
      return res.status(400).json({
        success: false,
        message: "Admin name is required"
      });
    }

    // Find the booking
    const booking = await ServiceRequest.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Check if booking is eligible for settlement
    if (booking.status !== "completed" || booking.paymentStatus !== "online_paid") {
      return res.status(400).json({
        success: false,
        message: "Booking not eligible for payout (must be completed with online payment)"
      });
    }

    if (booking.payoutStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Payout already settled"
      });
    }

    // Check provider payment details
    const provider = await ServiceProvider.findById(booking.providerId);

    if (!provider || !provider.paymentDetailsCompleted) {
      return res.status(400).json({
        success: false,
        message: "Provider has not completed payment details. Cannot process payout."
      });
    }

    // Calculate commission and earning
    const commission = Math.round(booking.finalPrice * COMMISSION_PERCENTAGE / 100);
    const providerEarning = booking.finalPrice - commission;

    // Update booking with payout details
    booking.payoutStatus = "paid";
    booking.payoutAmount = providerEarning;
    booking.commission = commission;
    booking.providerEarning = providerEarning;
    booking.payoutDate = new Date();
    booking.paidByAdmin = adminName;

    await booking.save();

    // TODO: In future, send email to provider confirming payout

    res.json({
      success: true,
      message: "Payout marked as paid successfully",
      payout: {
        bookingId: booking._id,
        totalAmount: booking.finalPrice,
        commission: commission,
        providerEarning: providerEarning,
        payoutDate: booking.payoutDate,
        paidByAdmin: adminName
      }
    });
  } catch (error) {
    console.error("Mark Payout Paid Error:", error);
    res.status(500).json({
      success: false,
      message: "Error marking payout as paid",
      error: error.message
    });
  }
});

/**
 * GET /api/admin/payouts/summary
 * Get payout summary statistics
 */
router.get("/summary", adminAuth, async (req, res) => {
  try {
    const summary = await ServiceRequest.aggregate([
      {
        $match: {
          status: "completed",
          paymentStatus: "online_paid"
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$finalPrice" },
          totalCommission: {
            $sum: {
              $multiply: ["$finalPrice", COMMISSION_PERCENTAGE / 100]
            }
          },
          totalProviderEarnings: {
            $sum: {
              $multiply: [
                "$finalPrice",
                { $subtract: [1, COMMISSION_PERCENTAGE / 100] }
              ]
            }
          },
          bookingCount: { $sum: 1 }
        }
      }
    ]);

    const summaryData = summary[0] || {
      totalRevenue: 0,
      totalCommission: 0,
      totalProviderEarnings: 0,
      bookingCount: 0
    };

    // Count pending and paid
    const pendingCount = await ServiceRequest.countDocuments({
      status: "completed",
      paymentStatus: "online_paid",
      payoutStatus: "pending"
    });

    const paidCount = await ServiceRequest.countDocuments({
      status: "completed",
      paymentStatus: "online_paid",
      payoutStatus: "paid"
    });

    res.json({
      success: true,
      summary: {
        ...summaryData,
        totalRevenue: Math.round(summaryData.totalRevenue),
        totalCommission: Math.round(summaryData.totalCommission),
        totalProviderEarnings: Math.round(summaryData.totalProviderEarnings),
        pendingPayoutsCount: pendingCount,
        paidPayoutsCount: paidCount
      }
    });
  } catch (error) {
    console.error("Get Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching summary",
      error: error.message
    });
  }
});

module.exports = router;
