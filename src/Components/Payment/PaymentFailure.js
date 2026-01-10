import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimesCircle, FaRedo, FaHeadset } from 'react-icons/fa';

const PaymentFailure = () => {
  const navigate = useNavigate();
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
        <FaTimesCircle className="text-red-600 mx-auto mb-4 text-5xl" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Payment Failed</h2>
        <p className="text-gray-600 mb-4">
          We couldn't process your payment. This could be due to:
        </p>
        <ul className="text-left text-gray-600 mb-6 space-y-1 pl-6 list-disc">
          <li>Insufficient funds</li>
          <li>Invalid card details</li>
          <li>Transaction declined by bank</li>
          <li>Network connectivity issues</li>
        </ul>
        <div className="space-y-3">
          <button
            onClick={() => navigate('/checkout')}
            className="w-full bg-blue-950 text-white py-3 px-4 rounded-lg hover:bg-blue-900 flex items-center justify-center space-x-2"
          >
            <FaRedo className="mr-2" />
            <span>Try Again</span>
          </button>
          <button
            onClick={() => navigate('/contact')}
            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 flex items-center justify-center space-x-2"
          >
            <FaHeadset className="mr-2" />
            <span>Contact Support</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailure;