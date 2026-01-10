import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, set, remove } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { 
  ChevronDown, 
  ChevronUp, 
  X, 
  Search,
  Building2,
  MapPin,
  Mail,
  Globe,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Calendar,
  User
} from 'lucide-react';
import { toast } from 'react-toastify';
import { app } from '../../firebase';

const ApproveJobs = () => {
  const [pendingJobs, setPendingJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const db = getDatabase(app);
  const auth = getAuth(app);
  const functions = getFunctions(app);
  
  // Initialize the notification functions
  const notifyJobApproval = httpsCallable(functions, 'notifyJobApproval');
  const notifyJobRejection = httpsCallable(functions, 'notifyJobRejection');

  const fetchPendingJobs = useCallback(async () => {
    try {
      const pendingJobsRef = ref(db, 'pending-jobs');
      const snapshot = await get(pendingJobsRef);
      
      if (snapshot.exists()) {
        const jobs = [];
        Object.entries(snapshot.val()).forEach(([employerId, employerJobs]) => {
          Object.entries(employerJobs).forEach(([jobId, job]) => {
            jobs.push({
              id: jobId,
              employerId,
              ...job
            });
          });
        });
        setPendingJobs(jobs);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pending jobs:', error);
      toast.error('Error loading pending jobs');
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    const checkAdminAndFetchJobs = async () => {
      if (!auth.currentUser) return;
      
      try {
        const adminRef = ref(db, `admins/${auth.currentUser.uid}`);
        const adminSnapshot = await get(adminRef);
        
        if (!adminSnapshot.exists()) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }
        
        setIsAdmin(true);
        await fetchPendingJobs();
      } catch (error) {
        console.error('Error checking admin status:', error);
        toast.error('Error verifying admin access');
        setLoading(false);
      }
    };

    checkAdminAndFetchJobs();
  }, [auth.currentUser, db, fetchPendingJobs]);

  // Replace the handleJobAction function in your ApproveJobs.js file with this fixed version:

const handleJobAction = async (job, approved) => {
  try {
    if (approved) {
      const approvalDate = new Date();
      
      // Get employer subscription to calculate expiration date
      const employerRef = ref(db, `employers/${job.employerId}`);
      const employerSnapshot = await get(employerRef);
      const employer = employerSnapshot.exists() ? employerSnapshot.val() : null;
      const subscription = employer?.subscription;
      
      // Calculate expiration date based on approval time + package duration
      let expirationDate;
      
      if (subscription?.package?.duration) {
        // Use package duration from APPROVAL date (not creation date)
        const expiration = new Date(approvalDate);
        expiration.setDate(approvalDate.getDate() + subscription.package.duration);
        expirationDate = expiration.toISOString();
        console.log(`[Admin] Setting expiration based on package duration: ${subscription.package.duration} days from approval`);
      } else if (subscription?.endDate) {
        // Use subscription end date as fallback
        expirationDate = subscription.endDate;
        console.log(`[Admin] Setting expiration based on subscription end date`);
      } else {
        // Default: 30 days from approval
        const expiration = new Date(approvalDate);
        expiration.setDate(approvalDate.getDate() + 30);
        expirationDate = expiration.toISOString();
        console.log(`[Admin] Setting default expiration: 30 days from approval`);
      }
      
      // Create the job object with approval metadata AND expiration date
      const approvedJob = {
        ...job,
        status: 'approved',
        approvedAt: approvalDate.toISOString(),
        expirationDate: expirationDate, // 🔑 THIS IS THE KEY FIX
        approvedBy: auth.currentUser.uid,
        // Add metadata for debugging
        expirationCalculatedFrom: subscription?.package?.duration ? 'package_duration' : 
                                 subscription?.endDate ? 'subscription_end_date' : 'default_30_days',
        packageDuration: subscription?.package?.duration || null
      };
      
      console.log(`[Admin] Approving job: ${job.jobTitle}`);
      console.log(`[Admin] Approval date: ${approvalDate.toISOString()}`);
      console.log(`[Admin] Expiration date: ${expirationDate}`);
      console.log(`[Admin] Days until expiration: ${Math.ceil((new Date(expirationDate) - approvalDate) / (1000 * 60 * 60 * 24))}`);
      
      // Save the approved job to the jobs collection
      const approvedJobRef = ref(db, `jobs/${job.employerId}/${job.id}`);
      await set(approvedJobRef, approvedJob);
      
      // Send notification to the employer
      try {
        await notifyJobApproval(approvedJob);
        console.log('Job approval notification sent successfully');
      } catch (notificationError) {
        console.error('Error sending job approval notification:', notificationError);
        // Don't block the approval process if notification fails
        toast.warning('Job approved but notification email may not have been sent');
      }
    } else {
      // Create the job object with rejection metadata
      const rejectedJob = {
        ...job,
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: auth.currentUser.uid
      };
      
      // Save the rejected job to the rejected-jobs collection
      const rejectedJobRef = ref(db, `rejected-jobs/${job.employerId}/${job.id}`);
      await set(rejectedJobRef, rejectedJob);
      
      // Send rejection notification to the employer
      try {
        await notifyJobRejection(rejectedJob);
        console.log('Job rejection notification sent successfully');
      } catch (notificationError) {
        console.error('Error sending job rejection notification:', notificationError);
        // Don't block the rejection process if notification fails
        toast.warning('Job rejected but notification email may not have been sent');
      }
    }

    // Remove the job from pending-jobs collection
    const pendingJobRef = ref(db, `pending-jobs/${job.employerId}/${job.id}`);
    await remove(pendingJobRef);
    setPendingJobs(prev => prev.filter(j => j.id !== job.id));
    
    if (showModal && selectedJob?.id === job.id) {
      setShowModal(false);
      setSelectedJob(null);
    }
    
    toast.success(approved ? 'Job approved successfully' : 'Job rejected successfully');
  } catch (error) {
    console.error('Error processing job:', error);
    if (error.message.includes('permission_denied')) {
      toast.error('You do not have permission to perform this action');
    } else {
      toast.error('Error processing job action');
    }
  }
};

  const toggleJobExpansion = (jobId) => {
    setExpandedJobs(prev => ({
      ...prev,
      [jobId]: !prev[jobId]
    }));
  };

  const filteredJobs = pendingJobs.filter(job => {
    const searchLower = searchTerm.toLowerCase();
    return (
      job.jobTitle?.toLowerCase().includes(searchLower) ||
      job.companyName?.toLowerCase().includes(searchLower) ||
      job.description?.toLowerCase().includes(searchLower) ||
      job.parish?.toLowerCase().includes(searchLower) ||
      job.industry?.toLowerCase().includes(searchLower)
    );
  });

  const JobModal = ({ job }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold text-blue-950">Job Details</h2>
          <button 
            onClick={() => setShowModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6">
          {/* Header Section */}
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-blue-950 mb-2">{job.jobTitle}</h3>
            <div className="flex items-center text-gray-600 mb-2">
              <Building2 className="h-4 w-4 mr-2" />
              {job.companyName}
            </div>
            <div className="flex items-center text-gray-600">
              <MapPin className="h-4 w-4 mr-2" />
              {job.parish}
            </div>
          </div>

          {/* Tags Section */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800">
              {job.employmentType}
            </span>
            <span className="px-3 py-1 text-sm rounded-full bg-purple-100 text-purple-800">
              {job.industry}
            </span>
            <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-800">
              {job.experience}
            </span>
            {job.salary && (
              <span className="px-3 py-1 text-sm rounded-full bg-yellow-100 text-yellow-800">
                {job.salary}
              </span>
            )}
          </div>

          {/* Description Section */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-2">Job Description</h4>
            <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
          </div>

          {/* Requirements Section */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-2">Requirements</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium">Education Level</p>
                <p className="text-gray-700">{job.degreeLevel}</p>
              </div>
              <div>
                <p className="font-medium">Experience Required</p>
                <p className="text-gray-700">{job.experience}</p>
              </div>
            </div>
            {job.otherRequirements && (
              <div className="mt-4">
                <p className="font-medium">Additional Requirements</p>
                <p className="text-gray-700">{job.otherRequirements}</p>
              </div>
            )}
          </div>

          {/* Work Experience Section */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-2">Work Experience</h4>
            <p className="text-gray-700">{job.experience}</p>
          </div>

          {/* Contact Information */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-4">Contact Information</h4>
            <div className="space-y-2">
              {job.applicationEmail && (
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-gray-500" />
                  <a href={`mailto:${job.applicationEmail}`} className="text-blue-600 hover:text-blue-800">
                    {job.applicationEmail}
                  </a>
                </div>
              )}
              {job.website && (
                <div className="flex items-center">
                  <Globe className="h-4 w-4 mr-2 text-gray-500" />
                  <a href={job.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                    Company Website
                  </a>
                </div>
              )}
              {job.contactName && (
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-gray-700">{job.contactName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Social Media Links */}
          {(job.socialMedia?.facebook || job.socialMedia?.twitter || job.socialMedia?.linkedin || job.socialMedia?.instagram) && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-4">Social Media</h4>
              <div className="flex space-x-4">
                {job.socialMedia?.facebook && (
                  <a href={job.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                    <Facebook className="h-6 w-6" />
                  </a>
                )}
                {job.socialMedia?.twitter && (
                  <a href={job.socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600">
                    <Twitter className="h-6 w-6" />
                  </a>
                )}
                {job.socialMedia?.linkedin && (
                  <a href={job.socialMedia.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-900">
                    <Linkedin className="h-6 w-6" />
                  </a>
                )}
                {job.socialMedia?.instagram && (
                  <a href={job.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-800">
                    <Instagram className="h-6 w-6" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Posted Date */}
          <div className="mb-6">
            <div className="flex items-center text-gray-600">
              <Calendar className="h-4 w-4 mr-2" />
              Posted on: {new Date(job.createdAt).toLocaleDateString()}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 mt-8">
            <button
              onClick={() => handleJobAction(job, false)}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Reject Job
            </button>
            <button
              onClick={() => handleJobAction(job, true)}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Approve Job
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="flex justify-center items-center h-96">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <p className="text-red-600 text-lg font-semibold mb-2">Access Denied</p>
          <p className="text-gray-600">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-blue-950">Pending Jobs for Approval</h1>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      
      {filteredJobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-600">
            {searchTerm ? 'No jobs match your search criteria' : 'No pending jobs to approve'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-blue-950">
                      {job.jobTitle}
                    </h2>
                    <div className="text-sm text-gray-600 mt-1">
                      {job.companyName} • {job.parish}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedJob(job);
                        setShowModal(true);
                      }}
                      className="px-4 py-2 border border-blue-950 text-blue-950 rounded-md hover:bg-blue-950 hover:text-white transition-colors"
                    >
                      View Full Details
                    </button>
                    <button
                      onClick={() => handleJobAction(job, false)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleJobAction(job, true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="px-2 py-1 text-sm rounded-full bg-blue-100 text-blue-800">
                    {job.employmentType}
                  </span>
                  <span className="px-2 py-1 text-sm rounded-full bg-purple-100 text-purple-800">
                    {job.industry}
                  </span>
                  <span className="px-2 py-1 text-sm rounded-full bg-green-100 text-green-800">
                    {job.experience}
                  </span>
                </div>

                <div className="relative">
                  <div className={`prose max-w-none ${!expandedJobs[job.id] ? 'max-h-24 overflow-hidden' : ''}`}>
                    <p className="text-gray-700">{job.description}</p>
                  </div>
                  
                  <button
                    onClick={() => toggleJobExpansion(job.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center mt-2"
                  >
                    {expandedJobs[job.id] ? (
                      <>Show Less <ChevronUp className="ml-1 h-4 w-4" /></>
                    ) : (
                      <>Show More <ChevronDown className="ml-1 h-4 w-4" /></>
                    )}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold">Required Education:</p>
                    <p className="text-gray-600">{job.degreeLevel}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Salary:</p>
                    <p className="text-gray-600">{job.salary || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Contact:</p>
                    <p className="text-gray-600">{job.applicationEmail}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Posted:</p>
                    <p className="text-gray-600">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Job Details Modal */}
      {showModal && selectedJob && <JobModal job={selectedJob} />}
    </div>
  );
};

export default ApproveJobs;