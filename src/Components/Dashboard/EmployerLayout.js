import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import { FaUser, FaBriefcase, FaFileAlt, FaQuestionCircle, FaUsers, FaHeart, FaFileInvoice } from 'react-icons/fa';
import { getDatabase, ref, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';

const EmployerLayout = () => {
  const location = useLocation();
  const auth = getAuth(app);
  const db = getDatabase(app);
  
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch employer subscription data
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }

      try {
        const employerRef = ref(db, `employers/${auth.currentUser.uid}`);
        const employerSnapshot = await get(employerRef);
        
        if (employerSnapshot.exists()) {
          const employerData = employerSnapshot.val();
          setSubscription(employerData.subscription || null);
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [auth.currentUser, db]);

  // Check if employer has access to pre-screening questions
  const hasPreScreeningAccess = () => {
    return subscription && 
           subscription.status === 'active' && 
           subscription.package && 
           subscription.package.features && 
           subscription.package.features.addPreScreeningQuestions === true;
  };

  // Base menu items (always visible)
  const baseMenuItems = [
    {
      path: '/employer/profile',
      icon: FaUser,
      label: 'Profile'
    },
    {
      path: '/employer/jobs',
      icon: FaBriefcase,
      label: 'Job Board'
    },
    {
      path: '/employer/resumes',
      icon: FaFileAlt,
      label: 'All Candidates'
    },
    {
      path: '/employer/applications',
      icon: FaUsers,
      label: 'Candidate Applications'
    },
    {
      path: '/employer/favorites',
      icon: FaHeart,
      label: 'Favorite Candidates'
    },
    {
      path: '/employer/payments',
      icon: FaFileInvoice,
      label: 'Payment History'
    }
  ];

  // Conditionally add Pre-Screening Questions tab
  const menuItems = [
    baseMenuItems[0], // Profile
    // Add Pre-Screening Questions after Profile if user has access
    ...(hasPreScreeningAccess() ? [{
      path: '/employer/questions',
      icon: FaQuestionCircle,
      label: 'Add Pre-Screening Questions'
    }] : []),
    ...baseMenuItems.slice(1) // Rest of the items
  ];

  // Redirect to profile if landing on /employer
  if (location.pathname === '/employer') {
    return <Navigate to="/employer/profile" replace />;
  }

  // Show loading spinner while fetching subscription data
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 bg-blue-950">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <h2 className="text-lg font-semibold text-white">Employer Dashboard</h2>
              </div>

              <nav className="mt-5 flex-1 px-2 space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
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
            </div>
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      <div className="md:hidden bg-blue-950 w-full">
        <div className="flex justify-around p-4 overflow-x-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center space-y-1 min-w-[80px] ${
                  isActive ? 'text-[#cddd3a]' : 'text-white'
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EmployerLayout;