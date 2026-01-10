import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get, update } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { Plus, Edit2, AlertCircle, Clock, CheckCircle2, CalendarX, RotateCcw, Eye } from 'lucide-react';
import AddEmployerJobs from './AddEmployerJobs';
import EditEmployerJobs from './EditEmployerJobs';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';

const EmployerJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [pendingJobs, setPendingJobs] = useState([]);
  const [expiredJobs, setExpiredJobs] = useState([]); // ✅ NEW: State for expired jobs
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingJobId, setEditingJobId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null); // ✅ NEW: State for job details modal
  const [showJobModal, setShowJobModal] = useState(false); // ✅ NEW: State for showing job details
  const [subscription, setSubscription] = useState(null);
  const [jobsRemaining, setJobsRemaining] = useState(0);
  const [jobsInCurrentPeriod, setJobsInCurrentPeriod] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'pending', or 'expired'

  const auth = getAuth(app);
  const db = getDatabase(app);

  useEffect(() => {
    const fetchJobsAndSubscription = async () => {
      if (!auth.currentUser) return;

      try {
        // Get the user's payment history to determine active subscription
        const paymentsRef = ref(db, `payments/${auth.currentUser.uid}`);
        const paymentsSnapshot = await get(paymentsRef);
        
        let subscriptionData = null;
        
        if (paymentsSnapshot.exists()) {
          const payments = paymentsSnapshot.val();
          
          // Get the most recent completed payment
          const completedPayments = Object.entries(payments)
            .filter(([id, payment]) => payment.status === 'approved')
            .map(([id, payment]) => ({
              id,
              ...payment,
              createdAt: new Date(payment.createdAt)
            }))
            .sort((a, b) => b.createdAt - a.createdAt);
          
          if (completedPayments.length > 0) {
            const latestPayment = completedPayments[0];
            
            // Get package details
            const packageRef = ref(db, `packages/${latestPayment.packageId}`);
            const packageSnapshot = await get(packageRef);
            
            if (packageSnapshot.exists()) {
              const packageData = packageSnapshot.val();
              
              // Calculate subscription end date based on payment date + package duration
              const paymentDate = latestPayment.createdAt;
              const subscriptionEndDate = new Date(paymentDate);
              subscriptionEndDate.setDate(subscriptionEndDate.getDate() + (packageData.duration || 30));
              
              const now = new Date();
              const isActive = subscriptionEndDate > now;
              
              subscriptionData = {
                package: {
                  id: latestPayment.packageId,
                  name: packageData.name,
                  price: latestPayment.amount,
                  jobPostLimit: packageData.jobPostLimit,
                  ...packageData
                },
                startDate: paymentDate.toISOString(),
                endDate: subscriptionEndDate.toISOString(),
                status: isActive ? 'active' : 'expired',
                paymentStatus: 'confirmed',
                paymentId: latestPayment.id,
                paymentDate: paymentDate.toISOString()
              };
            } else {
              // Package doesn't exist, but we have payment data
              const paymentDate = latestPayment.createdAt;
              const subscriptionEndDate = new Date(paymentDate);
              subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30); // Default 30 days
              
              const now = new Date();
              const isActive = subscriptionEndDate > now;
              
              subscriptionData = {
                package: {
                  id: latestPayment.packageId,
                  name: latestPayment.packageName || 'Package',
                  price: latestPayment.amount,
                  jobPostLimit: 1 // Default job post limit
                },
                startDate: paymentDate.toISOString(),
                endDate: subscriptionEndDate.toISOString(),
                status: isActive ? 'active' : 'expired',
                paymentStatus: 'confirmed',
                paymentId: latestPayment.id,
                paymentDate: paymentDate.toISOString()
              };
            }
          }
        }
        
        setSubscription(subscriptionData);

        // Fetch approved jobs
        const jobsRef = ref(db, `jobs/${auth.currentUser.uid}`);
        const snapshot = await get(jobsRef);
        
        let jobsList = [];
        let expiredJobsList = [];
        const now = new Date();
        
        if (snapshot.exists()) {
          const allJobs = Object.entries(snapshot.val()).map(([id, data]) => ({
            id,
            ...data
          }));
          
          // ✅ NEW: Separate active and expired jobs
          allJobs.forEach(job => {
            const isExpired = job.status === 'expired' || 
                            (job.expirationDate && new Date(job.expirationDate) < now);
            
            if (isExpired) {
              expiredJobsList.push({
                ...job,
                daysExpired: job.expirationDate ? 
                  Math.floor((now - new Date(job.expirationDate)) / (1000 * 60 * 60 * 24)) : 0,
                expiredReason: job.status === 'expired' ? 'Manually expired' : 'Date expired'
              });
            } else {
              jobsList.push(job);
            }
          });
        }
        
        setJobs(jobsList);
        setExpiredJobs(expiredJobsList); // ✅ NEW: Set expired jobs

        // Fetch pending jobs
        const pendingJobsRef = ref(db, `pending-jobs/${auth.currentUser.uid}`);
        const pendingSnapshot = await get(pendingJobsRef);
        
        let pendingJobsList = [];
        if (pendingSnapshot.exists()) {
          pendingJobsList = Object.entries(pendingSnapshot.val()).map(([id, data]) => ({
            id,
            ...data,
            status: 'pending'
          }));
        }
        
        setPendingJobs(pendingJobsList);
        
        // Calculate jobs for current subscription period
        if (subscriptionData?.status === 'active' && subscriptionData?.package?.jobPostLimit) {
          const currentSubscriptionStart = new Date(subscriptionData.startDate);
          
          // Include both approved and pending jobs when calculating usage
          const allJobs = [...jobsList, ...pendingJobsList];
          
          // Filter jobs posted during current subscription period
          const currentPeriodJobs = allJobs.filter(job => {
            const jobDate = new Date(job.createdAt);
            return jobDate >= currentSubscriptionStart;
          });

          setJobsInCurrentPeriod(currentPeriodJobs);
          
          const jobLimit = subscriptionData.package.jobPostLimit === -1 
            ? Infinity 
            : subscriptionData.package.jobPostLimit;
            
          setJobsRemaining(jobLimit - currentPeriodJobs.length);
        } else {
          setJobsInCurrentPeriod([]);
          setJobsRemaining(0);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Error loading jobs');
      } finally {
        setLoading(false);
      }
    };

    fetchJobsAndSubscription();
  }, [auth.currentUser, db]);

  // ✅ NEW: Function to view job details
  const handleViewJobDetails = (job) => {
    setSelectedJob(job);
    setShowJobModal(true);
  };

  // ✅ NEW: Function to reactivate an expired job
  const handleReactivateJob = async (jobId) => {
    if (!subscription || subscription.status !== 'active') {
      toast.warning('You need an active subscription to reactivate jobs');
      return;
    }

    if (jobsRemaining <= 0 && subscription.package.jobPostLimit !== -1) {
      toast.warning('You have reached your job posting limit for this subscription period.');
      return;
    }

    if (window.confirm('Are you sure you want to reactivate this job? This will make it visible to candidates again.')) {
      try {
        const jobRef = ref(db, `jobs/${auth.currentUser.uid}/${jobId}`);
        
        // Calculate new expiration date (30 days from now)
        const now = new Date();
        const newExpirationDate = new Date(now);
        newExpirationDate.setDate(newExpirationDate.getDate() + 30);
        
        await update(jobRef, {
          status: 'approved',
          expirationDate: newExpirationDate.toISOString(),
          reactivatedAt: now.toISOString(),
          updatedAt: now.toISOString()
        });
        
        toast.success('Job reactivated successfully!');
        
        // Refresh the jobs list
        window.location.reload();
      } catch (error) {
        console.error('Error reactivating job:', error);
        toast.error('Failed to reactivate job');
      }
    }
  };

  const handleAddJob = () => {
    if (!subscription || subscription.status !== 'active') {
      toast.warning('You need an active subscription to post jobs');
      return;
    }

    const now = new Date();
    const endDate = new Date(subscription.endDate);
    
    if (now > endDate) {
      toast.warning('Your subscription has expired. Please renew your subscription.');
      return;
    }

    if (jobsRemaining <= 0 && subscription.package.jobPostLimit !== -1) {
      toast.warning('You have reached your job posting limit for this subscription period. Please upgrade your subscription.');
      return;
    }
    
    setShowAddModal(true);
  };

  const handleEditJob = (jobId) => {
    setEditingJobId(jobId);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'inactive':
        return 'text-red-600 bg-red-100';
      case 'approved':
        return 'text-blue-600 bg-blue-100';
      case 'expired':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return <CheckCircle2 className="w-4 h-4 mr-1" />;
      case 'pending':
        return <Clock className="w-4 h-4 mr-1" />;
      case 'inactive':
        return <AlertCircle className="w-4 h-4 mr-1" />;
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 mr-1" />;
      case 'expired':
        return <CalendarX className="w-4 h-4 mr-1" />;
      default:
        return null;
    }
  };

  const isJobInCurrentPeriod = (job) => {
    if (!subscription?.startDate) return false;
    const jobDate = new Date(job.createdAt);
    const subscriptionStart = new Date(subscription.startDate);
    return jobDate >= subscriptionStart;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  // ✅ UPDATED: Determine what to display based on the active tab
  const displayJobs = activeTab === 'active' ? jobs : 
                    activeTab === 'pending' ? pendingJobs : expiredJobs;
  const allJobsEmpty = jobs.length === 0 && pendingJobs.length === 0 && expiredJobs.length === 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">My Job Postings</h1>
          <div className="mt-1 space-y-1">
            {subscription && subscription.status === 'active' && (
              <>
                <p className="text-sm text-gray-600">
                  Current Package: {subscription.package.name} ({subscription.package.jobPostLimit === -1 ? 'Unlimited' : subscription.package.jobPostLimit} posts)
                </p>
                <p className="text-sm text-gray-600">
                  Jobs Posted in Current Period: {jobsInCurrentPeriod.length} {subscription.package.jobPostLimit !== -1 ? `/ ${subscription.package.jobPostLimit}` : ''}
                </p>
                {subscription.package.jobPostLimit !== -1 && (
                  <p className="text-sm text-gray-600">
                    Jobs Remaining: {jobsRemaining}
                  </p>
                )}
                <p className="text-sm text-gray-600">
                  Subscription Period: {new Date(subscription.startDate).toLocaleDateString()} - {new Date(subscription.endDate).toLocaleDateString()}
                </p>
                <p className="text-sm text-blue-600">
                  Based on Payment: {subscription.paymentId} (${subscription.package.price})
                </p>
              </>
            )}
            {(!subscription || subscription.status !== 'active') && (
              <p className="text-sm text-red-600">
                No active subscription. <Link to="/pricing" className="text-blue-600 hover:underline">Get a subscription</Link>
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleAddJob}
          className="flex items-center px-4 py-2 bg-blue-950 hover:bg-blue-900 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!subscription || subscription.status !== 'active' || (jobsRemaining <= 0 && subscription.package.jobPostLimit !== -1)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Post New Job
        </button>
      </div>

      {/* ✅ UPDATED: Tab Navigation with Expired Jobs tab */}
      {!allJobsEmpty && (
        <div className="flex border-b mb-6">
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'active'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('active')}
          >
            Active Jobs ({jobs.length})
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'pending'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('pending')}
          >
            Pending Approval ({pendingJobs.length})
            {pendingJobs.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                {pendingJobs.length}
              </span>
            )}
          </button>
          {/* ✅ NEW: Expired Jobs tab */}
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'expired'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('expired')}
          >
            Expired Jobs ({expiredJobs.length})
            {expiredJobs.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                {expiredJobs.length}
              </span>
            )}
          </button>
        </div>
      )}

      {displayJobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex flex-col items-center justify-center h-64">
            {activeTab === 'active' && allJobsEmpty ? (
              <>
                <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No Jobs Posted</h3>
                <p className="text-gray-500 text-center mt-2">
                  You haven't posted any jobs yet. Click the 'Post New Job' button to get started.
                </p>
              </>
            ) : activeTab === 'active' ? (
              <>
                <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No Active Jobs</h3>
                <p className="text-gray-500 text-center mt-2">
                  You don't have any active job listings at the moment.
                </p>
                {(pendingJobs.length > 0 || expiredJobs.length > 0) && (
                  <div className="mt-4 space-y-2">
                    {pendingJobs.length > 0 && (
                      <button
                        onClick={() => setActiveTab('pending')}
                        className="block text-blue-600 hover:underline"
                      >
                        View {pendingJobs.length} pending job{pendingJobs.length !== 1 ? 's' : ''} awaiting approval
                      </button>
                    )}
                    {expiredJobs.length > 0 && (
                      <button
                        onClick={() => setActiveTab('expired')}
                        className="block text-blue-600 hover:underline"
                      >
                        View {expiredJobs.length} expired job{expiredJobs.length !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : activeTab === 'pending' ? (
              <>
                <Clock className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No Pending Jobs</h3>
                <p className="text-gray-500 text-center mt-2">
                  You don't have any jobs awaiting approval.
                </p>
                {(jobs.length > 0 || expiredJobs.length > 0) && (
                  <div className="mt-4 space-y-2">
                    {jobs.length > 0 && (
                      <button
                        onClick={() => setActiveTab('active')}
                        className="block text-blue-600 hover:underline"
                      >
                        View {jobs.length} active job{jobs.length !== 1 ? 's' : ''}
                      </button>
                    )}
                    {expiredJobs.length > 0 && (
                      <button
                        onClick={() => setActiveTab('expired')}
                        className="block text-blue-600 hover:underline"
                      >
                        View {expiredJobs.length} expired job{expiredJobs.length !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              // ✅ NEW: Empty state for expired jobs
              <>
                <CalendarX className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No Expired Jobs</h3>
                <p className="text-gray-500 text-center mt-2">
                  You don't have any expired job listings.
                </p>
                {(jobs.length > 0 || pendingJobs.length > 0) && (
                  <div className="mt-4 space-y-2">
                    {jobs.length > 0 && (
                      <button
                        onClick={() => setActiveTab('active')}
                        className="block text-blue-600 hover:underline"
                      >
                        View {jobs.length} active job{jobs.length !== 1 ? 's' : ''}
                      </button>
                    )}
                    {pendingJobs.length > 0 && (
                      <button
                        onClick={() => setActiveTab('pending')}
                        className="block text-blue-600 hover:underline"
                      >
                        View {pendingJobs.length} pending job{pendingJobs.length !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {displayJobs.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xl font-semibold text-blue-950">
                        {job.jobTitle}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(activeTab === 'expired' ? 'expired' : job.status)} flex items-center`}>
                        {getStatusIcon(activeTab === 'expired' ? 'expired' : job.status)}
                        {activeTab === 'expired' ? 'Expired' : job.status === 'pending' ? 'Pending Approval' : job.status}
                      </span>
                      {isJobInCurrentPeriod(job) && activeTab !== 'expired' && (
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-600">
                          Current Period
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mt-1">{job.companyName}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-gray-500">Location</p>
                        <p className="font-medium">{job.parish}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Employment Type</p>
                        <p className="font-medium">{job.employmentType}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Applications</p>
                        <p className="font-medium">
                          {job.status === 'pending' 
                            ? 'N/A (awaiting approval)' 
                            : (typeof job.applications === 'object' 
                              ? Object.keys(job.applications).length 
                              : job.applications || 0)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Posted: {new Date(job.createdAt).toLocaleDateString()}
                    </p>
                    
                    {/* ✅ NEW: Show expired job information */}
                    {activeTab === 'expired' && (
                      <div className="mt-3 p-3 bg-red-50 text-red-800 rounded-md text-sm">
                        <div className="flex items-start">
                          <CalendarX className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium">
                              This job expired {job.daysExpired} day{job.daysExpired !== 1 ? 's' : ''} ago
                            </p>
                            <p className="text-xs mt-1">
                              Reason: {job.expiredReason}
                              {job.expirationDate && ` • Expired on: ${new Date(job.expirationDate).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {job.status === 'pending' && activeTab !== 'expired' && (
                      <div className="mt-3 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                        <div className="flex items-start">
                          <Clock className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium">This job is awaiting admin approval</p>
                            <p>Your job posting will be visible to candidates once approved by our team. This typically takes 1-2 business days.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {activeTab === 'active' && (
                      <button
                        onClick={() => handleEditJob(job.id)}
                        className="p-2 text-gray-600 hover:text-blue-950 hover:bg-gray-100 rounded-md transition-colors"
                        title="Edit Job"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    {/* ✅ NEW: View details button for all jobs */}
                    <button
                      onClick={() => handleViewJobDetails(job)}
                      className="p-2 text-gray-600 hover:text-blue-950 hover:bg-gray-100 rounded-md transition-colors"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {/* ✅ NEW: Reactivate button for expired jobs */}
                    {activeTab === 'expired' && subscription?.status === 'active' && (
                      <button
                        onClick={() => handleReactivateJob(job.id)}
                        className="flex items-center px-3 py-1 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded-md transition-colors"
                        disabled={jobsRemaining <= 0 && subscription.package.jobPostLimit !== -1}
                        title="Reactivate Job"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddEmployerJobs
          onClose={() => setShowAddModal(false)}
          jobsRemaining={jobsRemaining}
        />
      )}

      {editingJobId && (
        <EditEmployerJobs
          jobId={editingJobId}
          onClose={() => setEditingJobId(null)}
        />
      )}

      {/* ✅ NEW: Job Details Modal */}
      {showJobModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-bold text-blue-950">Job Details</h3>
              <button 
                onClick={() => setShowJobModal(false)} 
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div>
                  <div className="mb-6">
                    <h4 className="text-2xl font-semibold mb-2 text-blue-950">{selectedJob.jobTitle}</h4>
                    <p className="text-lg text-gray-600 mb-2">{selectedJob.companyName}</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(activeTab === 'expired' ? 'expired' : selectedJob.status)} flex items-center`}>
                        {getStatusIcon(activeTab === 'expired' ? 'expired' : selectedJob.status)}
                        {activeTab === 'expired' ? 'Expired' : selectedJob.status === 'pending' ? 'Pending Approval' : selectedJob.status}
                      </span>
                      {activeTab === 'expired' && (
                        <span className="text-red-600 text-sm">
                          ({selectedJob.daysExpired} day{selectedJob.daysExpired !== 1 ? 's' : ''} ago)
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Location</h5>
                      <p className="text-gray-600">{selectedJob.parish}</p>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Work Type</h5>
                      <p className="text-gray-600">{selectedJob.workType}</p>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Employment Type</h5>
                      <p className="text-gray-600">{selectedJob.employmentType}</p>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Salary</h5>
                      <p className="text-gray-600">{selectedJob.salary || 'Not specified'}</p>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Experience Required</h5>
                      <p className="text-gray-600">{selectedJob.experience || 'Not specified'}</p>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Education Required</h5>
                      <p className="text-gray-600">{selectedJob.degreeLevel || 'Not specified'}</p>
                    </div>

                    {selectedJob.skills && selectedJob.skills.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-gray-700 mb-1">Required Skills</h5>
                        <div className="flex flex-wrap gap-2">
                          {selectedJob.skills.map((skill, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right Column */}
                <div>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Applications</h5>
                      <p className="text-gray-600">
                        {selectedJob.status === 'pending' 
                          ? 'N/A (awaiting approval)' 
                          : (typeof selectedJob.applications === 'object' 
                            ? Object.keys(selectedJob.applications).length 
                            : selectedJob.applications || 0)}
                      </p>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Created At</h5>
                      <p className="text-gray-600">{new Date(selectedJob.createdAt).toLocaleString()}</p>
                    </div>
                    
                    {selectedJob.expirationDate && (
                      <div>
                        <h5 className="font-semibold text-gray-700 mb-1">
                          {activeTab === 'expired' ? 'Expired On' : 'Expiration Date'}
                        </h5>
                        <p className={`${activeTab === 'expired' ? 'text-red-600' : 'text-gray-600'}`}>
                          {new Date(selectedJob.expirationDate).toLocaleString()}
                        </p>
                      </div>
                    )}
                    
                    {activeTab === 'expired' && (
                      <div>
                        <h5 className="font-semibold text-gray-700 mb-1">Expiration Reason</h5>
                        <p className="text-red-600">{selectedJob.expiredReason}</p>
                      </div>
                    )}
                    
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Contact Email</h5>
                      <p className="text-gray-600">{selectedJob.contactEmail || selectedJob.applicationEmail || 'Not specified'}</p>
                    </div>

                    {selectedJob.contactPhone && (
                      <div>
                        <h5 className="font-semibold text-gray-700 mb-1">Contact Phone</h5>
                        <p className="text-gray-600">{selectedJob.contactPhone}</p>
                      </div>
                    )}

                    {selectedJob.applicationDeadline && (
                      <div>
                        <h5 className="font-semibold text-gray-700 mb-1">Application Deadline</h5>
                        <p className="text-gray-600">{new Date(selectedJob.applicationDeadline).toLocaleDateString()}</p>
                      </div>
                    )}

                    {isJobInCurrentPeriod(selectedJob) && activeTab !== 'expired' && (
                      <div>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-600">
                          Posted in Current Subscription Period
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Job Description */}
              <div className="mt-8">
                <h5 className="font-semibold text-gray-700 mb-3 text-lg">Job Description</h5>
                <div className="border p-4 rounded-lg bg-gray-50 whitespace-pre-line text-gray-700 leading-relaxed">
                  {selectedJob.description || 'No description provided'}
                </div>
              </div>

              {/* Requirements */}
              {selectedJob.requirements && (
                <div className="mt-6">
                  <h5 className="font-semibold text-gray-700 mb-3 text-lg">Requirements</h5>
                  <div className="border p-4 rounded-lg bg-gray-50 whitespace-pre-line text-gray-700 leading-relaxed">
                    {selectedJob.requirements}
                  </div>
                </div>
              )}

              {/* Benefits */}
              {selectedJob.benefits && (
                <div className="mt-6">
                  <h5 className="font-semibold text-gray-700 mb-3 text-lg">Benefits</h5>
                  <div className="border p-4 rounded-lg bg-gray-50 whitespace-pre-line text-gray-700 leading-relaxed">
                    {selectedJob.benefits}
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="mt-8 flex gap-4 justify-end pt-4 border-t">
                <button 
                  onClick={() => setShowJobModal(false)}
                  className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
                
                {activeTab === 'active' && (
                  <button 
                    onClick={() => {
                      setShowJobModal(false);
                      handleEditJob(selectedJob.id);
                    }}
                    className="flex items-center px-6 py-2 bg-blue-950 text-white rounded-md hover:bg-blue-900 transition-colors"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Job
                  </button>
                )}
                
                {activeTab === 'expired' && subscription?.status === 'active' && (
                  <button 
                    onClick={() => {
                      setShowJobModal(false);
                      handleReactivateJob(selectedJob.id);
                    }}
                    className="flex items-center px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    disabled={jobsRemaining <= 0 && subscription.package.jobPostLimit !== -1}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reactivate Job
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerJobs;