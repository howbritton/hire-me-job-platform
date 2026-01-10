import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { FaUser, FaFileAlt, FaHeart, FaBars, FaTimes, FaClipboardList } from 'react-icons/fa';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const MENU_ITEMS = [
  {
    path: '/candidate/profile',
    icon: FaUser,
    label: 'Profile'
  },
  {
    path: '/candidate/resume',
    icon: FaFileAlt,
    label: 'Resume'
  },
  {
    path: '/candidate/favorites',
    icon: FaHeart,
    label: 'Favorites'
  },
  {
    path: '/candidate/applied',
    icon: FaClipboardList,
    label: 'Applied Jobs'
  }
];

const CandidateLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const auth = getAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success('Signed out successfully');
      navigate('/candidate-sign-in');
    } catch (error) {
      toast.error('Error signing out');
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 bg-blue-950">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center justify-between flex-shrink-0 px-4">
                <h2 className="text-lg font-semibold text-white">Candidate Dashboard</h2>
              </div>
              <nav className="mt-5 flex-1 px-2 space-y-1">
                {MENU_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                        isActive
                          ? 'bg-[#cddd3a] text-blue-950'
                          : 'text-white hover:bg-blue-900 hover:text-white'
                      }`}
                    >
                      <Icon
                        className={`mr-3 h-5 w-5 ${
                          isActive ? 'text-blue-950' : 'text-white'
                        }`}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="px-4 py-4">
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-sm text-white bg-blue-900 rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors duration-200"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-blue-950 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-semibold text-white">Candidate Dashboard</h2>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-white focus:outline-none"
          >
            {isMobileMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
          </button>
        </div>
        
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="bg-blue-950 px-2 pt-2 pb-3 space-y-1">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-3 py-2 rounded-md text-base font-medium ${
                    isActive
                      ? 'bg-[#cddd3a] text-blue-950'
                      : 'text-white hover:bg-blue-900'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon
                    className={`mr-3 h-5 w-5 ${
                      isActive ? 'text-blue-950' : 'text-white'
                    }`}
                  />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              className="w-full mt-2 px-3 py-2 text-base font-medium text-white bg-blue-900 rounded-md hover:bg-[#cddd3a] hover:text-blue-950"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          <div className="py-6 md:py-6 md:px-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CandidateLayout;