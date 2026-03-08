const express = require("express");
const router = express.Router();
const ServiceProvider = require("../models/ServiceProvider");
const authMiddleware = require("../middleware/authMiddleware");

/**
 * GET /api/provider/payment-details
 * Get provider's saved payment details
 */
router.get("/payment-details", authMiddleware, async (req, res) => {
  try {
    const provider = await ServiceProvider.findById(req.providerId).select(
      "paymentDetails paymentDetailsCompleted"
    );

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found"
      });
    }

    res.json({
      success: true,
      paymentDetails: provider.paymentDetails || {},
      paymentDetailsCompleted: provider.paymentDetailsCompleted || false
    });
  } catch (error) {
    console.error("Get Payment Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payment details",
      error: error.message
    });
  }
});

/**
 * PUT /api/provider/payment-details
 * Update provider's payment details
 */
router.put("/payment-details", authMiddleware, async (req, res) => {
  try {
    const {
      accountHolderName,
      accountNumber,
      ifscCode,
      upiId,
      panNumber
    } = req.body;

    // Validate required fields
    if (!accountHolderName || !accountNumber || !ifscCode) {
      return res.status(400).json({
        success: false,
        message: "Account Holder Name, Account Number, and IFSC Code are required"
      });
    }

    // Validate account number (basic check - Indian bank accounts are typically 9-18 digits)
    if (!/^\d{9,18}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account number format"
      });
    }

    // Validate IFSC code (format: 4 letters + 0 + 6 digits)
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid IFSC code format (e.g., HDFC0001234)"
      });
    }

    // Validate UPI if provided
    if (upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/.test(upiId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid UPI format (e.g., name@bank)"
      });
    }

    // Validate PAN if provided
    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid PAN format"
      });
    }

    // Update provider's payment details
    const provider = await ServiceProvider.findByIdAndUpdate(
      req.providerId,
      {
        paymentDetails: {
          accountHolderName: accountHolderName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.toUpperCase(),
          upiId: upiId ? upiId.trim() : undefined,
          panNumber: panNumber ? panNumber.trim() : undefined
        },
        paymentDetailsCompleted: true
      },
      { new: true }
    ).select("paymentDetails paymentDetailsCompleted");

    res.json({
      success: true,
      message: "Payment details updated successfully",
      paymentDetails: provider.paymentDetails,
      paymentDetailsCompleted: provider.paymentDetailsCompleted
    });
  } catch (error) {
    console.error("Update Payment Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating payment details",
      error: error.message
    });
  }
});

module.exports = router;
