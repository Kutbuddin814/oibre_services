import React from "react";

const PaymentDetailsReminder = ({ isOpen, onClose, onAddDetails }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
        {/* Icon */}
        <div className="text-5xl mb-4">⚠️</div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Details Required</h2>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          Please add your bank details to receive payouts for completed services. You won't be able to get paid without this information.
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Remind Later
          </button>
          <button
            onClick={onAddDetails}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Add Details Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentDetailsReminder;
