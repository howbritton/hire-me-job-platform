import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCheck, FaArrowLeft, FaSpinner, FaCreditCard } from 'react-icons/fa';
import { getDatabase, ref, set } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { toast } from 'react-toastify';

const OrderConfirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const auth = getAuth();
  const [user] = useAuthState(auth);
  const db = getDatabase();

  // Get package details from location state
  const selectedPackage = location.state?.package;
  const isUpgrade = location.state?.isUpgrade;
  const isDowngrade = location.state?.isDowngrade;
  const currentSubscription = location.state?.currentSubscription;

  // Handle missing data
  if (!selectedPackage || !user) {
    navigate('/pricing');
    return null;
  }

  const handleConfirmOrder = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const orderId = `ORDER-${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
      const amount = selectedPackage.proRatedPrice || selectedPackage.price;
      const now = new Date().toISOString();

      // Prepare subscription data
      const subscriptionData = {
        isUpgrade: Boolean(isUpgrade),
        isDowngrade: Boolean(isDowngrade)
      };

      // Only add currentPackageId if it exists
      if (currentSubscription?.package?.id) {
        subscriptionData.currentPackageId = currentSubscription.package.id;
      }

      // Create checkout session data
      const checkoutSessionData = {
        orderId,
        amount: amount * 100, // Store in cents for payment processing
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        userId: user.uid,
        userEmail: user.email,
        status: 'pending',
        checkoutMode: 'WEBSITE',
        createdAt: now,
        currency: 'USD',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes expiry
        package: {
          ...selectedPackage,
          price: amount
        },
        subscription: subscriptionData
      };

      // Create payment data
      const paymentData = {
        orderId,
        amount,
        createdAt: now,
        employerEmail: user.email,
        employerId: user.uid,
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        paymentMethod: 'card',
        status: 'pending'
      };

      // Create initial checkout session and payment entry
      await Promise.all([
        set(ref(db, `checkoutSessions/${orderId}`), checkoutSessionData),
        set(ref(db, `payments/${user.uid}/${orderId}`), paymentData)
      ]);

      // Navigate to checkout
      navigate('/checkout', {
        state: {
          orderId,
          package: selectedPackage,
          isUpgrade,
          isDowngrade,
          currentSubscription
        }
      });
    } catch (error) {
      console.error('Error creating order:', error);
      setError('Failed to create order. Please try again.');
      toast.error('Failed to create order. Please try again.');
      setLoading(false);
    }
  };

  const getDurationText = () => {
    if (selectedPackage.duration === 30) return '1 Month';
    if (selectedPackage.duration === 90) return '3 Months';
    if (selectedPackage.duration === 180) return '6 Months';
    if (selectedPackage.duration === 365) return '1 Year';
    return `${selectedPackage.duration} Days`;
  };

  const getJobPostText = () => {
    if (selectedPackage.jobPostLimit === -1) return 'Unlimited Job Posts';
    return `${selectedPackage.jobPostLimit} Job Post${selectedPackage.jobPostLimit !== 1 ? 's' : ''}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/pricing')}
              className="text-blue-600 hover:text-blue-800 flex items-center"
            >
              <FaArrowLeft className="mr-2" />
              Back to Pricing
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Order Confirmation</h1>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Package Details
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600">Package Name</span>
                  <span className="font-medium text-gray-900">{selectedPackage.name}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600">Duration</span>
                  <span className="font-medium text-gray-900">{getDurationText()}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600">Job Posts</span>
                  <span className="font-medium text-gray-900">{getJobPostText()}</span>
                </div>

                {Object.entries(selectedPackage.features || {}).map(([feature, enabled]) => (
                  <div key={feature} className="flex items-center py-2">
                    <FaCheck className={`${enabled ? 'text-green-500' : 'text-gray-300'} mr-2`} />
                    <span className="text-gray-600">
                      {feature.split(/(?=[A-Z])/).join(' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total Amount</span>
                <span>USD ${selectedPackage.proRatedPrice || selectedPackage.price}</span>
              </div>

              {isUpgrade && selectedPackage.proRatedPrice && (
                <p className="text-sm text-gray-500 mt-2">
                  Pro-rated price calculated based on your current subscription
                </p>
              )}
            </div>

            <button
              onClick={handleConfirmOrder}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center space-x-2 transition duration-150"
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <FaCreditCard className="mr-2" />
                  <span>Proceed to Payment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;