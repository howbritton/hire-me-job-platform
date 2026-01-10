import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { getDatabase, ref, set } from 'firebase/database';
import { app } from '../firebase';
import {
  Button,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  TextField,
} from "@mui/material";
import { BiLock, BiUser, BiBriefcase } from "react-icons/bi";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { MdEmail, MdPhone } from "react-icons/md";
import { toast, ToastContainer } from "react-toastify"; // Import ToastContainer
import "react-toastify/dist/ReactToastify.css";

// Remove the toast.configure block - this is causing the error

const auth = getAuth(app);
const database = getDatabase(app);

const Hero = () => (
  <header
    className="max-w-full light text-white bg-center bg-cover"
    style={{
      backgroundImage: "url(./job-banner.png)",
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
      backgroundPosition: "center center",
    }}
  >
    <div className="py-20 md:py-24 bg-black bg-opacity-50 dark:bg-opacity-70">
      <div className="container px-4 m-auto">
        <div className="grid grid-cols-12">
          <div className="col-span-12 text-center">
            <div className="text-center">
              <div className="w-3/4 m-auto">
                <p className="sm:text-5xl text-center font-extrabold uppercase text-xl" style={{ lineHeight: "1.5", color: "#cddd3a" }}>
                  Employer Registration
                </p>
                <p className="sm:text-sm text-center font-bold uppercase text-sm" style={{ lineHeight: "1.5", color: "#fff" }}>
                  To access our network of Candidates you must register your account
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
);

