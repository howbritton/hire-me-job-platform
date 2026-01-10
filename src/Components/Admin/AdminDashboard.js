import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { FaUserClock, FaCalendarTimes, FaTimesCircle, FaUserEdit, FaCalendarCheck } from 'react-icons/fa';
import toast, { Toaster } from 'react-hot-toast';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalEmployers: 0,
    totalCandidates: 0,
    approvedJobs: 0,
    totalJobs: 0,
    totalResumes: 0,
    paidAmount: 0,
    totalPackages: 0,
    monthlyPaidAmount: 0,
    privateCandidates: 0,
    candidatesHired: 0,
    expiredEmployers: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    privateProfiles: 0,
    totalReviews: 0,
    expiredJobs: 0,
    activeExpiredJobs: 0,
    expiredJobsCollection: 0,
    completedProfiles: 0,
    incompleteProfiles: 0, // New stat for incomplete profiles
    expiredProfiles: 0, // New stat for expired candidate profiles
    temporaryWorkers: 0,
    rejectedJobs: 0
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const db = getDatabase(app);
  const auth = getAuth(app);

  const fetchStats = useCallback(async () => {
    try {
      const [
        employersSnap, 
        candidatesSnap, 
        jobsSnap, 
        packagesSnap, 
        paymentsSnap,
        reviewsSnap,
        temporaryWorkersSnap,
        pendingJobsSnap,
        rejectedJobsSnap,
        expiredJobsSnap
      ] = await Promise.all([
        get(ref(db, 'employers')),
        get(ref(db, 'candidates')),
        get(ref(db, 'jobs')),
        get(ref(db, 'packages')),
        get(ref(db, 'payments')),
        get(ref(db, 'reviews')),
        get(ref(db, 'temporaryWorkers')),
        get(ref(db, 'pending-jobs')),
        get(ref(db, 'rejected-jobs')),
        get(ref(db, 'expired-jobs'))
      ]);

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      let totalApprovedJobs = 0;
      let totalJobsCount = 0;

      // Count approved jobs
      if (jobsSnap.exists()) {
        const jobsData = jobsSnap.val();
        Object.keys(jobsData).forEach(employerId => {
          Object.values(jobsData[employerId]).forEach(job => {
            if (job.status === 'approved' || job.status === 'active') {
              totalApprovedJobs++;
            }
            totalJobsCount++;
          });
        });
      }

      // Add pending jobs to total count
      if (pendingJobsSnap.exists()) {
        const pendingJobsData = pendingJobsSnap.val();
        Object.keys(pendingJobsData).forEach(employerId => {
          Object.values(pendingJobsData[employerId]).forEach(job => {
            if (job.status === 'pending') {
              totalJobsCount++;
            }
          });
        });
      }

      // Count rejected jobs
      let totalRejectedJobs = 0;
      if (rejectedJobsSnap.exists()) {
        const rejectedJobsData = rejectedJobsSnap.val();
        Object.keys(rejectedJobsData).forEach(employerId => {
          totalRejectedJobs += Object.keys(rejectedJobsData[employerId]).length;
        });
      }

      // Count jobs in expired-jobs collection
      let expiredJobsCollectionCount = 0;
      if (expiredJobsSnap.exists()) {
        const expiredJobsData = expiredJobsSnap.val();
        Object.keys(expiredJobsData).forEach(employerId => {
          expiredJobsCollectionCount += Object.keys(expiredJobsData[employerId]).length;
        });
      }

      // Count active jobs that are expired by date but still in jobs collection
      let activeExpiredJobsCount = 0;
      if (jobsSnap.exists()) {
        const jobsData = jobsSnap.val();
        const now = new Date();
        
        Object.keys(jobsData).forEach(employerId => {
          Object.values(jobsData[employerId]).forEach(job => {
            if (
              job.status === 'expired' ||
              (job.expirationDate && new Date(job.expirationDate) < now && 
               (job.status === 'approved' || job.status === 'active'))
            ) {
              activeExpiredJobsCount++;
            }
          });
        });
      }

      const totalExpiredJobs = expiredJobsCollectionCount + activeExpiredJobsCount;
      totalJobsCount += expiredJobsCollectionCount + totalRejectedJobs;

      let totalRevenue = 0;
      let monthlyRevenue = 0;
      if (paymentsSnap.exists()) {
        const payments = Object.entries(paymentsSnap.val()).flatMap(([userId, userPayments]) =>
          Object.entries(userPayments).map(([paymentId, payment]) => payment)
        );

        totalRevenue = payments.reduce((sum, payment) => {
          return sum + (payment.status === 'completed' || payment.status === 'approved' ? parseFloat(payment.amount) || 0 : 0);
        }, 0);

        monthlyRevenue = payments.reduce((sum, payment) => {
          const paymentDate = new Date(payment.approvedAt || payment.createdAt);
          if (
            (payment.status === 'completed' || payment.status === 'approved') &&
            paymentDate.getMonth() === currentMonth &&
            paymentDate.getFullYear() === currentYear
          ) {
            return sum + (parseFloat(payment.amount) || 0);
          }
          return sum;
        }, 0);
      }

      let totalResumes = 0;
      let privateProfiles = 0;
      let candidatesHired = 0;
      let completedProfiles = 0;
      let incompleteProfiles = 0;
      let expiredProfiles = 0;

      if (candidatesSnap.exists()) {
        const candidates = Object.values(candidatesSnap.val());
        totalResumes = candidates.filter(c => c.profile?.resume).length;
        privateProfiles = candidates.filter(c => !c.isPublic).length;
        
        // Count completed profiles
        completedProfiles = candidates.filter(c => {
          return c.isPublic === true && 
                 (c.profileStatus === 'active' || c.profileStatus === 'completed') &&
                 c.profile?.resume?.url;
        }).length;

        // Count incomplete profiles - candidates who exist but don't meet completion criteria
        incompleteProfiles = candidates.filter(c => {
          // A profile is incomplete if:
          // 1. Not public OR
          // 2. No resume uploaded OR  
          // 3. Profile status is not active/completed OR
          // 4. Missing basic profile information
          const hasBasicInfo = c.firstName && c.lastName && c.email && c.phone;
          const hasResume = c.profile?.resume?.url;
          const isPublicAndActive = c.isPublic === true && 
                                   (c.profileStatus === 'active' || c.profileStatus === 'completed');
          
          return !hasBasicInfo || !hasResume || !isPublicAndActive;
        }).length;

        // Helper function to check if profile is expired (same as ExpiredProfiles page)
        const getExpirationInfo = (candidate) => {
          const now = new Date();
          const info = {
            isExpired: false,
            reasons: []
          };

          // Check expiration date
          if (candidate.expirationDate) {
            const expirationDate = new Date(candidate.expirationDate);
            if (expirationDate < now) {
              info.isExpired = true;
              info.reasons.push('Expiration date passed');
            }
          }

          // Check auto-deactivation
          if (candidate.autoDeactivatedAt) {
            info.isExpired = true;
            info.reasons.push('Auto-deactivated');
          }

          // Check profile status
          if (candidate.profileStatus === 'expired') {
            info.isExpired = true;
            info.reasons.push('Status set to expired');
          }

          return info;
        };

        // Count expired profiles using the same logic as ExpiredProfiles page
        expiredProfiles = candidates.filter(c => {
          const expirationInfo = getExpirationInfo(c);
          return expirationInfo.isExpired;
        }).length;

        candidatesHired = candidates.reduce((count, candidate) => {
          if (candidate.applications) {
            const hasHiredApplication = Object.values(candidate.applications).some(
              application => application.status && application.status.toLowerCase() === 'hired'
            );
            return hasHiredApplication ? count + 1 : count;
          }
          return count;
        }, 0);
      }

      const totalReviews = reviewsSnap.exists() ? Object.keys(reviewsSnap.val()).length : 0;
      const totalTemporaryWorkers = temporaryWorkersSnap.exists() ? Object.keys(temporaryWorkersSnap.val()).length : 0;

      setStats({
        totalEmployers: employersSnap.exists() ? Object.keys(employersSnap.val()).length : 0,
        totalCandidates: candidatesSnap.exists() ? Object.keys(candidatesSnap.val()).length : 0,
        approvedJobs: totalApprovedJobs,
        totalJobs: totalJobsCount,
        totalResumes,
        completedProfiles,
        incompleteProfiles, // Set the incomplete profiles count
        expiredProfiles, // Set the expired profiles count
        paidAmount: totalRevenue,
        totalPackages: packagesSnap.exists() ? Object.keys(packagesSnap.val()).length : 0,
        monthlyPaidAmount: monthlyRevenue,
        privateCandidates: privateProfiles,
        candidatesHired,
        expiredEmployers: employersSnap.exists() ? 
          Object.values(employersSnap.val()).filter(e => 
            e.subscription?.endDate && new Date(e.subscription.endDate) < currentDate
          ).length : 0,
        totalRevenue,
        monthlyRevenue,
        privateProfiles,
        totalReviews,
        expiredJobs: totalExpiredJobs,
        activeExpiredJobs: activeExpiredJobsCount,
        expiredJobsCollection: expiredJobsCollectionCount,
        temporaryWorkers: totalTemporaryWorkers,
        rejectedJobs: totalRejectedJobs
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Error loading dashboard stats');
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!auth.currentUser) {
        navigate('/admin-login');
        return;
      }

      try {
        const adminRef = ref(db, `admins/${auth.currentUser.uid}`);
        const snapshot = await get(adminRef);
        
        if (snapshot.exists()) {
          setIsAdmin(true);
          fetchStats();
        } else {
          toast.error('Access denied. Admin privileges required.');
          navigate('/admin-login');
        }
      } catch (error) {
        console.error('Error checking admin access:', error);
        navigate('/admin-login');
      }
    };

    checkAdminAccess();
  }, [auth.currentUser, db, navigate, fetchStats]);

  if (!isAdmin || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 w-full text-right">
      <Toaster position="top-right" />

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-blue-950">Admin Dashboard</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Total Employers</h3>
          <p className="text-3xl font-bold text-blue-950">{stats.totalEmployers}</p>
        </div>
        <div className="bg-green-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Total Candidates</h3>
          <p className="text-3xl font-bold text-green-600">{stats.totalCandidates}</p>
        </div>
        <Link to="/admin/completed-profiles" className="bg-emerald-100 p-4 rounded-lg hover:bg-emerald-200 transition-colors">
          <h3 className="text-lg font-semibold mb-2">Completed Profiles</h3>
          <p className="text-3xl font-bold text-emerald-600">{stats.completedProfiles}</p>
          <p className="text-sm text-emerald-700 mt-1">Candidates with completed profiles</p>
        </Link>
        {/* New Incomplete Profiles Button */}
        <Link to="/admin/incomplete-profiles" className="bg-orange-100 p-4 rounded-lg hover:bg-orange-200 transition-colors">
          <h3 className="text-lg font-semibold mb-2">Incomplete Profiles</h3>
          <div className="flex items-center justify-between">
            <FaUserEdit className="text-3xl text-orange-600" />
            <p className="text-3xl font-bold text-orange-600">{stats.incompleteProfiles}</p>
          </div>
          <p className="text-sm text-orange-700 mt-1">Profiles needing completion</p>
        </Link>
        {/* New Expired Profiles Button */}
        <Link to="/admin/expired-profiles" className="bg-red-100 p-4 rounded-lg hover:bg-red-200 transition-colors">
          <h3 className="text-lg font-semibold mb-2">Expired Profiles</h3>
          <div className="flex items-center justify-between">
            <FaCalendarCheck className="text-3xl text-red-600" />
            <p className="text-3xl font-bold text-red-600">{stats.expiredProfiles}</p>
          </div>
          <p className="text-sm text-red-700 mt-1">Candidate profiles that expired</p>
        </Link>
        <div className="bg-yellow-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Approved Jobs</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.approvedJobs}</p>
        </div>
        <div className="bg-purple-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Total Jobs</h3>
          <p className="text-3xl font-bold text-purple-600">{stats.totalJobs}</p>
          <p className="text-sm text-purple-700 mt-1">Active, pending, rejected & expired</p>
        </div>
        <div className="bg-red-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Total Resumes</h3>
          <p className="text-3xl font-bold text-red-600">{stats.totalResumes}</p>
        </div>
        <Link to="/admin/rejected-jobs" className="bg-red-100 p-4 rounded-lg hover:bg-red-200 transition-colors">
          <h3 className="text-lg font-semibold mb-2">Rejected Jobs</h3>
          <div className="flex items-center justify-between">
            <FaTimesCircle className="text-3xl text-red-600" />
            <p className="text-3xl font-bold text-red-600">{stats.rejectedJobs}</p>
          </div>
          <p className="text-sm text-red-700 mt-1">Jobs that were rejected</p>
        </Link>
        <div className="bg-indigo-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Total Revenue</h3>
          <p className="text-3xl font-bold text-indigo-600">
            ${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-pink-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Total Packages</h3>
          <p className="text-3xl font-bold text-pink-600">{stats.totalPackages}</p>
        </div>
        <div className="bg-orange-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">This Month's Revenue</h3>
          <p className="text-3xl font-bold text-orange-600">
            ${stats.monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-teal-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Private Candidate Profiles</h3>
          <p className="text-3xl font-bold text-teal-600">{stats.privateProfiles}</p>
        </div>
        <div className="bg-cyan-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Candidates Hired</h3>
          <p className="text-3xl font-bold text-cyan-600">{stats.candidatesHired}</p>
          <p className="text-sm text-cyan-700 mt-1">Successfully placed candidates</p>
        </div>
        <div className="bg-amber-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Expired Subscriptions</h3>
          <p className="text-3xl font-bold text-amber-600">{stats.expiredEmployers}</p>
        </div>
        <div className="bg-slate-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Total Reviews</h3>
          <p className="text-3xl font-bold text-slate-600">{stats.totalReviews}</p>
        </div>
        <Link to="/admin/temporary-workers" className="bg-lime-100 p-4 rounded-lg hover:bg-lime-200 transition-colors">
          <h3 className="text-lg font-semibold mb-2">Temporary Workers</h3>
          <div className="flex items-center justify-between">
            <FaUserClock className="text-3xl text-lime-600" />
            <p className="text-3xl font-bold text-lime-600">{stats.temporaryWorkers}</p>
          </div>
        </Link>
        <Link to="/admin/expired-jobs" className="bg-rose-100 p-4 rounded-lg hover:bg-rose-200 transition-colors">
          <h3 className="text-lg font-semibold mb-2">Expired Jobs</h3>
          <div className="flex items-center justify-between">
            <FaCalendarTimes className="text-3xl text-rose-600" />
            <p className="text-3xl font-bold text-rose-600">{stats.expiredJobs}</p>
          </div>
          <div className="text-sm text-rose-700 mt-1">
            <div>In expired collection: {stats.expiredJobsCollection}</div>
            <div>Active but expired: {stats.activeExpiredJobs}</div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;