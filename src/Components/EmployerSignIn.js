import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '../firebase';
import { toast, ToastContainer } from 'react-toastify'; // Add ToastContainer
import "react-toastify/dist/ReactToastify.css"; // Add CSS import
import { Link } from 'react-router-dom';
import { BiLock } from 'react-icons/bi';
import { MdEmail } from 'react-icons/md';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const auth = getAuth(app);
const database = getDatabase(app);

const Hero = () => {
  return (
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
                  <p
                    style={{ lineHeight: "1.5", color: "#cddd3a" }}
                    className="sm:text-5xl text-center font-extrabold uppercase text-xl"
                  >
                    Employer Sign In
                  </p>
                  <p
                    style={{ lineHeight: "1.5", color: "#fff" }}
                    className="sm:text-sm text-center font-bold uppercase text-sm"
                  >
                    Access your account to post jobs and find the perfect candidates
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const EmployerSignIn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [comingFromRegistration, setComingFromRegistration] = useState(false);

  // Check if user is coming from registration page
  useEffect(() => {
    // Clear any existing notifications when component mounts
    toast.dismiss();
    
    // Check if user came from registration
    const fromRegistration = location.state?.fromRegistration || localStorage.getItem('justRegistered') === 'true';
    
    if (fromRegistration) {
      setComingFromRegistration(true);
      
      // Show registration success toast
      toast.success("Registration successful! Please check your email to verify your account.");
      
      // Clear the registration flag (but keep the preventAutoLogin flag)
      localStorage.removeItem('justRegistered');
      
      // Clear the location state
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Helper function to delay execution - outside the loop to avoid the ESLint warning
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    
    if (!formData.password.trim()) {
      toast.error('Please enter your password');
      return;
    }
    
    // Clear any existing notifications before proceeding
    toast.dismiss();
    setLoading(true);

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      // Check if this is a recently registered account
      const isRecentlyRegistered = comingFromRegistration || 
                                 localStorage.getItem('preventAutoLogin') === 'true';
      
      // If recently registered, try multiple attempts to get data
      if (isRecentlyRegistered) {
        // Try to get employer data with retries
        let employerData = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!employerData && attempts < maxAttempts) {
          attempts++;
          
          try {
            // Wait a bit longer between each attempt - Using the delay function
            if (attempts > 1) {
              // Fix: Using the delay function instead of creating a new Promise in the loop
              await delay(1000 * attempts);
            }
            
            const employerSnapshot = await get(ref(database, `employers/${userCredential.user.uid}`));
            
            if (employerSnapshot.exists()) {
              employerData = employerSnapshot.val();
              break; // Data found, exit the loop
            }
          } catch (retryError) {
            console.warn(`Attempt ${attempts} failed:`, retryError);
          }
        }
        
        // Clear the flag now that we've used it
        localStorage.removeItem('preventAutoLogin');
        
        // If we found data after retries, proceed with sign in
        if (employerData) {
          // Navigate to profile
          const redirectPath = localStorage.getItem('redirectAfterLogin');
          if (redirectPath) {
            localStorage.removeItem('redirectAfterLogin');
            navigate(redirectPath);
          } else {
            navigate('/employer/profile');
          }
          
          // Store remember me preference if selected
          if (rememberMe) {
            localStorage.setItem('employerEmail', formData.email);
          } else {
            localStorage.removeItem('employerEmail');
          }
          
          toast.success('Signed in successfully!');
          return;
        }
      }

      // Standard account validation if not a new registration or retries failed
      // Check both employers and candidates collections
      const [employerSnapshot, candidateSnapshot] = await Promise.all([
        get(ref(database, `employers/${userCredential.user.uid}`)),
        get(ref(database, `candidates/${userCredential.user.uid}`))
      ]);

      // If user exists in candidates collection, prevent login
      if (candidateSnapshot.exists()) {
        await auth.signOut();
        toast.error('This account is registered as a candidate. Please use candidate login.');
        return;
      }

      // Validate employer account
      if (!employerSnapshot.exists()) {
        // Handle the case where account was just created but data isn't in DB yet
        if (comingFromRegistration) {
          await auth.signOut();
          toast.info('Your account is being set up. Please try again in a moment.');
        } else {
          await auth.signOut();
          toast.error('Account data not found. Please try signing in again later.');
        }
        return;
      }

      // Check if user is an employer
      if (employerSnapshot.exists()) {
        const redirectPath = localStorage.getItem('redirectAfterLogin');
        if (redirectPath) {
          localStorage.removeItem('redirectAfterLogin');
          navigate(redirectPath);
        } else {
          navigate('/employer/profile');
        }
        
        // Store remember me preference if selected
        if (rememberMe) {
          localStorage.setItem('employerEmail', formData.email);
        } else {
          localStorage.removeItem('employerEmail');
        }
        
        toast.success('Signed in successfully!');
      }
    } catch (error) {
      console.error('Error signing in:', error);
      
      // Clear any existing toast notifications
      toast.dismiss();
      
      let errorMessage = 'Failed to sign in';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-full bg-white justify-center items-center min-h-screen">
      {/* Add ToastContainer for toast notifications */}
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
      <div className="max-w-md mx-auto p-8 rounded-lg">
        {comingFromRegistration && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            <p className="font-medium">Registration successful!</p>
            <p>Please check your email to verify your account before signing in.</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 pl-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={loading}
              />
              <MdEmail className="absolute left-3 top-3 text-gray-400" size={20} />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 pl-10 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={loading}
              />
              <BiLock className="absolute left-3 top-3 text-gray-400" size={20} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember-me"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>
            <div className="text-sm">
              <Link to="/forgot-password" className="text-blue-600 hover:text-blue-500">
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-950 text-white rounded-md py-2 px-4 hover:bg-[#cddd3a] hover:text-blue-950 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Don't have an employer account?{' '}
              <Link to="/employer-registration" className="text-blue-600 hover:text-blue-500">
                Register here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployerSignIn;