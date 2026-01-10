import React, { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getDatabase, ref, update } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { toast } from 'react-toastify';
import { FaSpinner } from 'react-icons/fa';

const PaymentCallback = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const auth = getAuth();
    const db = getDatabase();
    
    const processPayment = useCallback(async () => {
        try {
            const params = new URLSearchParams(location.search);
            const resultIndicator = params.get('resultIndicator');
            const sessionVersion = params.get('sessionVersion');
            
            if (!resultIndicator) {
                throw new Error('Payment verification failed');
            }
            
            // Update payment status if needed
            if (auth.currentUser) {
                const paymentRef = ref(db, `payments/${auth.currentUser.uid}`);
                await update(paymentRef, {
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    sagicorResponse: {
                        resultIndicator,
                        sessionVersion,
                        processedAt: new Date().toISOString()
                    }
                });
            }
            
            navigate('/payment/success');
            toast.success('Payment processed successfully');
        } catch (error) {
            console.error('Payment verification failed:', error);
            navigate('/payment/failure');
            toast.error('Payment verification failed');
        }
    }, [navigate, location.search, auth, db]);
    
    useEffect(() => {
        processPayment();
    }, [processPayment]);
    
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
                <FaSpinner className="animate-spin text-blue-600 mx-auto mb-4 text-4xl" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Payment</h2>
                <p className="text-gray-600">Please wait while we verify your payment...</p>
            </div>
        </div>
    );
};

export default PaymentCallback;