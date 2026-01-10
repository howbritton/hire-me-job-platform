import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { getDatabase, ref, set } from 'firebase/database';
import { app } from '../firebase';

const auth = getAuth(app);
const database = getDatabase(app);

const Header = () => (
  <header className="w-full text-white bg-center bg-cover" 
    style={{
      backgroundImage: "url('/job-banner.png')",
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
      backgroundPosition: "center"
    }}>
    <div className="py-20 bg-black bg-opacity-50">
      <div className="container px-4 mx-auto">
        <div className="text-center">
          <h1 className="mb-2 text-4xl font-extrabold text-lime-400 uppercase md:text-5xl">
            Candidate Registration
          </h1>
          <p className="text-sm font-bold text-white uppercase">
            Create a candidate profile for employers to find their perfect match
          </p>
        </div>
      </div>
    </div>
  </header>
);

const LoadingSpinner = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
    <div className="w-16 h-16 border-4 border-lime-400 rounded-full border-t-white animate-spin"></div>
  </div>
);

// Simple notification component
const Notification = ({ message, type, onClose }) => {
  const notificationRef = useRef(null);
  
  useEffect(() => {
    // Auto hide after 5 seconds
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [onClose]);

  // Animation to slide in from bottom
  useEffect(() => {
    const notification = notificationRef.current;
    if (notification) {
      notification.style.transform = 'translateY(0)';
      notification.style.opacity = '1';
    }
  }, []);

  const bgColor = type === 'success' ? 'bg-green-100' : 'bg-red-100';
  const textColor = type === 'success' ? 'text-green-700' : 'text-red-700';
  const iconColor = type === 'success' ? 'text-green-600' : 'text-red-600';
  
  const iconPath = type === 'success'
    ? "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
    : "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z";

  return (
    <div 
      ref={notificationRef}
      className={`fixed bottom-4 right-4 ${bgColor} ${textColor} rounded-md shadow-lg z-50 transition-all transform translate-y-full opacity-0 duration-500 ease-out max-w-md`}
      style={{ transitionProperty: 'transform, opacity' }}
    >
      <div className="p-4">
        <div className="flex items-center">
          <svg className={`w-5 h-5 mr-2 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d={iconPath} clipRule="evenodd" />
          </svg>
          <span className="font-medium">{message}</span>
          <button 
            onClick={onClose} 
            className="ml-auto pl-3 text-gray-500 hover:text-gray-800 focus:outline-none"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

const CandidateRegistration = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Notification state
  const [notification, setNotification] = useState(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleInitial: '',
    email: '',
    phone: '',
    address: '',
    birthDate: '',
    gender: '',
    employmentType: '',
    parish: '',
    labourAvailability: '',
    password: '',
    confirmPassword: '',
    terms: false
  });

  // Function to show notification
  const showNotification = (message, type) => {
    setNotification({ message, type });
  };
  
  // Close notification
  const closeNotification = () => {
    setNotification(null);
  };

  const parishes = [
    "Clarendon", "Hanover", "Kingston", "Manchester", "Portland",
    "Saint Andrew", "Saint Ann", "Saint Catherine", "Saint Elizabeth",
    "Saint James", "Saint Mary", "Saint Thomas", "Trelawny", "Westmoreland"
  ];

  const employmentTypes = [
    { value: "full-time", label: "Full Time employment" },
    { value: "part-time", label: "Part Time employment" },
    { value: "temporary", label: "Temporary Work - No Skills Required" },
    { value: "freelancer", label: "Freelancer" }
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error message when the user starts typing
    if (error) {
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(''); // Clear success message on new submission

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      showNotification('Passwords do not match', 'error');
      setLoading(false);
      return;
    }

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const now = new Date();
      const expirationDate = new Date(now);
      expirationDate.setDate(expirationDate.getDate() + 90); // 90 days from now

      // Store additional user data in Realtime Database
      try {
        await set(ref(database, `candidates/${userCredential.user.uid}`), {
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleInitial: formData.middleInitial,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          birthDate: formData.birthDate,
          gender: formData.gender,
          employmentType: formData.employmentType,
          parish: formData.parish,
          labourAvailability: formData.labourAvailability,
          emailVerified: false,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          expirationDate: expirationDate.toISOString(),
          expirationNotificationSent: false,
          profileStatus: 'active',
          userType: 'candidate',
          isPublic: true // Default to public profile
        });
      } catch (dbError) {
        console.error('Error writing user data to database:', dbError);
        // If we can't write to the database, we should clean up by deleting the auth user
        try {
          // Delete the auth user if we can't write to the database
          await userCredential.user.delete();
          setError('Registration failed: Unable to create your profile data. Please try again.');
          showNotification('Registration failed: Unable to create your profile data. Please try again.', 'error');
          setLoading(false);
          return;
        } catch (deleteError) {
          console.error('Error deleting incomplete user:', deleteError);
          // If we can't delete the user either, sign them out at least
          await signOut(auth);
        }
        throw dbError; // Re-throw to be caught by the outer catch
      }

      // Send verification email AFTER database write is successful
      try {
        await sendEmailVerification(userCredential.user);
      } catch (emailVerificationError) {
        console.error('Error sending verification email:', emailVerificationError);
        // Don't fail the registration if email verification fails
        // We can retry this later
      }

      // Set success message
      const successMessage = "Registration successful! Please check your email to verify your account.";
      setSuccess(successMessage);
      showNotification(successMessage, 'success');
      
      // Sign out the user so they can sign in properly
      await signOut(auth);
      
      // Navigate after a delay
      setTimeout(() => {
        navigate('/candidate-sign-in');
      }, 3000);
    } catch (registrationError) {
      // Handle Firebase-specific errors with more user-friendly messages
      let errorMessage = registrationError.message;
      
      if (errorMessage.includes('email-already-in-use')) {
        errorMessage = 'This email is already registered. Please sign in or use a different email.';
      } else if (errorMessage.includes('weak-password')) {
        errorMessage = 'Password is too weak. Please use at least 6 characters.';
      } else if (errorMessage.includes('invalid-email')) {
        errorMessage = 'Please enter a valid email address.';
      } else {
        errorMessage = 'Registration failed. Please try again later.';
      }
      
      setError(errorMessage);
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-left">
      {loading && <LoadingSpinner />}
      <Header />
      
      <div className="max-w-4xl px-4 py-8 mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 text-red-700 bg-red-100 rounded-md" role="alert">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}
          
          {success && (
            <div className="p-4 text-green-700 bg-green-100 rounded-md" role="alert">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{success}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              <input
                type="text"
                name="firstName"
                required
                value={formData.firstName}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Middle Initial</label>
              <input
                type="text"
                name="middleInitial"
                value={formData.middleInitial}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                maxLength={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <input
                type="text"
                name="lastName"
                required
                value={formData.lastName}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Employment Type</label>
            <select
              name="employmentType"
              required
              value={formData.employmentType}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Select employment type</option>
              {employmentTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Birth Date</label>
              <input
                type="date"
                name="birthDate"
                required
                value={formData.birthDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Gender</label>
              <select
                name="gender"
                required
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              name="phone"
              required
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <input
              type="text"
              name="address"
              required
              value={formData.address}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Parish</label>
            <select
              name="parish"
              required
              value={formData.parish}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Select parish</option>
              {parishes.map(parish => (
                <option key={parish} value={parish}>{parish}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Are you available for strenuous physical labour?
            </label>
            <select
              name="labourAvailability"
              required
              value={formData.labourAvailability}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Select option</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                minLength="6"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="terms"
              required
              checked={formData.terms}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            <label className="ml-2 text-sm text-gray-700">
              I agree to the terms and conditions
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>
      
      {/* Notification */}
      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={closeNotification} 
        />
      )}
    </div>
  );
};

export default CandidateRegistration;