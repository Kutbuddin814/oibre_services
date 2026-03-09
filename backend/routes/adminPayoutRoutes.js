const express = require("express");
const router = express.Router();
const ServiceRequest = require("../models/ServiceRequest");
const ServiceProvider = require("../models/ServiceProvider");
const adminAuth = require("../middleware/adminAuth");
const { sendBrevoEmail } = require("../utils/sendEmail");

const COMMISSION_PERCENTAGE = 10; // 10% commission
const PENDING_PAYOUT_MATCH = {
  $or: [
    { payoutStatus: "pending" },
    { payoutStatus: { $exists: false } },
    { payoutStatus: null }
  ]
};

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
          ...PENDING_PAYOUT_MATCH
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
          estimatedPrice: 1,
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
      // Use finalPrice if available, otherwise use estimatedPrice, otherwise 0
      const amount = payout.finalPrice || payout.estimatedPrice || 0;
      const commission = Math.round(amount * COMMISSION_PERCENTAGE / 100);
      const providerEarning = amount - commission;

      return {
        ...payout,
        totalAmount: amount,
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
        $unwind: {
          path: "$provider",
          preserveNullAndEmptyArrays: true
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
          estimatedPrice: 1,
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

    if (booking.payoutStatus && booking.payoutStatus !== "pending") {
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

    // Calculate commission and earning with fallback for missing finalPrice
    const amount = booking.finalPrice || booking.estimatedPrice || 0;
    const commission = Math.round(amount * COMMISSION_PERCENTAGE / 100);
    const providerEarning = amount - commission;

    // Update booking with payout details
    booking.payoutStatus = "paid";
    booking.payoutAmount = providerEarning;
    booking.commission = commission;
    booking.providerEarning = providerEarning;
    booking.payoutDate = new Date();
    booking.paidByAdmin = adminName;

    await booking.save();

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
 * POST /api/admin/payouts/:bookingId/remind-payment-details
 * Send reminder email to provider to add bank/payment details
 */
router.post("/:bookingId/remind-payment-details", adminAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await ServiceRequest.findById(bookingId).select(
      "providerId providerName serviceCategory"
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const provider = await ServiceProvider.findById(booking.providerId).select(
      "name email paymentDetailsCompleted"
    );

    if (!provider || !provider.email) {
      return res.status(404).json({
        success: false,
        message: "Provider email not found"
      });
    }

    if (provider.paymentDetailsCompleted) {
      return res.status(400).json({
        success: false,
        message: "Provider has already completed payment details"
      });
    }

    const providerPortalUrl = process.env.PROVIDER_APP_URL || "https://oibre-services-provider-web-fronten.vercel.app";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fb; margin: 0; padding: 0; }
            .container { max-width: 620px; margin: 24px auto; }
            .header { background: #1f2937; color: #fff; padding: 28px 24px; border-radius: 10px 10px 0 0; text-align: center; }
            .logo { font-size: 34px; font-weight: 700; margin: 0; }
            .badge { display: inline-block; margin-top: 12px; background: #f59e0b; color: #fff; padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; }
            .content { background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; padding: 24px; }
            .title { margin: 0 0 12px; color: #111827; font-size: 22px; font-weight: 700; }
            .subtitle { margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.6; }
            .warn { background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 12px 14px; margin: 16px 0; color: #92400e; font-size: 14px; }
            .cta-wrap { text-align: center; margin: 22px 0 8px; }
            .cta { display: inline-block; background: #2563eb; color: #fff !important; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 700; }
            .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 14px; color: #6b7280; font-size: 12px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="logo">Oibre</h1>
              <div class="badge">Payment Details Needed</div>
            </div>
            <div class="content">
              <h2 class="title">Hi ${provider.name || booking.providerName || "Provider"},</h2>
              <p class="subtitle">Please add your bank/payment details to receive payouts for completed services.</p>
              <div class="warn">
                Your booking payout cannot be processed until account details are completed.
                <br />Service: <strong>${booking.serviceCategory || "Service"}</strong>
              </div>
              <div class="cta-wrap">
                <a class="cta" href="${providerPortalUrl}/profile">Open Profile & Add Details</a>
              </div>
              <div class="footer">
                This is an automated reminder from Oibre Admin.<br />
                Add account holder name, account number, IFSC and UPI (if available).
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const sent = await sendBrevoEmail({
      to: provider.email,
      subject: "Action Required: Add Your Payment Details - Oibre",
      html
    });

    if (!sent?.sent) {
      return res.status(500).json({
        success: false,
        message: sent?.reason || "Failed to send reminder email"
      });
    }

    return res.json({
      success: true,
      message: "Reminder email sent to provider"
    });
  } catch (error) {
    console.error("Send Payment Reminder Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error sending reminder email",
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
      ...PENDING_PAYOUT_MATCH
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
