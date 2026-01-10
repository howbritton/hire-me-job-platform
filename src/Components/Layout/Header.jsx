import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getDatabase, ref, get } from 'firebase/database';
import hireMeLogo from '../../assets/hireme-logo.png';
import { FaBars, FaTimes } from 'react-icons/fa';
import { IoMdArrowDropdown, IoMdArrowDropup } from 'react-icons/io';
import { toast } from 'react-toastify';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSignUpDropdownOpen, setIsSignUpDropdownOpen] = useState(false);
  const [isSignInDropdownOpen, setIsSignInDropdownOpen] = useState(false);
  const [isMobileSignInOpen, setIsMobileSignInOpen] = useState(false);
  const [isMobileSignUpOpen, setIsMobileSignUpOpen] = useState(false);
  const [userType, setUserType] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [checkAttempts, setCheckAttempts] = useState(0); // Track attempts to find user data
  
  const auth = getAuth();
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();
  const location = useLocation();
  
  const signUpDropdownRef = useRef(null);
  const signInDropdownRef = useRef(null);
  const mobileSignInRef = useRef(null);
  const mobileSignUpRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let checkUserTimeout = null;

    const checkUserType = async () => {
      if (user) {
        try {
          const db = getDatabase();
          
          // Get all collections simultaneously
          const [candidateSnapshot, employerSnapshot, adminSnapshot] = await Promise.all([
            get(ref(db, `candidates/${user.uid}`)),
            get(ref(db, `employers/${user.uid}`)),
            get(ref(db, `admins/${user.uid}`))
          ]);
          
          if (!isMounted) return;
    
          if (adminSnapshot.exists()) {
            setUserType('admin');
            setUserLoaded(true);
            return;
          }
    
          if (candidateSnapshot.exists() && employerSnapshot.exists()) {
            // Handle edge case where user exists in both collections
            console.error('User exists in both collections');
            setUserType(null);
            toast.error('Account error detected. Please contact support.');
            // Don't sign out immediately, let the user contact support
            setUserLoaded(true);
            return;
          }
          
          if (candidateSnapshot.exists()) {
            setUserType('candidate');
            setUserLoaded(true);
          } else if (employerSnapshot.exists()) {
            setUserType('employer');
            setUserLoaded(true);
          } else {
            // User exists in neither collection
            console.log('User not found in any collection yet, attempt:', checkAttempts + 1);
            
            // If this is a fresh registration, give more time for the database to update
            if (checkAttempts < 5) { // Try up to 5 times with increasing delays
              setCheckAttempts(prev => prev + 1);
              const delay = 1000 + (checkAttempts * 500); // Increasing delay: 1s, 1.5s, 2s, 2.5s, 3s
              
              if (isMounted) {
                checkUserTimeout = setTimeout(() => {
                  checkUserType();
                }, delay);
                return;
              }
            } else {
              // Only after multiple attempts, consider it an error
              console.error('User not found in any collection after multiple attempts');
              toast.error('Account data not found. Please try signing in again later.');
              setUserLoaded(true);
              
              // Don't sign out automatically - let the user try again or navigate away
              // This prevents the error+success message conflict
            }
          }
        } catch (error) {
          console.error('Error checking user type:', error);
          if (isMounted) {
            setUserType(null);
            toast.error('Error verifying account type. Please try again later.');
            setUserLoaded(true);
          }
        }
      } else {
        if (isMounted) {
          setUserType(null);
          setUserLoaded(true);
          setCheckAttempts(0); // Reset attempts when user is null
        }
      }
    };

    if (!loading) {
      checkUserType();
    }

    return () => {
      isMounted = false;
      if (checkUserTimeout) clearTimeout(checkUserTimeout);
    };
  }, [user, loading, auth, checkAttempts]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUserType(null);
      setCheckAttempts(0); // Reset attempts counter
      navigate('/');
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Error signing out. Please try again.');
    }
  };

  const getConsoleLink = () => {
    if (userType === 'candidate') {
      return '/candidate/profile';
    } else if (userType === 'employer') {
      return '/employer/profile';
    } else if (userType === 'admin') {
      return '/admin/dashboard';
    }
    return '/';
  };

  const isInConsole = () => {
    const path = location.pathname;
    return (userType === 'candidate' && path.includes('/candidate/')) || 
           (userType === 'employer' && path.includes('/employer/')) ||
           (userType === 'admin' && path.includes('/admin/'));
  };

  // Function to determine if pricing should be shown
  const shouldShowPricing = () => {
    return !user || userType !== 'candidate';
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    setIsMobileSignInOpen(false);
    setIsMobileSignUpOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (signUpDropdownRef.current && !signUpDropdownRef.current.contains(event.target)) {
        setIsSignUpDropdownOpen(false);
      }
      if (signInDropdownRef.current && !signInDropdownRef.current.contains(event.target)) {
        setIsSignInDropdownOpen(false);
      }
      if (mobileSignInRef.current && !mobileSignInRef.current.contains(event.target)) {
        setIsMobileSignInOpen(false);
      }
      if (mobileSignUpRef.current && !mobileSignUpRef.current.contains(event.target)) {
        setIsMobileSignUpOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Authentication buttons based on user state
  const AuthButtons = () => {
    if (loading || !userLoaded) {
      return <div className="w-8 h-8 border-t-2 border-blue-950 rounded-full animate-spin"></div>;
    }

    if (user && userType) {
      return (
        <div className="flex items-center space-x-4">
          {!isInConsole() && userType !== 'admin' ? (
            <Link
              to={getConsoleLink()}
              className="px-4 py-2 text-blue-950 hover:text-[#cddd3a] transition-colors"
            >
              {userType === 'candidate' ? 'My Profile' : 'Employer Profile'}
            </Link>
          ) : isInConsole() && userType !== 'admin' ? (
            <Link
              to="/"
              className="px-4 py-2 text-blue-950 hover:text-[#cddd3a] transition-colors"
            >
              Main Website
            </Link>
          ) : null}
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-white bg-blue-950 rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors"
          >
            Sign Out
          </button>
        </div>
      );
    }

    // Show this for users who are authenticated but their type hasn't been determined yet
    if (user && !userType && checkAttempts > 0 && checkAttempts < 5) {
      return (
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 border-t-2 border-blue-950 rounded-full animate-spin"></div>
          <span className="text-sm text-blue-950">Loading account...</span>
        </div>
      );
    }

    return (
      <>
        {/* Sign In Dropdown */}
        <div className="relative" ref={signInDropdownRef}>
          <button
            onClick={() => {
              setIsSignInDropdownOpen(!isSignInDropdownOpen);
              setIsSignUpDropdownOpen(false);
            }}
            className="px-4 py-2 text-blue-950 hover:text-[#cddd3a] transition-colors flex items-center"
          >
            Sign In
            {isSignInDropdownOpen ? 
              <IoMdArrowDropup className="ml-1" size={20} /> : 
              <IoMdArrowDropdown className="ml-1" size={20} />
            }
          </button>
          
          {isSignInDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
              <Link
                to="/candidate-sign-in"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-[#cddd3a]"
                onClick={() => setIsSignInDropdownOpen(false)}
              >
                Sign in as Candidate
              </Link>
              <Link
                to="/employer-sign-in"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-[#cddd3a]"
                onClick={() => setIsSignInDropdownOpen(false)}
              >
                Sign in as Employer
              </Link>
            </div>
          )}
        </div>

        {/* Sign Up Dropdown */}
        <div className="relative" ref={signUpDropdownRef}>
          <button
            onClick={() => {
              setIsSignUpDropdownOpen(!isSignUpDropdownOpen);
              setIsSignInDropdownOpen(false);
            }}
            className="px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors flex items-center"
          >
            Sign Up
            {isSignUpDropdownOpen ? 
              <IoMdArrowDropup className="ml-1" size={20} /> : 
              <IoMdArrowDropdown className="ml-1" size={20} />
            }
          </button>
          
          {isSignUpDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
              <Link
                to="/candidate-registration"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-[#cddd3a]"
                onClick={() => setIsSignUpDropdownOpen(false)}
              >
                Register as Candidate
              </Link>
              <Link
                to="/employer-registration"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-[#cddd3a]"
                onClick={() => setIsSignUpDropdownOpen(false)}
              >
                Register as Employer
              </Link>
            </div>
          )}
        </div>
      </>
    );
  };

  // Mobile Auth Buttons - similar changes as desktop
  const MobileAuthButtons = () => {
    if (loading || !userLoaded) {
      return <div className="w-8 h-8 border-t-2 border-blue-950 rounded-full animate-spin"></div>;
    }

    if (user && userType) {
      return (
        <div className="flex flex-col space-y-2">
          {!isInConsole() && userType !== 'admin' ? (
            <Link
              to={getConsoleLink()}
              className="w-full py-2 text-blue-950 hover:text-[#cddd3a] transition-colors text-center"
              onClick={toggleMenu}
            >
              {userType === 'candidate' ? 'My Profile' : 'Employer Profile'}
            </Link>
          ) : isInConsole() && userType !== 'admin' ? (
            <Link
              to="/"
              className="w-full py-2 text-blue-950 hover:text-[#cddd3a] transition-colors text-center"
              onClick={toggleMenu}
            >
              Main Website
            </Link>
          ) : null}
          <button
            onClick={() => {
              handleSignOut();
              toggleMenu();
            }}
            className="w-full py-2 text-blue-950 hover:text-[#cddd3a] transition-colors text-center"
          >
            Sign Out
          </button>
        </div>
      );
    }

    // Show this for users who are authenticated but their type hasn't been determined yet
    if (user && !userType && checkAttempts > 0 && checkAttempts < 5) {
      return (
        <div className="flex items-center justify-center space-x-2 py-2">
          <div className="w-5 h-5 border-t-2 border-blue-950 rounded-full animate-spin"></div>
          <span className="text-sm text-blue-950">Loading account...</span>
        </div>
      );
    }

    return (
      <>
        {/* Mobile Sign In Dropdown */}
        <div ref={mobileSignInRef} className="text-center">
          <button
            onClick={() => {
              setIsMobileSignInOpen(!isMobileSignInOpen);
              setIsMobileSignUpOpen(false);
            }}
            className="w-full flex justify-center items-center py-2 text-blue-950 hover:text-[#cddd3a] transition-colors space-x-2"
          >
            <span>Sign In</span>
            {isMobileSignInOpen ? 
              <IoMdArrowDropup size={20} /> : 
              <IoMdArrowDropdown size={20} />
            }
          </button>
          {isMobileSignInOpen && (
            <div className="space-y-2 bg-gray-50 py-2">
              <Link
                to="/candidate-sign-in"
                className="block py-2 text-gray-700 hover:text-[#cddd3a] transition-colors text-center"
                onClick={toggleMenu}
              >
                Sign in as Candidate
              </Link>
              <Link
                to="/employer-sign-in"
                className="block py-2 text-gray-700 hover:text-[#cddd3a] transition-colors text-center"
                onClick={toggleMenu}
              >
                Sign in as Employer
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Sign Up Dropdown */}
        <div ref={mobileSignUpRef} className="text-center">
          <button
            onClick={() => {
              setIsMobileSignUpOpen(!isMobileSignUpOpen);
              setIsMobileSignInOpen(false);
            }}
            className="w-full flex justify-center items-center py-2 text-blue-950 hover:text-[#cddd3a] transition-colors space-x-2"
          >
            <span>Sign Up</span>
            {isMobileSignUpOpen ? 
              <IoMdArrowDropup size={20} /> : 
              <IoMdArrowDropdown size={20} />
            }
          </button>
          {isMobileSignUpOpen && (
            <div className="space-y-2 bg-gray-50 py-2">
              <Link
                to="/candidate-registration"
                className="block py-2 text-gray-700 hover:text-[#cddd3a] transition-colors text-center"
                onClick={toggleMenu}
              >
                Register as Candidate
              </Link>
              <Link
                to="/employer-registration"
                className="block py-2 text-gray-700 hover:text-[#cddd3a] transition-colors text-center"
                onClick={toggleMenu}
              >
                Register as Employer
              </Link>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <nav className="bg-white shadow-md fixed w-full z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img 
              src={hireMeLogo} 
              alt="HireMe Logo" 
              className="h-8 sm:h-10 md:h-12 w-auto" 
            />
          </Link>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-600 hover:text-blue-950"
            onClick={toggleMenu}
            aria-label="Toggle Menu"
          >
            {isMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/jobs" className="text-gray-700 hover:text-[#cddd3a] transition-colors">
              Jobs
            </Link>
            {shouldShowPricing() && (
              <Link to="/pricing" className="text-gray-700 hover:text-[#cddd3a] transition-colors">
                Pricing
              </Link>
            )}
            <Link to="/about-us" className="text-gray-700 hover:text-[#cddd3a] transition-colors">
              About Us
            </Link>
            <Link to="/contact" className="text-gray-700 hover:text-[#cddd3a] transition-colors">
              Contact Us
            </Link>
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <AuthButtons />
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden ${isMenuOpen ? 'block' : 'hidden'} pb-4`}>
          <div className="flex flex-col space-y-3">
            <Link to="/jobs" 
                  className="text-gray-700 hover:text-[#cddd3a] transition-colors py-2 text-center"
                  onClick={toggleMenu}>
              Jobs
            </Link>
            {shouldShowPricing() && (
              <Link to="/pricing" 
                    className="text-gray-700 hover:text-[#cddd3a] transition-colors py-2 text-center"
                    onClick={toggleMenu}>
                Pricing
              </Link>
            )}
            <Link to="/about-us" 
                  className="text-gray-700 hover:text-[#cddd3a] transition-colors py-2 text-center"
                  onClick={toggleMenu}>
              About Us
            </Link>
            <Link to="/contact" 
                  className="text-gray-700 hover:text-[#cddd3a] transition-colors py-2 text-center"
                  onClick={toggleMenu}>
              Contact Us
            </Link>
            
            {/* Mobile Auth Section */}
            <div className="pt-4 border-t border-gray-200">
              <MobileAuthButtons />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Header;