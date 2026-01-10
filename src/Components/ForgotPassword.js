import React, { useState } from 'react';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { toast } from 'react-toastify';
import { MdEmail } from 'react-icons/md';
import { Link } from 'react-router-dom';

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
                    Reset Password
                  </p>
                  <p
                    style={{ lineHeight: "1.5", color: "#fff" }}
                    className="sm:text-sm text-center font-bold uppercase text-sm"
                  >
                    Enter your email to reset your password
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

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = getAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent! Check your inbox.');
      setEmail('');
    } catch (error) {
      console.error('Error sending reset email:', error);
      let errorMessage = 'Failed to send reset email';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 pl-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email"
                required
                disabled={loading}
              />
              <MdEmail className="absolute left-3 top-3 text-gray-400" size={20} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-950 text-white rounded-md py-2 px-4 hover:bg-[#cddd3a] hover:text-blue-950 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Reset Password'}
          </button>

          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Remember your password?{' '}
              <Link to="/candidate-sign-in" className="text-blue-600 hover:text-blue-500">
                Sign in here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;