import React, { useState } from "react";
import axios from "../config/axios";

const PaymentModal = ({ isOpen, serviceRequest, onClose, onSuccess }) => {
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !serviceRequest) return null;

  /**
   * Handle COD Payment
   */
  const handleCODPayment = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.post("/payments/create-order", {
        serviceRequestId: serviceRequest._id,
        paymentMethod: "cod"
      });

      if (response.data.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.data.message || "Failed to confirm COD");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error processing COD");
      console.error("COD Error:", err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Online Payment with Razorpay
   */
  const handleOnlinePayment = async () => {
    setLoading(true);
    setError("");

    try {
      // Step 1: Create Razorpay Order
      const orderResponse = await axios.post("/payments/create-order", {
        serviceRequestId: serviceRequest._id,
        paymentMethod: "online"
      });

      if (!orderResponse.data.success) {
        setError(orderResponse.data.message || "Failed to create payment order");
        setLoading(false);
        return;
      }

      const { razorpayOrderId, amount, keyId } = orderResponse.data;

      // Step 2: Load Razorpay script
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;

      script.onload = () => {
        // Step 3: Open Razorpay modal
        const options = {
          key: keyId,
          amount: Math.round(amount * 100), // Convert to paise
          currency: "INR",
          name: "Oibre Services",
          description: `Service Request #${serviceRequest._id}`,
          order_id: razorpayOrderId,
          handler: async function (response) {
            // Step 4: Verify payment on backend
            try {
              const verifyResponse = await axios.post("/payments/verify", {
                serviceRequestId: serviceRequest._id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              });

              if (verifyResponse.data.success) {
                onSuccess();
                onClose();
              } else {
                setError("Payment verification failed");
                setLoading(false);
              }
            } catch (err) {
              setError("Payment verification error: " + (err.response?.data?.message || err.message));
              setLoading(false);
            }
          },
          prefill: {
            email: serviceRequest.customerEmail || "",
            contact: serviceRequest.customerPhone || ""
          },
          theme: {
            color: "#2563eb"
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
              setError("Payment cancelled by user");
            }
          }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      };

      script.onerror = () => {
        setError("Failed to load payment gateway. Please try again.");
        setLoading(false);
      };

      document.body.appendChild(script);
    } catch (err) {
      setError(err.response?.data?.message || "Error initiating payment");
      console.error("Payment Error:", err);
      setLoading(false);
    }
  };

  const handlePayment = paymentMethod === "cod" ? handleCODPayment : handleOnlinePayment;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Payment</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Order Summary */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-2">Amount Due</p>
          <p className="text-3xl font-bold text-blue-600">₹{serviceRequest.finalPrice}</p>
          <p className="text-xs text-gray-500 mt-2">Request ID: {serviceRequest._id.slice(0, 8)}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Payment Method Selection */}
        <div className="space-y-3 mb-6">
          <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer transition-all hover:border-blue-400"
            style={{ borderColor: paymentMethod === "cod" ? "#2563eb" : "#e5e7eb" }}>
            <input
              type="radio"
              name="paymentMethod"
              value="cod"
              checked={paymentMethod === "cod"}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-4 h-4 text-blue-600"
              disabled={loading}
            />
            <span className="ml-3">
              <span className="font-semibold text-gray-900 block">Cash on Delivery</span>
              <span className="text-sm text-gray-500">Pay after service completion</span>
            </span>
          </label>

          <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer transition-all hover:border-blue-400"
            style={{ borderColor: paymentMethod === "online" ? "#2563eb" : "#e5e7eb" }}>
            <input
              type="radio"
              name="paymentMethod"
              value="online"
              checked={paymentMethod === "online"}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-4 h-4 text-blue-600"
              disabled={loading}
            />
            <span className="ml-3">
              <span className="font-semibold text-gray-900 block">Online Payment</span>
              <span className="text-sm text-gray-500">Secure payment via Razorpay</span>
            </span>
          </label>
        </div>

        {/* Info Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-800">
          {paymentMethod === "cod"
            ? "Payment will be collected by the service provider after completing the work."
            : "You'll be redirected to a secure payment page."}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                Processing...
              </>
            ) : paymentMethod === "cod" ? (
              "Confirm COD"
            ) : (
              "Pay Now"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
