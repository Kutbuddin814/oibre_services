const Razorpay = require("razorpay");
const crypto = require("crypto");

// Initialize Razorpay with API credentials
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_123456789",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "test_secret_123456"
});

/**
 * Create a Razorpay Order
 * @param {Number} amount - Amount in paise (multiply rupees by 100)
 * @param {String} orderId - Your internal order ID
 * @param {String} customerId - Customer email or ID
 * @returns {Promise} Razorpay order details
 */
async function createRazorpayOrder(amount, orderId, customerId) {
  try {
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: "INR",
      receipt: orderId,
      payment_capture: 1, // Auto-capture payment
      notes: {
        serviceRequestId: orderId,
        customerId: customerId
      }
    };

    const order = await razorpayInstance.orders.create(options);
    return {
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      }
    };
  } catch (error) {
    console.error("Razorpay Order Creation Error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verify Razorpay Payment Signature
 * @param {String} orderId - Razorpay Order ID
 * @param {String} paymentId - Razorpay Payment ID
 * @param {String} signature - Razorpay Signature
 * @returns {Boolean} True if signature is valid
 */
function verifyRazorpaySignature(orderId, paymentId, signature) {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET || "test_secret_123456";
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    return expectedSignature === signature;
  } catch (error) {
    console.error("Signature Verification Error:", error);
    return false;
  }
}

/**
 * Fetch Payment Details from Razorpay
 * @param {String} paymentId - Razorpay Payment ID
 * @returns {Promise} Payment details
 */
async function fetchPaymentDetails(paymentId) {
  try {
    const payment = await razorpayInstance.payments.fetch(paymentId);
    return {
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        orderId: payment.order_id
      }
    };
  } catch (error) {
    console.error("Fetch Payment Error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Refund a Payment
 * @param {String} paymentId - Razorpay Payment ID
 * @param {Number} amount - Amount to refund in rupees
 * @returns {Promise} Refund details
 */
async function refundPayment(paymentId, amount = null) {
  try {
    const options = {
      speed: "optimum"
    };

    if (amount) {
      options.amount = Math.round(amount * 100); // Convert to paise
    }

    const refund = await razorpayInstance.payments.refund(paymentId, options);
    return {
      success: true,
      refund: {
        id: refund.id,
        paymentId: refund.payment_id,
        amount: refund.amount / 100, // Convert back to rupees
        status: refund.status
      }
    };
  } catch (error) {
    console.error("Refund Error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  razorpayInstance,
  createRazorpayOrder,
  verifyRazorpaySignature,
  fetchPaymentDetails,
  refundPayment
};
