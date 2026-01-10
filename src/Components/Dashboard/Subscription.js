import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, update } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import { FaCheckCircle, FaCrown, FaTimesCircle, FaClock, FaCheck, FaTimes, FaArrowUp, FaBriefcase } from 'react-icons/fa';

const EMAIL_SERVICE_URL = 'http://34.228.74.248:3001';

const Subscription = () => {
  const [subscription, setSubscription] = useState(null);
  const [availablePackages, setAvailablePackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobsPosted, setJobsPosted] = useState(0);

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

  const fetchSubscriptionAndPackages = useCallback(async () => {
    try {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }

      let currentJobCount = 0;

      // Fetch jobs to count posted jobs
      const jobsRef = ref(db, 'jobs');
      const jobsSnap = await get(jobsRef);
      if (jobsSnap.exists()) {
        currentJobCount = Object.values(jobsSnap.val())
          .filter(job => job.employerId === auth.currentUser.uid)
          .length;
        setJobsPosted(currentJobCount);
      }

      // Fetch current subscription from employers/{uid}/subscription
      const subscriptionRef = ref(db, `employers/${auth.currentUser.uid}/subscription`);
      const subscriptionSnap = await get(subscriptionRef);

      // Fetch employer profile for email
      const profileRef = ref(db, `employers/${auth.currentUser.uid}/profile`);
      const profileSnap = await get(profileRef);
      const employerEmail = profileSnap.exists() ? profileSnap.val().email : auth.currentUser.email;

      // Process subscription data if it exists
      if (subscriptionSnap.exists()) {
        const subscriptionData = subscriptionSnap.val();
        const currentDate = new Date();
        const endDate = new Date(subscriptionData.endDate);
        const daysRemaining = Math.ceil((endDate - currentDate) / (1000 * 60 * 60 * 24));

        // Send notifications at specific thresholds
        if ([30, 14, 7, 3, 1].includes(daysRemaining) && !subscriptionData.notificationSent) {
          try {
            await sendPackageExpirationNotification({
              employerEmail,
              packageName: subscriptionData.package.name,
              expirationDate: subscriptionData.endDate,
              daysRemaining,
              features: subscriptionData.package.features,
              jobPostLimit: subscriptionData.package.jobPostLimit,
              jobsPosted: currentJobCount
            });

            // Mark notification as sent
            await update(subscriptionRef, {
              notificationSent: true
            });
          } catch (error) {
            console.error('Error sending expiration notification:', error);
          }
        }

        // Reset notification flag if we're past the threshold days
        if (!Object.values([30, 14, 7, 3, 1]).includes(daysRemaining) && subscriptionData.notificationSent) {
          await update(subscriptionRef, {
            notificationSent: false
          });
        }
        
        setSubscription({
          ...subscriptionData,
          endDate: new Date(subscriptionData.endDate),
          startDate: new Date(subscriptionData.startDate),
          jobsPosted: currentJobCount,
          history: subscriptionData.history ? Object.values(subscriptionData.history) : [],
          package: {
            ...subscriptionData.package,
            jobPostLimit: subscriptionData.package.jobPostLimit || -1,
            features: {
              accessCandidateList: subscriptionData.package.features.accessCandidateList || false,
              allowJobPosting: subscriptionData.package.features.allowJobPosting || false,
              emailBlast: subscriptionData.package.features.emailBlast || false,
              socialMediaBlast: subscriptionData.package.features.socialMediaBlast || false,
              addPreScreeningQuestions: subscriptionData.package.features.addPreScreeningQuestions || false
            }
          }
        });
      }

      // Fetch all available packages from packages node
      const packagesRef = ref(db, 'packages');
      const packagesSnap = await get(packagesRef);

      // Process packages data if it exists
      if (packagesSnap.exists()) {
        const packagesData = Object.entries(packagesSnap.val())
          .map(([id, data]) => ({
            id,
            ...data,
            jobPostLimit: data.jobPostLimit || -1,
            features: {
              accessCandidateList: data.features.accessCandidateList || false,
              allowJobPosting: data.features.allowJobPosting || false,
              emailBlast: data.features.emailBlast || false,
              socialMediaBlast: data.features.socialMediaBlast || false,
              addPreScreeningQuestions: data.features.addPreScreeningQuestions || false
            }
          }))
          .filter(pkg => pkg.status === 'active')
          .sort((a, b) => a.price - b.price);

        setAvailablePackages(packagesData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      toast.error('Error loading subscription information');
      setLoading(false);
    }
  }, [auth.currentUser, db]);

  useEffect(() => {
    fetchSubscriptionAndPackages();
  }, [fetchSubscriptionAndPackages]);

  const getSubscriptionStatus = () => {
    if (!subscription) return 'inactive';
    const now = new Date();
    const endDate = subscription.endDate;
    const daysRemaining = getRemainingDays();

    if (now > endDate) return 'expired';
    if (daysRemaining <= 7) return 'expiring';
    return 'active';
  };

  const getRemainingDays = () => {
    if (!subscription) return 0;
    const diff = subscription.endDate - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getRemainingPosts = () => {
    if (!subscription || !subscription.package) return 0;
    if (subscription.package.jobPostLimit === -1) return 'unlimited';
    return Math.max(0, subscription.package.jobPostLimit - jobsPosted);
  };

  const getStatusBanner = () => {
    const status = getSubscriptionStatus();
    const bannerClasses = {
      active: 'bg-green-50 text-green-800',
      expiring: 'bg-yellow-50 text-yellow-800',
      expired: 'bg-red-50 text-red-800',
      inactive: 'bg-gray-50 text-gray-800'
    };

    const icons = {
      active: <FaCheck className="text-green-500" />,
      expiring: <FaClock className="text-yellow-500" />,
      expired: <FaTimes className="text-red-500" />,
      inactive: <FaTimes className="text-gray-500" />
    };

    const remainingPosts = getRemainingPosts();
    const remainingPostsText = remainingPosts === 'unlimited' 
      ? 'unlimited posts available'
      : `${remainingPosts} job post${remainingPosts !== 1 ? 's' : ''} remaining`;

    const messages = {
      active: `Your subscription is active with ${getRemainingDays()} days and ${remainingPostsText}`,
      expiring: `Your subscription will expire in ${getRemainingDays()} days (${remainingPostsText})`,
      expired: 'Your subscription has expired',
      inactive: 'You don\'t have an active subscription'
    };

    return (
      <div className={`${bannerClasses[status]} p-4 rounded-lg flex items-center space-x-2 mb-6`}>
        {icons[status]}
        <span className="font-medium">{messages[status]}</span>
      </div>
    );
  };

  const isPackageUpgrade = (pkg) => {
    if (!subscription?.package) return false;
    return pkg.price > subscription.package.price;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-blue-950 mb-6">Subscription Management</h2>

        {getStatusBanner()}

        {/* Current Subscription Status */}
        {subscription && (
          <div className="bg-blue-50 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <FaCrown className="text-2xl text-yellow-500" />
                <div>
                  <h4 className="text-lg font-semibold text-blue-950">
                    {subscription.package?.name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {getRemainingDays()} days remaining
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  Valid until: {subscription.endDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* Job Posts Usage */}
            <div className="bg-white p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FaBriefcase className="text-blue-600" />
                  <span className="font-medium">Job Posts Usage</span>
                </div>
                <span className="text-sm">
                  {jobsPosted} used / {subscription.package.jobPostLimit === -1 ? '∞' : subscription.package.jobPostLimit} total
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {Object.entries(subscription.package.features).map(([feature, enabled]) => (
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
          </div>
        )}

        {/* Available Packages */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Available Packages</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {availablePackages.map((pkg) => (
              <div 
                key={pkg.id} 
                className={`border rounded-lg p-6 hover:shadow-lg transition-all relative
                  ${subscription?.package?.id === pkg.id ? 'border-2 border-blue-500' : ''}
                  ${isPackageUpgrade(pkg) ? 'transform hover:-translate-y-1' : ''}
                `}
              >
                {subscription?.package?.id === pkg.id && (
                  <div className="absolute top-4 right-4 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Current Plan
                  </div>
                )}
                
                <h4 className="text-xl font-semibold mb-2">{pkg.name}</h4>
                <div className="text-3xl font-bold text-blue-950 mb-4">
                  ${pkg.price}
                  <span className="text-sm text-gray-500 font-normal">
                    /{pkg.duration} days
                  </span>
                </div>

                {/* Job Post Limit Badge */}
                <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg text-center mb-4 flex items-center justify-center gap-2">
                  <FaBriefcase />
                  <span>
                    {pkg.jobPostLimit === -1 
                      ? "Unlimited Job Posts" 
                      : `${pkg.jobPostLimit} Job Post${pkg.jobPostLimit !== 1 ? 's' : ''}`}
                  </span>
                </div>
                
                <ul className="space-y-3 mb-6">
                  {Object.entries(pkg.features).map(([feature, enabled]) => (
                    <li key={feature} className="flex items-center">
                      {enabled ? (
                        <FaCheckCircle className="text-green-500 mr-2" />
                      ) : (
                        <FaTimesCircle className="text-red-500 mr-2" />
                      )}
                      {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/checkout"
                  state={{ 
                    package: pkg,
                    isUpgrade: isPackageUpgrade(pkg),
                    currentSubscription: subscription 
                  }}
                  className={`inline-flex items-center justify-center w-full px-4 py-2 rounded-md transition-colors
                    ${subscription?.package?.id === pkg.id
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-blue-950 text-white hover:bg-[#cddd3a] hover:text-blue-950'
                    }`}
                >
                  {isPackageUpgrade(pkg) && <FaArrowUp className="mr-2" />}
                  {subscription?.package?.id === pkg.id ? 'Current Plan' : 
                    isPackageUpgrade(pkg) ? 'Upgrade Plan' : 'Select Plan'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subscription History */}
      {subscription?.history && subscription.history.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">Subscription History</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Package</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Posts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subscription.history.map((record, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">{record.packageName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.jobPostLimit === -1 ? 'Unlimited' : record.jobPostLimit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(record.startDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(record.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">${record.amount}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${new Date(record.endDate) > new Date()
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {new Date(record.endDate) > new Date() ? 'Active' : 'Expired'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscription;