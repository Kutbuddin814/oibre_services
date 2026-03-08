const express = require("express");
const router = express.Router();
const ServiceRequest = require("../models/ServiceRequest");
const {
  createRazorpayOrder,
  verifyRazorpaySignature,
  fetchPaymentDetails,
  refundPayment
} = require("../utils/razorpayClient");
const customerAuthMiddleware = require("../middleware/customerAuthMiddleware");

/**
 * POST /api/payments/create-order
 * Create a Razorpay payment order for service completion
 * Requires: serviceRequestId, paymentMethod
 */
router.post("/create-order", customerAuthMiddleware, async (req, res) => {
  try {
    const { serviceRequestId, paymentMethod } = req.body;
    const customerId = String(req.customer?._id || "");

    if (!serviceRequestId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "serviceRequestId and paymentMethod are required"
      });
    }

    if (!["cod", "online"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method. Use 'cod' or 'online'"
      });
    }

    // Find service request and verify customer owns it
    const serviceRequest = await ServiceRequest.findById(serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: "Service request not found"
      });
    }

    if (serviceRequest.customerId.toString() !== customerId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized - not your order"
      });
    }

    // Check if price was approved
    if (serviceRequest.priceStatus !== "price_approved") {
      return res.status(400).json({
        success: false,
        message: "Price not yet approved by customer"
      });
    }

    if (!serviceRequest.finalPrice) {
      return res.status(400).json({
        success: false,
        message: "Final price not set"
      });
    }

    // Update payment method
    serviceRequest.paymentMethod = paymentMethod;

    // If COD, mark as success immediately
    if (paymentMethod === "cod") {
      serviceRequest.paymentStatus = "cod_paid";
      serviceRequest.payoutStatus = "pending"; // Initialize payout status for admin settlement
      serviceRequest.paidAt = new Date();
      await serviceRequest.save();

      return res.json({
        success: true,
        message: "COD payment method selected",
        paymentMethod: "cod",
        amount: serviceRequest.finalPrice,
        status: "cod_paid"
      });
    }

    // If online payment, create Razorpay order
    const razorpayResult = await createRazorpayOrder(
      serviceRequest.finalPrice,
      serviceRequestId,
      customerId
    );

    if (!razorpayResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to create payment order",
        error: razorpayResult.error
      });
    }

    // Store Razorpay order ID
    serviceRequest.razorpayOrderId = razorpayResult.order.id;
    serviceRequest.paymentStatus = "pending";
    await serviceRequest.save();

    return res.json({
      success: true,
      message: "Payment order created",
      paymentMethod: "online",
      razorpayOrderId: razorpayResult.order.id,
      amount: razorpayResult.order.amount / 100, // Convert back to rupees
      currency: razorpayResult.order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_123456789"
    });
  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating payment order",
      error: error.message
    });
  }
});

/**
 * POST /api/payments/verify
 * Verify Razorpay payment and update booking status
 * Requires: serviceRequestId, razorpayOrderId, razorpayPaymentId, razorpaySignature
 */
router.post("/verify", customerAuthMiddleware, async (req, res) => {
  try {
    const {
      serviceRequestId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    } = req.body;
    const customerId = String(req.customer?._id || "");

    if (!serviceRequestId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment verification fields"
      });
    }

    // Find service request
    const serviceRequest = await ServiceRequest.findById(serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: "Service request not found"
      });
    }

    if (serviceRequest.customerId.toString() !== customerId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized - not your order"
      });
    }

    // Verify signature
    const isValid = verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      serviceRequest.paymentStatus = "failed";
      serviceRequest.paymentFailureReason = "Invalid signature";
      await serviceRequest.save();

      return res.status(400).json({
        success: false,
        message: "Payment verification failed - invalid signature"
      });
    }

    // Fetch payment details from Razorpay to double-check
    const paymentDetails = await fetchPaymentDetails(razorpayPaymentId);

    if (!paymentDetails.success || paymentDetails.payment.status !== "captured") {
      serviceRequest.paymentStatus = "failed";
      serviceRequest.paymentFailureReason = "Payment not captured by Razorpay";
      await serviceRequest.save();

      return res.status(400).json({
        success: false,
        message: "Payment verification failed - payment not captured"
      });
    }

    // Payment successful - update service request
    serviceRequest.razorpayOrderId = razorpayOrderId;
    serviceRequest.razorpayPaymentId = razorpayPaymentId;
    serviceRequest.razorpaySignature = razorpaySignature;
    serviceRequest.paymentStatus = "online_paid";
    serviceRequest.payoutStatus = "pending"; // Initialize payout status for admin settlement
    serviceRequest.paidAt = new Date();
    await serviceRequest.save();

    return res.json({
      success: true,
      message: "Payment verified and processed successfully",
      paymentStatus: "online_paid",
      amount: serviceRequest.finalPrice
    });
  } catch (error) {
    console.error("Verify Payment Error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying payment",
      error: error.message
    });
  }
});

/**
 * GET /api/payments/status/:serviceRequestId
 * Get current payment status for a service request
 */
router.get("/status/:serviceRequestId", customerAuthMiddleware, async (req, res) => {
  try {
    const { serviceRequestId } = req.params;
    const customerId = String(req.customer?._id || "");

    const serviceRequest = await ServiceRequest.findById(serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: "Service request not found"
      });
    }

    if (serviceRequest.customerId.toString() !== customerId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    res.json({
      success: true,
      paymentStatus: serviceRequest.paymentStatus,
      paymentMethod: serviceRequest.paymentMethod,
      amount: serviceRequest.finalPrice,
      paidAt: serviceRequest.paidAt,
      priceStatus: serviceRequest.priceStatus
    });
  } catch (error) {
    console.error("Get Payment Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payment status",
      error: error.message
    });
  }
});

/**
 * POST /api/payments/refund
 * Process refund for a cancelled service request
 */
router.post("/refund", customerAuthMiddleware, async (req, res) => {
  try {
    const { serviceRequestId, amount } = req.body;
    const customerId = String(req.customer?._id || "");

    const serviceRequest = await ServiceRequest.findById(serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: "Service request not found"
      });
    }

    if (serviceRequest.customerId.toString() !== customerId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (!["online_paid", "cod_paid"].includes(serviceRequest.paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Only paid bookings can be refunded"
      });
    }

    if (!serviceRequest.razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        message: "No online payment found for refund"
      });
    }

    // Process refund
    const refundResult = await refundPayment(
      serviceRequest.razorpayPaymentId,
      amount || serviceRequest.finalPrice
    );

    if (!refundResult.success) {
      return res.status(500).json({
        success: false,
        message: "Refund processing failed",
        error: refundResult.error
      });
    }

    // Update payment status
    serviceRequest.paymentStatus = "refunded";
    serviceRequest.paymentFailureReason = `Refunded: ${refundResult.refund.amount} INR`;
    await serviceRequest.save();

    res.json({
      success: true,
      message: "Refund processed successfully",
      refundId: refundResult.refund.id,
      amount: refundResult.refund.amount
    });
  } catch (error) {
    console.error("Refund Error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing refund",
      error: error.message
    });
  }
});

module.exports = router;
