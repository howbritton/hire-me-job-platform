import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaSpinner } from 'react-icons/fa';

const PaymentCancel = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    toast.info('Payment was cancelled');
    
    // Add a small delay before redirecting
    const timeout = setTimeout(() => {
      navigate('/employer/subscription');
    }, 1500);
    
    return () => clearTimeout(timeout);
  }, [navigate]);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
        <FaSpinner className="animate-spin text-amber-500 mx-auto mb-4 text-4xl" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Redirecting...</h2>
        <p className="text-gray-600">Taking you back to the subscription page</p>
      </div>
    </div>
  );
};

export default PaymentCancel;