const FullScreenLoader = () => (
  <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-75 z-50">
    <div className="loader">
      <div className="spinner"></div>
    </div>
    <style jsx>{`
      .loader {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .spinner {
        width: 80px;
        height: 80px;
        border: 12px solid #cddd3a;
        border-top: 12px solid #fff;
        border-radius: 50%;
        animation: spin 1.5s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

const EmployerRegistration = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    emailAddress: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    terms: false,
  });

  const handlePasswordToggle = () => setShowPassword(!showPassword);
  const handleConfirmPasswordToggle = () => setShowConfirmPassword(!showConfirmPassword);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      toast.error('First name is required');
      return false;
    }
    if (!formData.lastName.trim()) {
      toast.error('Last name is required');
      return false;
    }
    if (!formData.companyName.trim()) {
      toast.error('Company name is required');
      return false;
    }
    if (!formData.emailAddress.trim()) {
      toast.error('Email address is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.emailAddress)) {
      toast.error('Please enter a valid email address');
      return false;
    }
    if (!formData.phoneNumber.trim()) {
      toast.error('Phone number is required');
      return false;
    }
    if (!formData.password) {
      toast.error('Password is required');
      return false;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    if (!formData.terms) {
      toast.error('Please accept the privacy policy');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Clear any existing toasts to prevent multiple notifications
    toast.dismiss();
    
    setLoading(true);

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.emailAddress,
        formData.password
      );

      // Send verification email
      await sendEmailVerification(userCredential.user);

      // Create a single transaction for all database operations
      const dbTransaction = async () => {
        // Store main employer data
        await set(ref(database, `employers/${userCredential.user.uid}`), {
          firstName: formData.firstName,
          lastName: formData.lastName,
          companyName: formData.companyName,
          email: formData.emailAddress,
          phone: formData.phoneNumber,
          emailVerified: false,
          createdAt: new Date().toISOString(),
          userType: 'employer',
          // Flag to detect this is a new registration
          isNewRegistration: true
        });

        // Store profile data
        await set(ref(database, `employers/${userCredential.user.uid}/profile`), {
          firstName: formData.firstName,
          lastName: formData.lastName,
          companyName: formData.companyName,
          email: formData.emailAddress,
          phone: formData.phoneNumber,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      };

      // Execute all database operations 
      await dbTransaction();
      
      // Mark registration as complete (prevents navigation issues)
      setRegistrationComplete(true);
      
      // Show success message
      toast.success("Registration successful! Please check your email to verify your account.");
      
      // Explicitly set a flag for login page to detect
      localStorage.setItem('justRegistered', 'true');
      
      // Prevent auto-login attempts
      localStorage.setItem('preventAutoLogin', 'true');
      
      // Sign out the user to prevent automatic login attempts
      await auth.signOut();
      
      // Navigate to sign-in after a short delay - but only after toast is displayed
      setTimeout(() => {
        // Pass registration state via navigation state
        navigate('/employer-sign-in', { 
          state: { fromRegistration: true }
        });
      }, 3000); // Longer delay to ensure toast is seen before redirect
    } catch (error) {
      console.error('Registration error:', error);
      
      // Clear any existing toasts before showing error
      toast.dismiss();
      
      // Provide user-friendly error messages based on error code
      if (error.code === 'auth/email-already-in-use') {
        toast.error("This email is already registered. Please use a different email or sign in.");
      } else if (error.code === 'auth/invalid-email') {
        toast.error("Invalid email address format.");
      } else if (error.code === 'auth/weak-password') {
        toast.error("Password is too weak. Please use a stronger password.");
      } else if (error.code === 'auth/network-request-failed') {
        toast.error("Network error. Please check your internet connection and try again.");
      } else {
        // Generic error message for other error types
        toast.error("Registration failed. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  // If registration is complete, show minimal UI to prevent further interactions
  if (registrationComplete) {
    return (
      <div className="max-w-full bg-white flex flex-col justify-center items-center min-h-screen text-center p-4">
        <div className="text-6xl mb-4 text-green-500">✓</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Registration Successful!</h2>
        <p className="text-gray-600 mb-6">Please check your email to verify your account.</p>
        <p className="text-gray-500">Redirecting to sign-in page...</p>
        {/* Update ToastContainer with full props */}
        <ToastContainer 
          position="top-right" 
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          limit={1}
        />
      </div>
    );
  }

  return (
    <div className="max-w-full bg-white justify-center items-center min-h-screen text-left">
      {loading && <FullScreenLoader />}
      {/* Update ToastContainer with full props */}
      <ToastContainer 
        position="top-right" 
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        limit={1}
      />
      <Hero />
      <div className="max-w-6xl p-8 rounded-lg m-auto">
        <h2 className="sm:text-5xl text-center font-extrabold uppercase text-xl mb-10 text-blue-900">
          Sign Up
        </h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-10">
            <TextField
              label="Company Name"
              variant="outlined"
              fullWidth
              required
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BiBriefcase className="text-gray-500" />
                  </InputAdornment>
                ),
              }}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            <TextField
              label="First Name"
              variant="outlined"
              fullWidth
              required
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BiUser className="text-gray-500" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Last Name"
              variant="outlined"
              fullWidth
              required
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BiUser className="text-gray-500" />
                  </InputAdornment>
                ),
              }}
            />
          </div>
          <div className="mb-10">
            <TextField
              type="email"
              label="Email Address"
              variant="outlined"
              fullWidth
              required
              name="emailAddress"
              value={formData.emailAddress}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MdEmail className="text-gray-500" />
                  </InputAdornment>
                ),
              }}
            />
          </div>
          <div className="mb-10">
            <TextField
              type="tel"
              label="Phone Number"
              variant="outlined"
              fullWidth
              required
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MdPhone className="text-gray-500" />
                  </InputAdornment>
                ),
              }}
            />
          </div>
          <div className="mb-10">
            <TextField
              type={showPassword ? "text" : "password"}
              label="Password"
              variant="outlined"
              fullWidth
              required
              name="password"
              value={formData.password}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BiLock className="text-gray-500" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Button onClick={handlePasswordToggle}>
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </Button>
                  </InputAdornment>
                ),
              }}
            />
          </div>
          <div className="mb-4">
            <TextField
              type={showConfirmPassword ? "text" : "password"}
              label="Confirm Password"
              variant="outlined"
              fullWidth
              required
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BiLock className="text-gray-500" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Button onClick={handleConfirmPasswordToggle}>
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </Button>
                  </InputAdornment>
                ),
              }}
            />
          </div>
          <FormControlLabel
            control={
              <Checkbox
                required
                name="terms"
                checked={formData.terms}
                onChange={handleChange}
              />
            }
            label="Please confirm that you agree to our privacy policy"
          />
          <Button 
            variant="contained" 
            color="primary" 
            fullWidth 
            type="submit"
            disabled={loading}
            sx={{ mt: 3 }}
          >
            {loading ? 'Signing Up...' : 'Sign Up'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default EmployerRegistration;