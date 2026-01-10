import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '../firebase';
import { toast } from 'react-toastify';
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
                    Candidate Sign In
                  </p>
                  <p
                    style={{ lineHeight: "1.5", color: "#fff" }}
                    className="sm:text-sm text-center font-bold uppercase text-sm"
                  >
                    Sign in to access your account and explore job opportunities
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

const CandidateSignIn = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
  
    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      // Check both candidates and employers collections
      const [candidateSnapshot, employerSnapshot] = await Promise.all([
        get(ref(database, `candidates/${userCredential.user.uid}`)),
        get(ref(database, `employers/${userCredential.user.uid}`))
      ]);

      // If user exists in employers collection, prevent login
      if (employerSnapshot.exists()) {
        await auth.signOut();
        toast.error('This account is registered as an employer. Please use employer login.');
        return;
      }

      // Check if user is a candidate
      if (candidateSnapshot.exists()) {
        const redirectPath = localStorage.getItem('redirectAfterLogin');
        if (redirectPath) {
          localStorage.removeItem('redirectAfterLogin');
          navigate(redirectPath);
        } else {
          navigate('/candidate/resume/edit');
        }
        toast.success('Signed in successfully!');
      } else {
        // If not found in either collection
        await auth.signOut();
        toast.error('This account is not registered as a candidate');
      }
    } catch (error) {
      console.error('Error signing in:', error);
      let errorMessage = 'Failed to sign in';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-full bg-white justify-center items-center min-h-screen">
      <Hero />
      <div className="max-w-md mx-auto p-8 rounded-lg">
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
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-900">
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
              Don't have an account?{' '}
              <Link to="/candidate-registration" className="text-blue-600 hover:text-blue-500">
                Register here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CandidateSignIn;