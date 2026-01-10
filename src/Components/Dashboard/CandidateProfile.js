import React, { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, get, update } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { FaExclamationTriangle } from 'react-icons/fa';

const ToggleSwitch = ({ isChecked, onChange, disabled }) => (
  <div className="flex items-center">
    <label className="relative inline-flex items-center cursor-pointer">
      <input 
        type="checkbox" 
        className="sr-only peer"
        checked={isChecked}
        onChange={onChange}
        disabled={disabled}
      />
      <div className={`
        w-11 h-6 rounded-full peer 
        peer-focus:outline-none peer-focus:ring-4 
        ${isChecked 
          ? 'bg-green-500 peer-focus:ring-green-300' 
          : 'bg-red-500 peer-focus:ring-red-300'
        }
        after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
        after:bg-white after:border-gray-300 after:border after:rounded-full 
        after:h-5 after:w-5 after:transition-all
        ${isChecked ? 'after:translate-x-full' : 'after:translate-x-0'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}></div>
    </label>
    <span className={`ml-3 text-sm font-medium ${isChecked ? 'text-green-700' : 'text-red-700'}`}>
      {isChecked ? 'Public Profile' : 'Private Profile'}
    </span>
  </div>
);

const CandidateProfile = () => {
  const [profile, setProfile] = useState({
    firstName: '',
    middleInitial: '',
    lastName: '',
    email: '',
    phone: '',
    streetAddress: '',
    employmentType: '',
    birthDate: '',
    gender: '',
    parish: '',
    physicalLabor: false,
    isPublic: true
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);

  const auth = getAuth(app);
  const db = getDatabase(app);
  const functions = getFunctions(app);

  // Function to call the Firebase cloud function for sending profile expiration notifications
  const sendExpirationNotification = async (profileData) => {
    try {
      // Avoid sending duplicate notifications in the same session
      if (notificationSent) return;
      
      const notifyProfileExpiration = httpsCallable(functions, 'notifyProfileExpiration');
      
      // ✅ FIXED: Use correct parameter names that match the cloud function
      const notificationPayload = {
        userId: auth.currentUser.uid,
        userRole: 'candidate',
        email: auth.currentUser.email || profile.email
      };
      
      console.log('Sending expiration notification with payload:', notificationPayload);
      
      await notifyProfileExpiration(notificationPayload);
      setNotificationSent(true);
      
      console.log('Expiration notification sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending expiration notification:', error);
      
      // Show user-friendly error message
      if (error.code === 'functions/unauthenticated') {
        toast.error('Please sign in to receive notifications');
      } else if (error.code === 'functions/permission-denied') {
        toast.error('Permission denied for sending notifications');
      } else {
        console.warn('Notification failed, but continuing with profile operations');
      }
      
      return false;
    }
  };

  const fetchProfile = useCallback(async () => {
    try {
      if (!auth.currentUser) {
        toast.error('Please sign in to view your profile');
        return;
      }

      const profileRef = ref(db, `candidates/${auth.currentUser.uid}`);
      const snapshot = await get(profileRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        setProfile({
          firstName: data.firstName || '',
          middleInitial: data.middleInitial || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.phone || '',
          streetAddress: data.address || '',
          employmentType: data.employmentType?.toLowerCase() || '',
          birthDate: data.birthDate || '',
          gender: data.gender?.toLowerCase() || '',
          parish: data.parish || '',
          physicalLabor: data.labourAvailability?.toLowerCase() === 'yes',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          isPublic: data.isPublic !== false,
          expirationNotificationSent: data.expirationNotificationSent || false,
          profileStatus: data.profileStatus || 'active',
          expiryDate: data.expiryDate || calculateExpiryDate(data.updatedAt || data.createdAt)
        });
        
        // Check if profile is expiring soon and send notification
        checkAndNotifyExpiration(data);
      } else {
        // Create initial profile with expiry date
        const currentDate = new Date();
        const expiryDate = new Date(currentDate);
        expiryDate.setDate(expiryDate.getDate() + 90); // 90 days from now
        
        const initialProfile = {
          isPublic: true,
          createdAt: currentDate.toISOString(),
          updatedAt: currentDate.toISOString(),
          profileStatus: 'active',
          expirationNotificationSent: false,
          expiryDate: expiryDate.toISOString()
        };
        await update(profileRef, initialProfile);
        
        setProfile(prev => ({
          ...prev,
          createdAt: currentDate.toISOString(),
          updatedAt: currentDate.toISOString(),
          expiryDate: expiryDate.toISOString()
        }));
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Error loading profile data');
      setLoading(false);
    }
  }, [auth.currentUser, db]);
  
  // Calculate expiry date (90 days from last update)
  const calculateExpiryDate = (lastUpdateStr) => {
    if (!lastUpdateStr) return null;
    
    const lastUpdate = new Date(lastUpdateStr);
    const expiryDate = new Date(lastUpdate);
    expiryDate.setDate(expiryDate.getDate() + 90);
    return expiryDate.toISOString();
  };
  
  // Check if profile is expiring soon and send notification
  const checkAndNotifyExpiration = async (profileData) => {
    if (!profileData || !auth.currentUser) return;
    
    const expiryDate = profileData.expiryDate ? new Date(profileData.expiryDate) : 
                       calculateExpiryDate(profileData.updatedAt || profileData.createdAt);
    
    if (!expiryDate) return;
    
    const currentDate = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
    
    // Profile is expiring within 14 days and notification hasn't been sent
    if (daysUntilExpiry <= 14 && daysUntilExpiry > 0 && !profileData.expirationNotificationSent) {
      try {
        console.log(`Profile expiring in ${daysUntilExpiry} days, sending notification...`);
        
        // ✅ FIXED: Pass correct data structure to notification function
        const success = await sendExpirationNotification({
          userId: auth.currentUser.uid,
          userRole: 'candidate',
          email: auth.currentUser.email || profileData.email || profile.email,
          expiryDate: expiryDate.toISOString(),
          daysUntilExpiry: daysUntilExpiry
        });
        
        if (success) {
          // Update database to mark notification as sent
          const profileRef = ref(db, `candidates/${auth.currentUser.uid}`);
          await update(profileRef, {
            expirationNotificationSent: true,
            lastNotificationSent: new Date().toISOString()
          });
          
          setProfile(prev => ({
            ...prev,
            expirationNotificationSent: true
          }));
          
          toast.success('Expiration reminder sent to your email');
        }
      } catch (error) {
        console.error('Error handling expiration notification:', error);
        // Don't show error to user as this is a background operation
      }
    }
    
    // Profile has expired - automatically set to private
    if (daysUntilExpiry <= 0 && profileData.isPublic) {
      try {
        console.log('Profile has expired, setting to private...');
        
        const profileRef = ref(db, `candidates/${auth.currentUser.uid}`);
        await update(profileRef, {
          isPublic: false,
          profileStatus: 'expired',
          expiredAt: new Date().toISOString()
        });
        
        setProfile(prev => ({
          ...prev,
          isPublic: false,
          profileStatus: 'expired'
        }));
        
        toast.warning('Your profile has been automatically set to private due to expiration. Please update your profile to make it visible again.');
      } catch (error) {
        console.error('Error handling profile expiration:', error);
        toast.error('Error updating expired profile status');
      }
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Check profile expiration periodically
  useEffect(() => {
    if (!auth.currentUser) return;

    const checkExpiration = () => {
      if (!profile || !profile.expiryDate) return;
      
      const expiryDate = new Date(profile.expiryDate);
      const currentDate = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
      
      // If profile has expired, set to private
      if (daysUntilExpiry <= 0 && profile.isPublic) {
        const profileRef = ref(db, `candidates/${auth.currentUser.uid}`);
        update(profileRef, {
          isPublic: false,
          profileStatus: 'expired',
          expiredAt: new Date().toISOString()
        })
        .then(() => {
          setProfile(prev => ({
            ...prev,
            isPublic: false,
            profileStatus: 'expired'
          }));
          
          toast.warning('Your profile has been automatically set to private due to expiration. Please update your profile to make it visible again.');
        })
        .catch(error => {
          console.error('Error updating expired profile:', error);
        });
      }
    };

    const interval = setInterval(checkExpiration, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [profile, auth.currentUser, db]);

  // Calculate days until expiry for display purposes
  const getDaysUntilExpiry = () => {
    if (!profile.expiryDate) return null;
    
    const expiryDate = new Date(profile.expiryDate);
    const currentDate = new Date();
    return Math.max(0, Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24)));
  };
  
  // Check if profile is expiring soon (within 14 days)
  const isExpiringSoon = () => {
    const daysUntilExpiry = getDaysUntilExpiry();
    return daysUntilExpiry !== null && daysUntilExpiry <= 14 && daysUntilExpiry > 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePrivacyToggle = async () => {
    try {
      const newPrivacyStatus = !profile.isPublic;
      
      // If setting to public and profile is expired, don't allow it
      if (newPrivacyStatus && profile.profileStatus === 'expired') {
        toast.error('Cannot set expired profile to public. Please update your profile first.');
        return;
      }
      
      const profileRef = ref(db, `candidates/${auth.currentUser.uid}`);
      const updateData = {
        isPublic: newPrivacyStatus,
        updatedAt: new Date().toISOString()
      };
      
      // If setting to public, reset expiration notification
      if (newPrivacyStatus) {
        updateData.expirationNotificationSent = false;
        updateData.profileStatus = 'active';
      }
      
      await update(profileRef, updateData);

      setProfile(prev => ({
        ...prev,
        isPublic: newPrivacyStatus,
        updatedAt: new Date().toISOString(),
        expirationNotificationSent: newPrivacyStatus ? false : prev.expirationNotificationSent,
        profileStatus: newPrivacyStatus ? 'active' : prev.profileStatus
      }));

      toast.success(`Profile is now ${newPrivacyStatus ? 'public' : 'private'}`);
    } catch (error) {
      console.error('Error updating privacy setting:', error);
      toast.error('Failed to update privacy setting');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const currentDate = new Date();
      const expiryDate = new Date(currentDate);
      expiryDate.setDate(expiryDate.getDate() + 90); // 90 days from now
      
      const dbProfile = {
        firstName: profile.firstName,
        middleInitial: profile.middleInitial,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        address: profile.streetAddress,
        employmentType: profile.employmentType,
        birthDate: profile.birthDate,
        gender: profile.gender,
        parish: profile.parish,
        labourAvailability: profile.physicalLabor ? 'yes' : 'no',
        isPublic: profile.isPublic,
        updatedAt: currentDate.toISOString(),
        createdAt: profile.createdAt || currentDate.toISOString(),
        expirationNotificationSent: false, // Reset notification flag on update
        profileStatus: 'active', // Reset status to active when updated
        expiryDate: expiryDate.toISOString(),
        lastProfileUpdate: currentDate.toISOString()
      };

      const profileRef = ref(db, `candidates/${auth.currentUser.uid}`);
      await update(profileRef, dbProfile);

      setProfile(prev => ({
        ...prev,
        updatedAt: currentDate.toISOString(),
        expirationNotificationSent: false,
        profileStatus: 'active',
        expiryDate: expiryDate.toISOString()
      }));

      // Reset notification sent flag for this session
      setNotificationSent(false);

      toast.success('Profile updated successfully! Your profile is now active for another 90 days.');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Error updating profile');
    }
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
      {/* Expiration Warning Banner */}
      {isExpiringSoon() && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex items-center">
            <FaExclamationTriangle className="flex-shrink-0 h-5 w-5 text-yellow-400 mr-2" />
            <span className="text-yellow-700">
              ⚠️ Your profile will expire in {getDaysUntilExpiry()} days. Update your profile to keep it active for another 90 days.
            </span>
          </div>
        </div>
      )}

      {/* Expired Profile Banner */}
      {profile.profileStatus === 'expired' && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex items-center">
            <FaExclamationTriangle className="flex-shrink-0 h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-700">
              🚫 Your profile has expired and is no longer visible to employers. Update your profile to make it active again.
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-blue-950">Candidate Profile</h2>
          <div className="mt-2">
            <div className="flex items-center space-x-2">
              <ToggleSwitch 
                isChecked={profile.isPublic}
                onChange={handlePrivacyToggle}
                disabled={profile.profileStatus === 'expired'}
              />
              <span className="text-sm text-gray-500">
                {profile.isPublic 
                  ? '(Your profile is visible to employers. Please note, your profile has to be public in order to apply for a job.)'
                  : '(Your profile is hidden from employers)'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-950 rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors"
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                Middle Initial
              </label>
              <input
                type="text"
                name="middleInitial"
                value={profile.middleInitial}
                onChange={handleChange}
                disabled={!isEditing}
                maxLength={1}
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
          </div>
        </div>

        {/* Contact Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Additional Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Street Address
              </label>
              <input
                type="text"
                name="streetAddress"
                value={profile.streetAddress}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parish
              </label>
              <select
                name="parish"
                value={profile.parish}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select Parish</option>
                <option value="Kingston">Kingston</option>
                <option value="St. Andrew">St. Andrew</option>
                <option value="St. Catherine">St. Catherine</option>
                <option value="Clarendon">Clarendon</option>
                <option value="Manchester">Manchester</option>
                <option value="St. Elizabeth">St. Elizabeth</option>
                <option value="Westmoreland">Westmoreland</option>
                <option value="Hanover">Hanover</option>
                <option value="St. James">St. James</option>
                <option value="Trelawny">Trelawny</option>
                <option value="St. Ann">St. Ann</option>
                <option value="St. Mary">St. Mary</option>
                <option value="Portland">Portland</option>
                <option value="St. Thomas">St. Thomas</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employment Type
              </label>
              <select
                name="employmentType"
                value={profile.employmentType}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select Type</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="temporary">Temporary</option>
                <option value="internship">Internship</option>
                <option value="volunteer">Volunteer</option>
                <option value="freelance">Freelance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birth Date
              </label>
              <input
                type="date"
                name="birthDate"
                value={profile.birthDate}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                name="gender"
                value={profile.gender}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="physicalLabor"
                name="physicalLabor"
                checked={profile.physicalLabor}
                onChange={handleChange}
                disabled={!isEditing}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="physicalLabor" className="ml-2 block text-sm text-gray-700">
                Available for Strenuous Physical Labour
              </label>
            </div>
          </div>
        </div>

        {/* Profile Expiration Info */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Status</h3>
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Profile Created:</span>
                <span className="text-sm font-medium">
                  {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Last Updated:</span>
                <span className="text-sm font-medium">
                  {profile.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Expires On:</span>
                <span className={`text-sm font-medium ${isExpiringSoon() ? 'text-yellow-600' : profile.profileStatus === 'expired' ? 'text-red-600' : 'text-green-600'}`}>
                  {profile.expiryDate ? new Date(profile.expiryDate).toLocaleDateString() : 'N/A'}
                  {isExpiringSoon() && ' (Expiring Soon)'}
                  {profile.profileStatus === 'expired' && ' (Expired)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Days Remaining:</span>
                <span className={`text-sm font-medium ${isExpiringSoon() ? 'text-yellow-600' : profile.profileStatus === 'expired' ? 'text-red-600' : 'text-green-600'}`}>
                  {getDaysUntilExpiry() !== null ? `${getDaysUntilExpiry()} days` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Profile Status:</span>
                <span className={`text-sm font-medium ${profile.profileStatus === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                  {profile.profileStatus === 'active' ? 'Active' : 'Expired'}
                </span>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-500">
              <p>📅 Your profile will automatically expire 90 days after your last update. Update your profile regularly to ensure employers can see it.</p>
              <p className="mt-1">📧 You'll receive an email reminder 14 days before expiration.</p>
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-950 text-white rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors"
            >
              Save Changes & Extend Expiry
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default CandidateProfile;