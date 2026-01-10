import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, update, remove } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { FaCalendarTimes, FaEye, FaTrash, FaSync, FaHistory } from 'react-icons/fa';

const ExpiredJobs = () => {
  const [expiredJobs, setExpiredJobs] = useState([]);
  const [activeExpiredJobs, setActiveExpiredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('expired'); // 'expired' or 'active-expired'
  
  const db = getDatabase(app);
  const auth = getAuth(app);

  // Fetch jobs from the expired-jobs collection
  const fetchExpiredJobs = useCallback(async () => {
    try {
      setLoading(true);
      const expiredJobsSnap = await get(ref(db, 'expired-jobs'));
      
      if (!expiredJobsSnap.exists()) {
        setExpiredJobs([]);
        setLoading(false);
        return;
      }
      
      const expiredJobsData = expiredJobsSnap.val();
      const expiredJobsList = [];
      
      // Iterate through all expired jobs
      Object.keys(expiredJobsData).forEach(employerId => {
        Object.entries(expiredJobsData[employerId]).forEach(([jobId, job]) => {
          const now = new Date();
          const expirationDate = job.expirationDate || job.originalExpirationDate;
          
          expiredJobsList.push({
            id: jobId,
            employerId,
            ...job,
            // Add calculated fields
            daysExpired: expirationDate ? 
              Math.floor((now - new Date(expirationDate)) / (1000 * 60 * 60 * 24)) : 
              0,
            expiredAtDate: job.expiredAt ? new Date(job.expiredAt) : null,
            expireReason: job.expireReason || 'Unknown reason'
          });
        });
      });
      
      // Sort by expiration date (most recently expired first)
      expiredJobsList.sort((a, b) => {
        const aDate = a.expiredAtDate || new Date(a.expirationDate || a.originalExpirationDate);
        const bDate = b.expiredAtDate || new Date(b.expirationDate || b.originalExpirationDate);
        return bDate - aDate;
      });
      
      setExpiredJobs(expiredJobsList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching expired jobs:', error);
      toast.error('Error loading expired jobs');
      setLoading(false);
    }
  }, [db]);

  // Fetch jobs from active jobs collection that are past expiration
  const fetchActiveExpiredJobs = useCallback(async () => {
    try {
      setLoading(true);
      const jobsSnap = await get(ref(db, 'jobs'));
      
      if (!jobsSnap.exists()) {
        setActiveExpiredJobs([]);
        setLoading(false);
        return;
      }
      
      const jobsData = jobsSnap.val();
      const now = new Date();
      const activeExpiredJobsList = [];
      
      // Iterate through all active jobs and find ones that should be expired
      Object.keys(jobsData).forEach(employerId => {
        Object.entries(jobsData[employerId]).forEach(([jobId, job]) => {
          // Check if job should be expired but is still active
          const isExpired = job.expirationDate && new Date(job.expirationDate) < now;
          const isStillActive = job.status === 'approved' || job.status === 'active';
          
          if (isExpired && isStillActive) {
            activeExpiredJobsList.push({
              id: jobId,
              employerId,
              ...job,
              // Add calculated fields
              daysExpired: Math.floor((now - new Date(job.expirationDate)) / (1000 * 60 * 60 * 24)),
              shouldBeExpired: true
            });
          }
        });
      });
      
      // Sort by expiration date (most overdue first)
      activeExpiredJobsList.sort((a, b) => {
        return new Date(a.expirationDate) - new Date(b.expirationDate);
      });
      
      setActiveExpiredJobs(activeExpiredJobsList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching active expired jobs:', error);
      toast.error('Error loading active expired jobs');
      setLoading(false);
    }
  }, [db]);
  
  // Move job from active to expired collection
  const expireActiveJob = async (employerId, jobId) => {
    try {
      const job = activeExpiredJobs.find(j => j.id === jobId && j.employerId === employerId);
      if (!job) return;

      const now = new Date();
      const expiredJob = {
        ...job,
        status: 'expired',
        expiredAt: now.toISOString(),
        expireReason: 'Manually expired by admin',
        originalExpirationDate: job.expirationDate
      };

      // Add to expired-jobs collection
      await update(ref(db, `expired-jobs/${employerId}/${jobId}`), expiredJob);
      
      // Remove from active jobs collection
      await remove(ref(db, `jobs/${employerId}/${jobId}`));
      
      toast.success('Job moved to expired successfully');
      fetchActiveExpiredJobs();
      fetchExpiredJobs();
    } catch (error) {
      console.error('Error expiring job:', error);
      toast.error('Failed to expire job');
    }
  };

  // Restore job from expired back to active
  const restoreExpiredJob = async (employerId, jobId) => {
    try {
      const job = expiredJobs.find(j => j.id === jobId && j.employerId === employerId);
      if (!job) return;

      // Create restored job (remove expired-specific fields)
      const restoredJob = { ...job };
      delete restoredJob.expiredAt;
      delete restoredJob.expireReason;
      delete restoredJob.originalExpirationDate;
      restoredJob.status = 'approved';
      restoredJob.updatedAt = new Date().toISOString();
      
      // Add back to active jobs
      await update(ref(db, `jobs/${employerId}/${jobId}`), restoredJob);
      
      // Remove from expired jobs
      await remove(ref(db, `expired-jobs/${employerId}/${jobId}`));
      
      toast.success('Job restored to active successfully');
      fetchExpiredJobs();
      fetchActiveExpiredJobs();
    } catch (error) {
      console.error('Error restoring job:', error);
      toast.error('Failed to restore job');
    }
  };
  
  // Permanently delete expired job
  const handleDeleteExpiredJob = async (employerId, jobId) => {
    if (window.confirm('Are you sure you want to permanently delete this expired job? This action cannot be undone.')) {
      try {
        await remove(ref(db, `expired-jobs/${employerId}/${jobId}`));
        toast.success('Expired job deleted permanently');
        fetchExpiredJobs();
      } catch (error) {
        console.error('Error deleting expired job:', error);
        toast.error('Failed to delete expired job');
      }
    }
  };
  
  const viewJobDetails = (job) => {
    setSelectedJob(job);
    setShowModal(true);
  };
  
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!auth.currentUser) {
        window.location.href = '/admin-login';
        return;
      }

      try {
        const adminRef = ref(db, `admins/${auth.currentUser.uid}`);
        const snapshot = await get(adminRef);
        
        if (snapshot.exists()) {
          setIsAdmin(true);
          fetchExpiredJobs();
          fetchActiveExpiredJobs();
        } else {
          toast.error('Access denied. Admin privileges required.');
          window.location.href = '/admin-login';
        }
      } catch (error) {
        console.error('Error checking admin access:', error);
        window.location.href = '/admin-login';
      }
    };

    checkAdminAccess();
  }, [auth.currentUser, db, fetchExpiredJobs, fetchActiveExpiredJobs]);

  // Auto-switch to expired tab if overdue jobs tab becomes empty
  useEffect(() => {
    if (activeTab === 'active-expired' && activeExpiredJobs.length === 0) {
      setActiveTab('expired');
    }
  }, [activeExpiredJobs.length, activeTab]);

  if (!isAdmin || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  const currentJobs = activeTab === 'expired' ? expiredJobs : activeExpiredJobs;
  const hasNoJobs = currentJobs.length === 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-950">
          Job Expiration Management
        </h2>
        <a href="/admin/dashboard" className="text-blue-600 hover:text-blue-800">
          Back to Dashboard
        </a>
      </div>

      {/* Tab Navigation - Only show if there are overdue jobs or if currently viewing overdue tab */}
      {(activeExpiredJobs.length > 0 || activeTab === 'active-expired') && (
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('expired')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'expired'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FaHistory className="inline mr-2" />
              Expired Jobs ({expiredJobs.length})
            </button>
            <button
              onClick={() => setActiveTab('active-expired')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'active-expired'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FaCalendarTimes className="inline mr-2" />
              Overdue Active Jobs ({activeExpiredJobs.length})
            </button>
          </nav>
        </div>
      )}

      {/* Single tab header when no overdue jobs */}
      {activeExpiredJobs.length === 0 && activeTab !== 'active-expired' && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
            <FaHistory className="inline mr-2" />
            Expired Jobs ({expiredJobs.length})
          </h3>
        </div>
      )}
      
      {hasNoJobs ? (
        <div className="p-8 text-center">
          <FaCalendarTimes className="text-5xl text-gray-400 mx-auto mb-4" />
          <p className="text-xl text-gray-500">
            {activeTab === 'expired' ? 'No expired jobs found' : 'No overdue active jobs found'}
          </p>
          {activeTab === 'active-expired' && (
            <p className="text-sm text-gray-400 mt-2">
              All active jobs are within their expiration dates
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job Title
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiration Info
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applications
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {activeTab === 'expired' ? 'Expire Reason' : 'Status'}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentJobs.map((job) => (
                <tr key={`${job.employerId}-${job.id}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{job.jobTitle}</div>
                    <div className="text-sm text-gray-500">{job.parish}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {job.companyName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {activeTab === 'expired' ? (
                      <div>
                        <div className="text-sm text-gray-900">
                          {job.expirationDate ? 
                            new Date(job.expirationDate).toLocaleDateString() : 
                            'No date set'}
                        </div>
                        <div className="text-sm text-red-500">
                          Expired {job.daysExpired} day{job.daysExpired !== 1 ? 's' : ''} ago
                        </div>
                        {job.expiredAt && (
                          <div className="text-xs text-gray-400">
                            Moved: {new Date(job.expiredAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm text-gray-900">
                          Expired: {new Date(job.expirationDate).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-red-600 font-medium">
                          {job.daysExpired} day{job.daysExpired !== 1 ? 's' : ''} overdue
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {job.applications ? 
                      (typeof job.applications === 'object' ? 
                        Object.keys(job.applications).length : 
                        job.applications) : 
                      0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {activeTab === 'expired' ? (
                      <div className="text-sm text-gray-600">
                        {job.expireReason || 'System expired'}
                      </div>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Overdue
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => viewJobDetails(job)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      <FaEye className="inline mr-1" /> View
                    </button>
                    
                    {activeTab === 'expired' ? (
                      <>
                        <button 
                          onClick={() => {
                            if (window.confirm('Are you sure you want to restore this job to active status?')) {
                              restoreExpiredJob(job.employerId, job.id);
                            }
                          }}
                          className="text-green-600 hover:text-green-900 mr-4"
                        >
                          <FaSync className="inline mr-1" /> Restore
                        </button>
                        <button 
                          onClick={() => handleDeleteExpiredJob(job.employerId, job.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FaTrash className="inline mr-1" /> Delete
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => {
                          if (window.confirm('Are you sure you want to move this job to expired?')) {
                            expireActiveJob(job.employerId, job.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        <FaCalendarTimes className="inline mr-1" /> Expire Now
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Job Details Modal */}
      {showModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-bold text-blue-950">
                {activeTab === 'expired' ? 'Expired Job Details' : 'Overdue Job Details'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                &times;
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold mb-2">{selectedJob.jobTitle}</h4>
                  <p className="text-gray-600 mb-4">{selectedJob.companyName}</p>
                  
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700">Location</h5>
                    <p>{selectedJob.parish}</p>
                  </div>
                  
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700">Work Type</h5>
                    <p>{selectedJob.workType || 'Not specified'}</p>
                  </div>
                  
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700">Employment Type</h5>
                    <p>{selectedJob.employmentType}</p>
                  </div>
                  
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700">Salary</h5>
                    <p>{selectedJob.salary || 'Not specified'}</p>
                  </div>
                  
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700">Experience Required</h5>
                    <p>{selectedJob.experience || 'Not specified'}</p>
                  </div>
                  
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700">Education Required</h5>
                    <p>{selectedJob.degreeLevel || 'Not specified'}</p>
                  </div>
                </div>
                
                <div>
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700">Applications</h5>
                    <p>{selectedJob.applications ? 
                       (typeof selectedJob.applications === 'object' ? 
                         Object.keys(selectedJob.applications).length : 
                         selectedJob.applications) : 
                       0}</p>
                  </div>
                  
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700">Created At</h5>
                    <p>{new Date(selectedJob.createdAt).toLocaleString()}</p>
                  </div>
                  
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700">Expiration Date</h5>
                    <p className="text-red-500">
                      {selectedJob.expirationDate ? 
                        `${new Date(selectedJob.expirationDate).toLocaleString()} (${selectedJob.daysExpired} days ago)` : 
                        'No expiration date set'}
                    </p>
                  </div>

                  {activeTab === 'expired' && (
                    <>
                      <div className="mb-4">
                        <h5 className="font-medium text-gray-700">Expired At</h5>
                        <p>{selectedJob.expiredAt ? 
                            new Date(selectedJob.expiredAt).toLocaleString() : 
                            'Not recorded'}</p>
                      </div>
                      
                      <div className="mb-4">
                        <h5 className="font-medium text-gray-700">Expire Reason</h5>
                        <p>{selectedJob.expireReason || 'Not specified'}</p>
                      </div>
                    </>
                  )}
                  
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700">Current Status</h5>
                    <p className={activeTab === 'expired' ? 'text-red-600' : 'text-yellow-600'}>
                      {activeTab === 'expired' ? 'Expired' : 'Active but Overdue'}
                    </p>
                  </div>
                  
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700">Contact Email</h5>
                    <p>{selectedJob.contactEmail || selectedJob.applicationEmail || 'Not specified'}</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <h5 className="font-medium text-gray-700 mb-2">Job Description</h5>
                <div className="border p-4 rounded-lg bg-gray-50 whitespace-pre-line">
                  {selectedJob.description || 'No description provided'}
                </div>
              </div>
              
              <div className="mt-6 flex gap-4 justify-end">
                {activeTab === 'expired' ? (
                  <>
                    <button 
                      onClick={() => {
                        setShowModal(false);
                        if (window.confirm('Are you sure you want to restore this job to active status?')) {
                          restoreExpiredJob(selectedJob.employerId, selectedJob.id);
                        }
                      }}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      <FaSync className="inline mr-2" /> Restore to Active
                    </button>
                    <button 
                      onClick={() => {
                        setShowModal(false);
                        handleDeleteExpiredJob(selectedJob.employerId, selectedJob.id);
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      <FaTrash className="inline mr-2" /> Delete Permanently
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => {
                      setShowModal(false);
                      if (window.confirm('Are you sure you want to move this job to expired?')) {
                        expireActiveJob(selectedJob.employerId, selectedJob.id);
                      }
                    }}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    <FaCalendarTimes className="inline mr-2" /> Expire Now
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

export default ExpiredJobs;