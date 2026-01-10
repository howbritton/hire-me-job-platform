import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, set, remove } from 'firebase/database';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { FaCheck, FaTimes, FaEye } from 'react-icons/fa';

const ApprovedJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('pending');

  const db = getDatabase(app);

  const fetchJobs = useCallback(async () => {
    try {
      const pendingJobsRef = ref(db, 'pending-jobs');
      const snapshot = await get(pendingJobsRef);

      if (snapshot.exists()) {
        const jobsArray = await Promise.all(
          Object.entries(snapshot.val()).flatMap(([employerId, employerJobs]) =>
            Object.entries(employerJobs).map(async ([jobId, jobData]) => {
              // Fetch employer details
              const employerRef = ref(db, `employers/${employerId}/profile`);
              const employerSnapshot = await get(employerRef);
              return {
                id: jobId,
                employerId,
                ...jobData,
                employer: employerSnapshot.exists() ? employerSnapshot.val() : null
              };
            })
          )
        );
        setJobs(jobsArray);
      } else {
        setJobs([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Error loading jobs');
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleUpdateStatus = async (jobId, employerId, status) => {
    try {
      const jobData = jobs.find(job => job.id === jobId);
      if (!jobData) return;

      if (status === 'approved') {
        // Move to approved jobs collection
        const approvedJobRef = ref(db, `jobs/${employerId}/${jobId}`);
        await set(approvedJobRef, {
          ...jobData,
          status: 'approved',
          approvedAt: new Date().toISOString()
        });
      } else if (status === 'rejected') {
        // Move to rejected jobs collection
        const rejectedJobRef = ref(db, `rejected-jobs/${employerId}/${jobId}`);
        await set(rejectedJobRef, {
          ...jobData,
          status: 'rejected',
          rejectedAt: new Date().toISOString()
        });
      }

      // Remove from pending jobs
      const pendingJobRef = ref(db, `pending-jobs/${employerId}/${jobId}`);
      await remove(pendingJobRef);

      toast.success(`Job ${status} successfully`);
      setIsModalOpen(false);
      fetchJobs();
    } catch (error) {
      console.error('Error updating job status:', error);
      toast.error('Error updating job status');
    }
  };

  const handleViewDetails = (job) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const filteredJobs = jobs.filter(job => {
    switch (filter) {
      case 'pending':
        return !job.status || job.status === 'pending';
      case 'approved':
        return job.status === 'approved';
      case 'rejected':
        return job.status === 'rejected';
      default:
        return true;
    }
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-950">Job Approvals</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-md ${
              filter === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-md ${
              filter === 'approved'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-4 py-2 rounded-md ${
              filter === 'rejected'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Rejected
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Job Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Posted Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredJobs.map((job) => (
              <tr key={job.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{job.jobTitle}</div>
                  <div className="text-sm text-gray-500">{job.employmentType}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {job.employer?.companyName || job.companyName || 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    !job.status || job.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : job.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1) : 'Pending'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleViewDetails(job)}
                    className="text-blue-950 hover:text-[#cddd3a]"
                  >
                    <FaEye className="h-5 w-5" />
                  </button>
                  {(!job.status || job.status === 'pending') && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(job.id, job.employerId, 'approved')}
                        className="text-green-600 hover:text-green-900"
                      >
                        <FaCheck className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(job.id, job.employerId, 'rejected')}
                        className="text-red-600 hover:text-red-900"
                      >
                        <FaTimes className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredJobs.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No jobs found</p>
          </div>
        )}
      </div>

      {/* Job Details Modal */}
      {isModalOpen && selectedJob && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Job Details
                    </h3>
                    <div className="border-t border-gray-200 py-3">
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-4">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Job Title</dt>
                          <dd className="mt-1 text-sm text-gray-900">{selectedJob.jobTitle}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Company</dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {selectedJob.employer?.companyName || selectedJob.companyName || 'N/A'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Location</dt>
                          <dd className="mt-1 text-sm text-gray-900">{selectedJob.parish}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Type</dt>
                          <dd className="mt-1 text-sm text-gray-900">{selectedJob.employmentType}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Industry</dt>
                          <dd className="mt-1 text-sm text-gray-900">{selectedJob.industry}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Experience Required</dt>
                          <dd className="mt-1 text-sm text-gray-900">{selectedJob.experience}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Salary</dt>
                          <dd className="mt-1 text-sm text-gray-900">{selectedJob.salary || 'Not specified'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Description</dt>
                          <dd className="mt-1 text-sm text-gray-900">{selectedJob.description}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Other Requirements</dt>
                          <dd className="mt-1 text-sm text-gray-900">{selectedJob.otherRequirements || 'None'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Contact Information</dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            <p>Email: {selectedJob.applicationEmail}</p>
                            {selectedJob.contactName && <p>Contact: {selectedJob.contactName}</p>}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                {(!selectedJob.status || selectedJob.status === 'pending') && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(selectedJob.id, selectedJob.employerId, 'approved')}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(selectedJob.id, selectedJob.employerId, 'rejected')}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Reject
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovedJobs;