import React, { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, get, update } from 'firebase/database';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import { FaCrown, FaCheck, FaTimes, FaClock, FaExclamationTriangle, FaHourglass } from 'react-icons/fa';

const EMAIL_SERVICE_URL = 'http://34.228.74.248:3001';

const EmployerProfile = () => {
  const [profile, setProfile] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    subscription: null,
    allPackages: [],
    pendingPayments: []
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activePlan, setActivePlan] = useState(null);

  const auth = getAuth(app);
  const db = getDatabase(app);

  const sendPackageExpirationNotification = async (packageData) => {
    try {
      const response = await fetch(`${EMAIL_SERVICE_URL}/notify-package-expiration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packageData }),
      });

      if (!response.ok) {
        throw new Error('Failed to send package expiration notification');
      }
    } catch (error) {
      console.error('Error sending package notification:', error);
      throw error;
    }
  };

  // UPDATED: Function to get pending payments
  const getPendingPayments = useCallback(async (userId) => {
    try {
      const paymentsRef = ref(db, `payments/${userId}`);
      const paymentsSnapshot = await get(paymentsRef);
      
      if (!paymentsSnapshot.exists()) {
        return [];
      }

      const payments = paymentsSnapshot.val();
      
      // Get pending payments
      const pendingPayments = Object.entries(payments)
        .filter(([id, payment]) => payment.status === 'pending')
        .map(([id, payment]) => ({
          id,
          ...payment,
          createdAt: new Date(payment.createdAt)
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
      
      return pendingPayments;
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      return [];
    }
  }, [db]);

  // UPDATED: Function to calculate subscription from APPROVED payments only
  const calculateSubscriptionFromPayments = useCallback(async (userId) => {
    try {
      // Get the user's payment history
      const paymentsRef = ref(db, `payments/${userId}`);
      const paymentsSnapshot = await get(paymentsRef);
      
      if (!paymentsSnapshot.exists()) {
        return null;
      }

      const payments = paymentsSnapshot.val();
      
      // Get the most recent APPROVED payment (not just completed)
      const approvedPayments = Object.entries(payments)
        .filter(([id, payment]) => payment.status === 'approved' || payment.status === 'completed')
        .map(([id, payment]) => ({
          id,
          ...payment,
          createdAt: new Date(payment.createdAt)
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
      
      if (approvedPayments.length === 0) {
        return null;
      }

      const latestPayment = approvedPayments[0];
      
      // Get package details
      const packageRef = ref(db, `packages/${latestPayment.packageId}`);
      const packageSnapshot = await get(packageRef);
      
      if (!packageSnapshot.exists()) {
        // Package doesn't exist, but we have payment data
        const paymentDate = latestPayment.createdAt;
        const subscriptionEndDate = new Date(paymentDate);
        subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30); // Default 30 days
        
        const now = new Date();
        const isActive = subscriptionEndDate > now;
        
        return {
          package: {
            id: latestPayment.packageId,
            name: latestPayment.packageName || 'Package',
            price: latestPayment.amount,
            features: {}
          },
          startDate: paymentDate.toISOString(),
          endDate: subscriptionEndDate.toISOString(),
          status: isActive ? 'active' : 'expired',
          paymentStatus: 'approved',
          paymentId: latestPayment.id,
          paymentDate: paymentDate.toISOString()
        };
      }

      const packageData = packageSnapshot.val();
      
      // Calculate subscription end date based on payment date + package duration
      const paymentDate = latestPayment.createdAt;
      const subscriptionEndDate = new Date(paymentDate);
      subscriptionEndDate.setDate(subscriptionEndDate.getDate() + (packageData.duration || 30));
      
      const now = new Date();
      const isActive = subscriptionEndDate > now;
      
      return {
        package: {
          id: latestPayment.packageId,
          name: packageData.name,
          price: latestPayment.amount,
          duration: packageData.duration,
          features: packageData.features || {},
          jobPostLimit: packageData.jobPostLimit
        },
        startDate: paymentDate.toISOString(),
        endDate: subscriptionEndDate.toISOString(),
        status: isActive ? 'active' : 'expired',
        paymentStatus: 'approved',
        paymentId: latestPayment.id,
        paymentDate: paymentDate.toISOString()
      };
      
    } catch (error) {
      console.error('Error calculating subscription from payments:', error);
      return null;
    }
  }, [db]);

  const fetchProfile = useCallback(async () => {
    try {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }

      // First check the main employer data
      const employerRef = ref(db, `employers/${auth.currentUser.uid}`);
      const employerSnap = await get(employerRef);
      
      let initialData = {};
      
      // If we have data from the initial registration
      if (employerSnap.exists()) {
        const employerData = employerSnap.val();
        initialData = {
          firstName: employerData.firstName || '',
          lastName: employerData.lastName || '',
          companyName: employerData.companyName || '',
          email: employerData.email || '',
          phone: employerData.phone || ''
        };
      }

      // Then check for profile-specific data
      const profileRef = ref(db, `employers/${auth.currentUser.uid}/profile`);
      const packagesRef = ref(db, 'packages');
      const jobsRef = ref(db, 'jobs');
      
      const [profileSnap, packagesSnap, jobsSnap] = await Promise.all([
        get(profileRef),
        get(packagesRef),
        get(jobsRef)
      ]);
      
      // Merge profile data with initial data - profile data takes precedence
      let profileData = initialData;
      if (profileSnap.exists()) {
        profileData = {
          ...initialData,
          ...profileSnap.val()
        };
      } else if (Object.keys(initialData).length > 0) {
        // If we have initial data but no profile data, create the profile
        await update(profileRef, {
          ...initialData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      let allPackages = [];
      let currentSubscription = null;
      let currentPlan = null;
      let jobsCount = 0;
      let pendingPayments = [];

      // Calculate jobs posted
      if (jobsSnap.exists()) {
        const jobsData = jobsSnap.val();
        // Count jobs for this employer across all job collections
        Object.keys(jobsData).forEach(employerId => {
          if (employerId === auth.currentUser.uid) {
            jobsCount += Object.keys(jobsData[employerId]).length;
          }
        });
      }

      if (packagesSnap.exists()) {
        allPackages = Object.entries(packagesSnap.val())
          .map(([id, data]) => ({ id, ...data }))
          .filter(pkg => pkg.status === 'active')
          .sort((a, b) => a.price - b.price);
      }

      // UPDATED: Get pending payments
      pendingPayments = await getPendingPayments(auth.currentUser.uid);

      // UPDATED: Calculate subscription from APPROVED payments only
      currentSubscription = await calculateSubscriptionFromPayments(auth.currentUser.uid);
      
      if (currentSubscription) {
        currentPlan = allPackages.find(pkg => pkg.id === currentSubscription.package.id) || currentSubscription.package;
        
        // Check for expiration and send notification if needed
        const currentDate = new Date();
        const endDate = new Date(currentSubscription.endDate);
        const daysRemaining = Math.ceil((endDate - currentDate) / (1000 * 60 * 60 * 24));

        // Only send notifications for active subscriptions that haven't been notified yet
        if ([30, 14, 7, 3, 1].includes(daysRemaining) && currentSubscription.status === 'active') {
          const employerEmail = profileData.email || auth.currentUser.email;

          try {
            await sendPackageExpirationNotification({
              employerEmail,
              packageName: currentSubscription.package.name,
              expirationDate: currentSubscription.endDate,
              daysRemaining,
              features: currentSubscription.package.features,
              jobPostLimit: currentSubscription.package.jobPostLimit,
              jobsPosted: jobsCount
            });

            console.log(`Expiration notification sent for ${daysRemaining} days remaining`);
          } catch (error) {
            console.error('Error sending expiration notification:', error);
          }
        }
      }

      setProfile({
        ...profileData,
        subscription: currentSubscription,
        allPackages,
        jobsPosted: jobsCount,
        pendingPayments
      });

      setActivePlan(currentPlan);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Error loading profile data');
      setLoading(false);
    }
  }, [auth.currentUser, db, calculateSubscriptionFromPayments, getPendingPayments]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const profileRef = ref(db, `employers/${auth.currentUser.uid}/profile`);
      const updates = {
        companyName: profile.companyName,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        updatedAt: new Date().toISOString()
      };
      
      await update(profileRef, updates);
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Error updating profile');
    }
  };

  const getDaysRemaining = () => {
    if (!profile.subscription?.endDate) return 0;
    const end = new Date(profile.subscription.endDate);
    const now = new Date();
    const diffTime = end - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getSubscriptionStatus = () => {
    // If there are pending payments, show pending status
    if (profile.pendingPayments && profile.pendingPayments.length > 0) {
      return 'pending_approval';
    }

    if (!profile.subscription) return 'inactive';
    
    // Use the calculated status from approved payments
    if (profile.subscription.status === 'expired') return 'expired';
    if (profile.subscription.status === 'active') {
      const daysRemaining = getDaysRemaining();
      if (daysRemaining <= 0) return 'expired';
      if (daysRemaining <= 7) return 'expiring';
      return 'active';
    }
    
    return 'inactive';
  };

  // NEW: Get the most recent pending payment for display
  const getLatestPendingPayment = () => {
    if (!profile.pendingPayments || profile.pendingPayments.length === 0) return null;
    return profile.pendingPayments[0]; // Already sorted by date desc
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  const subscriptionStatus = getSubscriptionStatus();
  const latestPendingPayment = getLatestPendingPayment();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* UPDATED: Subscription Status Banner with Pending Support */}
      {(activePlan || latestPendingPayment) && (
        <div className={`mb-6 p-4 rounded-lg ${
          subscriptionStatus === 'pending_approval' ? 'bg-yellow-50 text-yellow-800' :
          subscriptionStatus === 'expired' ? 'bg-red-50 text-red-800' :
          subscriptionStatus === 'expiring' ? 'bg-orange-50 text-orange-800' :
          'bg-green-50 text-green-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {subscriptionStatus === 'active' && <FaCheck className="text-green-500" />}
              {subscriptionStatus === 'expiring' && <FaClock className="text-orange-500" />}
              {subscriptionStatus === 'expired' && <FaTimes className="text-red-500" />}
              {subscriptionStatus === 'pending_approval' && <FaHourglass className="text-yellow-500" />}
              <span className="font-medium">
                {subscriptionStatus === 'active' && 'Active Subscription'}
                {subscriptionStatus === 'expiring' && 'Subscription Expiring Soon'}
                {subscriptionStatus === 'expired' && 'Subscription Expired'}
                {subscriptionStatus === 'pending_approval' && 'Payment Pending Admin Approval'}
              </span>
            </div>
            <Link
              to="/pricing"
              className="text-sm font-medium hover:underline"
            >
              View Plans
            </Link>
          </div>
          
          {/* Show pending payment details */}
          {subscriptionStatus === 'pending_approval' && latestPendingPayment && (
            <div className="mt-3 p-3 bg-white rounded border border-yellow-200">
              <div className="flex items-start space-x-3">
                <FaExclamationTriangle className="text-yellow-500 mt-1" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Package: {latestPendingPayment.packageName}
                  </p>
                  <p className="text-sm text-yellow-700">
                    Amount: ${latestPendingPayment.amount} | Submitted: {formatDate(latestPendingPayment.createdAt)}
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Your payment is being reviewed by our admin team. You will receive an email notification once approved.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-950">Company Profile</h2>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-950 rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors"
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Company Information</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name
              </label>
              <input
                type="text"
                name="companyName"
                value={profile.companyName}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                name="firstName"
                value={profile.firstName}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                value={profile.lastName}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={profile.email}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={profile.phone}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        {/* UPDATED: Subscription Information with Pending Support */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Subscription</h3>
          
          {/* Show pending payments first if any */}
          {profile.pendingPayments && profile.pendingPayments.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-800 mb-3">Pending Payments</h4>
              <div className="space-y-3">
                {profile.pendingPayments.map((payment) => (
                  <div key={payment.id} className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FaHourglass className="text-yellow-500" />
                        <div>
                          <h5 className="font-medium text-yellow-800">
                            {payment.packageName || 'Package'}
                          </h5>
                          <p className="text-sm text-yellow-700">
                            Amount: ${payment.amount} | Order: {payment.orderId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-yellow-600">
                          Submitted: {formatDate(payment.createdAt)}
                        </p>
                        <p className="text-xs text-yellow-600">
                          Awaiting admin approval
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show active subscription if any */}
          {profile.subscription ? (
            <div className="space-y-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <FaCrown className="text-2xl text-yellow-500" />
                    <div>
                      <h4 className="text-lg font-semibold text-blue-950">
                        {profile.subscription.package.name}
                      </h4>
                      {subscriptionStatus !== 'expired' ? (
                        <p className="text-sm text-gray-600">
                          {getDaysRemaining()} days remaining
                        </p>
                      ) : (
                        <p className="text-sm text-red-600">
                          Subscription expired
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      Valid until: {formatDate(profile.subscription.endDate)}
                    </p>
                    {subscriptionStatus === 'expired' && (
                      <p className="text-xs text-red-600">
                        Subscription Expired
                      </p>
                    )}
                    {subscriptionStatus === 'active' && (
                      <p className="text-xs text-green-600">
                        Active
                      </p>
                    )}
                    {subscriptionStatus === 'expiring' && (
                      <p className="text-xs text-orange-600">
                        Expiring Soon
                      </p>
                    )}
                  </div>
                </div>

                {/* Display features if available */}
                {profile.subscription.package.features && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {Object.entries(profile.subscription.package.features).map(([feature, enabled]) => (
                      <div key={feature} className="flex items-center space-x-2">
                        {enabled ? (
                          <FaCheck className="text-green-500" />
                        ) : (
                          <FaTimes className="text-red-500" />
                        )}
                        <span className="text-sm text-gray-700">
                          {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (!profile.pendingPayments || profile.pendingPayments.length === 0) ? (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">No active subscription</p>
              <Link
                to="/pricing"
                className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                View Available Plans →
              </Link>
            </div>
          ) : null}
        </div>

        {isEditing && (
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-950 text-white rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors"
            >
              Save Changes
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default EmployerProfile;