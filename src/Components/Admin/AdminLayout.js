import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database';
import { toast } from 'react-toastify';
import { app } from '../../firebase';

const AdminLayout = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const auth = getAuth(app);
  const db = getDatabase(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/admin-login');
        return;
      }

      try {
        const adminRef = ref(db, `admins/${user.uid}`);
        const snapshot = await get(adminRef);
        
        if (!snapshot.exists()) {
          toast.error('Access denied. Admin privileges required.');
          await auth.signOut();
          navigate('/admin-login');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        navigate('/admin-login');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, db, navigate]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/admin-login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Error signing out');
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
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-950 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/admin/dashboard" className="text-xl font-bold">
                Admin
              </Link>
              <div className="ml-10 flex space-x-4 overflow-x-auto">
                <Link to="/admin/dashboard" className="px-3 py-2 rounded-md hover:bg-[#cddd3a] hover:text-blue-950">
                  Dashboard
                </Link>
                <Link to="/admin/users" className="px-3 py-2 rounded-md hover:bg-[#cddd3a] hover:text-blue-950">
                  Users
                </Link>
                <Link to="/admin/all-jobs" className="px-3 py-2 rounded-md hover:bg-[#cddd3a] hover:text-blue-950">
                  Jobs
                </Link>
                <Link to="/admin/approve-jobs" className="px-3 py-2 rounded-md hover:bg-[#cddd3a] hover:text-blue-950">
                  Approve
                </Link>
                <Link to="/admin/transactions" className="px-3 py-2 rounded-md hover:bg-[#cddd3a] hover:text-blue-950">
                  Transactions
                </Link>
                <Link to="/admin/resumes" className="px-3 py-2 rounded-md hover:bg-[#cddd3a] hover:text-blue-950">
                  Resumes
                </Link>
                <Link to="/admin/packages" className="px-3 py-2 rounded-md hover:bg-[#cddd3a] hover:text-blue-950">
                  Packages
                </Link>
                <Link to="/admin/reviews" className="px-3 py-2 rounded-md hover:bg-[#cddd3a] hover:text-blue-950">
                  Reviews
                </Link>
                <Link to="/admin/promo-codes" className="px-3 py-2 rounded-md hover:bg-[#cddd3a] hover:text-blue-950">
                  Promo
                </Link>
                <Link to="/admin/messages" className="px-3 py-2 rounded-md hover:bg-[#cddd3a] hover:text-blue-950">
                  Messages
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleSignOut}
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;