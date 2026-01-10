import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getAuth } from 'firebase/auth';
import Header from './Header';
import Footer from './Footer';

const LayoutWrapper = ({ children }) => {
  const location = useLocation();
  const auth = getAuth();
  const [user] = useAuthState(auth);

  const shouldShowFooter = () => {
    // Don't show footer in authenticated sections
    if (user && (location.pathname.includes('/candidate/') || location.pathname.includes('/employer/'))) {
      return false;
    }
    return true;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        {children}
      </main>
      {shouldShowFooter() && <Footer />}
    </div>
  );
};

export default LayoutWrapper;