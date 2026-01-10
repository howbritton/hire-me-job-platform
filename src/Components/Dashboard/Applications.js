import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, update } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { Link } from 'react-router-dom';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { FaSearch, FaEye, FaDownload, FaBriefcase, FaCalendar, FaUserAlt, FaClock, FaDollarSign, FaMapMarkerAlt } from 'react-icons/fa';

const EMAIL_SERVICE_URL = 'http://34.228.74.248:3001';

const Applications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedJob, setSelectedJob] = useState('all');
  const [jobs, setJobs] = useState([]);
  const [viewingApplication, setViewingApplication] = useState(null);

  const auth = getAuth(app);
  const db = getDatabase(app);

  const sendStatusUpdateNotification = async (candidateEmail, jobTitle, companyName, status) => {
    try {
      const response = await fetch(`${EMAIL_SERVICE_URL}/notify-status-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statusData: {
            candidateEmail,
            jobTitle,
            companyName,
            status,
            updatedAt: Date.now()
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send status update notification');
      }
    } catch (error) {
      console.error('Error sending status notification:', error);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      // Fetch employer's jobs
      const jobsRef = ref(db, `jobs/${auth.currentUser.uid}`);
      const jobsSnapshot = await get(jobsRef);
      
      if (!jobsSnapshot.exists()) {
        setLoading(false);
        return;
      }

      const jobsData = Object.entries(jobsSnapshot.val()).map(([id, data]) => ({
        id,
        ...data,
        title: data.jobTitle
      }));
      setJobs(jobsData);

      // Fetch applications for each job
      const allApplications = [];
      
      for (const job of jobsData) {
        if (job.applications) {
          const applicationEntries = Object.entries(job.applications);
          
          // Fetch candidate details for each application
          const jobApplications = await Promise.all(
            applicationEntries.map(async ([candidateId, application]) => {
              const candidateRef = ref(db, `candidates/${candidateId}`);
              const candidateSnapshot = await get(candidateRef);
              
              if (candidateSnapshot.exists()) {
                const candidateData = candidateSnapshot.val();
                
                // Check if status changed and notification needed
                if (application.statusChanged && !application.statusNotificationSent) {
                  await sendStatusUpdateNotification(
                    candidateData.email,
                    job.jobTitle,
                    job.companyName || 'Company Name',
                    application.status
                  );
                  
                  // Mark notification as sent
                  const notificationRef = ref(db, `jobs/${auth.currentUser.uid}/${job.id}/applications/${candidateId}/statusNotificationSent`);
                  await update(notificationRef, true);
                }
                
                return {
                  id: `${job.id}-${candidateId}`,
                  jobId: job.id,
                  jobTitle: job.jobTitle,
                  employmentType: job.employmentType,
                  salary: job.salary,
                  parish: job.parish,
                  candidateId,
                  candidate: {
                    firstName: candidateData.firstName || '',
                    lastName: candidateData.lastName || '',
                    email: candidateData.email || '',
                    phone: candidateData.phone || '',
                    profile: candidateData.profile || {}
                  },
                  ...application
                };
              }
              return null;
            })
          );
          
          allApplications.push(...jobApplications.filter(Boolean));
        }
      }

      setApplications(allApplications.sort((a, b) => b.appliedAt - a.appliedAt));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading applications');
      setLoading(false);
    }
  }, [auth.currentUser?.uid, db]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateApplicationStatus = async (jobId, candidateId, newStatus) => {
    try {
      // Update in candidate's applications
      const candidateAppRef = ref(db, `candidates/${candidateId}/applications/${jobId}`);
      await update(candidateAppRef, {
        status: newStatus,
        updatedAt: Date.now(),
        statusChanged: true
      });

      // Update in employer's job applications
      const jobAppRef = ref(db, `jobs/${auth.currentUser.uid}/${jobId}/applications/${candidateId}`);
      await update(jobAppRef, {
        status: newStatus,
        updatedAt: Date.now(),
        statusChanged: true,
        statusNotificationSent: false
      });

      // Get job and candidate details for notification
      const jobSnapshot = await get(ref(db, `jobs/${auth.currentUser.uid}/${jobId}`));
      const candidateSnapshot = await get(ref(db, `candidates/${candidateId}`));
      
      if (jobSnapshot.exists() && candidateSnapshot.exists()) {
        const jobData = jobSnapshot.val();
        const candidateData = candidateSnapshot.val();
        
        await sendStatusUpdateNotification(
          candidateData.email,
          jobData.jobTitle,
          jobData.companyName || 'Company Name',
          newStatus
        );
        
        // Mark notification as sent
        await update(jobAppRef, {
          statusNotificationSent: true
        });
      }
      
      // Update local state
      setApplications(prevApplications => 
        prevApplications.map(app => 
          app.candidateId === candidateId && app.jobId === jobId
            ? { ...app, status: newStatus, updatedAt: Date.now() }
            : app
        )
      );
      
      toast.success('Application status updated');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'reviewed':
        return 'bg-blue-100 text-blue-800';
      case 'shortlisted':
        return 'bg-green-100 text-green-800';
      case 'hired':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredApplications = applications.filter(app => {
    const matchesSearch = 
      app.candidate?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.candidate?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.jobTitle.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
    const matchesJob = selectedJob === 'all' || app.jobId === selectedJob;

    return matchesSearch && matchesStatus && matchesJob;
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-blue-950 mb-4">Applications</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or job..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="hired">Hired</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Jobs</option>
            {jobs.map(job => (
              <option key={job.id} value={job.id}>{job.jobTitle}</option>
            ))}
          </select>
        </div>

        <div className="space-y-6">
          {filteredApplications.map((application) => (
            <div 
              key={`${application.jobId}-${application.candidateId}`}
              className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex flex-col md:flex-row justify-between">
                <div className="flex-1">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-semibold text-blue-950">
                        {application.candidate.firstName} {application.candidate.lastName}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(application.status)}`}>
                        {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                      </span>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <h4 className="font-medium text-lg text-blue-950 mb-2">Job Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center text-gray-600">
                          <FaBriefcase className="mr-2 text-blue-950" />
                          Position: {application.jobTitle}
                        </div>
                        <div className="flex items-center text-gray-600">
                          <FaClock className="mr-2 text-blue-950" />
                          Type: {application.employmentType}
                        </div>
                        <div className="flex items-center text-gray-600">
                          <FaDollarSign className="mr-2 text-blue-950" />
                          Salary: {application.salary}
                        </div>
                        <div className="flex items-center text-gray-600">
                          <FaMapMarkerAlt className="mr-2 text-blue-950" />
                          Location: {application.parish}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <FaUserAlt className="mr-2" />
                        {application.candidate.email}
                      </div>
                      <div className="flex items-center">
                        <FaCalendar className="mr-2" />
                        Applied {new Date(application.appliedAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Display application answers if they exist */}
                    {application.answers && Object.keys(application.answers).length > 0 && (
                      <div className="mt-4 bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2">Application Responses</h4>
                        {Object.entries(application.answers).map(([questionId, answer], index) => (
                          <div key={questionId} className="mb-2 last:mb-0">
                            <p className="text-sm text-blue-800">Question {index + 1}: {answer}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <select
                      value={application.status}
                      onChange={(e) => updateApplicationStatus(
                        application.jobId,
                        application.candidateId,
                        e.target.value
                      )}
                      className="px-4 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="shortlisted">Shortlisted</option>
                      <option value="hired">Hired</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 md:mt-0 flex items-start space-x-4">
                  <Link
                    to={`/employer/resumes/${application.candidateId}`}
                    className="flex items-center justify-center px-4 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    <FaEye className="mr-2" />
                    View Profile
                  </Link>
                  {application.candidate.profile.resume && (
                    <a
                      href={application.candidate.profile.resume.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center px-4 py-2 bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors"
                    >
                      <FaDownload className="mr-2" />
                      Resume
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredApplications.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No applications found matching your criteria</p>
            </div>
          )}
        </div>
      </div>

      {viewingApplication && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
              <div className="p-6">
                <h3 className="text-xl font-bold text-blue-950 mb-4">
                  Application Details
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-2">Candidate Information</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700">
                        <span className="font-medium">Name:</span> {viewingApplication.candidate.firstName} {viewingApplication.candidate.lastName}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium">Email:</span> {viewingApplication.candidate.email}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium">Phone:</span> {viewingApplication.candidate.phone}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Job Information</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700"><span className="font-medium">Position:</span> {viewingApplication.jobTitle}</p>
                      <p className="text-gray-700"><span className="font-medium">Type:</span> {viewingApplication.employmentType}</p>
                      <p className="text-gray-700"><span className="font-medium">Salary:</span> {viewingApplication.salary}</p>
                      <p className="text-gray-700"><span className="font-medium">Location:</span> {viewingApplication.parish}</p>
                      <p className="text-gray-700">
                        <span className="font-medium">Applied:</span> {new Date(viewingApplication.appliedAt).toLocaleDateString()}
                      </p>
                      <p className="text-gray-700"><span className="font-medium">Status:</span> {viewingApplication.status}</p>
                    </div>
                  </div>

                  {/* Application Responses Section */}
                  {viewingApplication.answers && Object.keys(viewingApplication.answers).length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Application Responses</h4>
                      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                        {Object.entries(viewingApplication.answers).map(([questionId, answer], index) => (
                          <div key={questionId}>
                            <p className="text-gray-700 font-medium">Question {index + 1}:</p>
                            <p className="text-gray-600 mt-1">{answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {viewingApplication.candidate.profile.aboutMe && (
                    <div>
                      <h4 className="font-semibold mb-2">Profile Summary</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-gray-700">{viewingApplication.candidate.profile.aboutMe}</p>
                      </div>
                    </div>
                  )}

                  {viewingApplication.candidate.profile.skills && (
                    <div>
                      <h4 className="font-semibold mb-2">Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {viewingApplication.candidate.profile.skills.map((skill, index) => (
                          <span
                            key={index}
                            className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Experience Section */}
                  {viewingApplication.candidate.profile.experience && viewingApplication.candidate.profile.experience.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Work Experience</h4>
                      <div className="space-y-4">
                        {viewingApplication.candidate.profile.experience.map((exp, index) => (
                          <div key={index} className="bg-gray-50 p-4 rounded-lg">
                            <p className="font-medium text-gray-800">{exp.title}</p>
                            <p className="text-gray-600">{exp.company}</p>
                            <p className="text-sm text-gray-500">
                              {exp.startDate} - {exp.endDate || 'Present'}
                            </p>
                            {exp.description && (
                              <p className="mt-2 text-gray-700">{exp.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education Section */}
                  {viewingApplication.candidate.profile.education && viewingApplication.candidate.profile.education.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Education</h4>
                      <div className="space-y-4">
                        {viewingApplication.candidate.profile.education.map((edu, index) => (
                          <div key={index} className="bg-gray-50 p-4 rounded-lg">
                            <p className="font-medium text-gray-800">{edu.degree}</p>
                            <p className="text-gray-600">{edu.institution}</p>
                            <p className="text-sm text-gray-500">
                              {edu.startDate} - {edu.endDate || 'Present'}
                            </p>
                            {edu.description && (
                              <p className="mt-2 text-gray-700">{edu.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end space-x-4">
                  <Link
                    to={`/employer/resumes/${viewingApplication.candidateId}`}
                    className="px-4 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    <FaEye className="inline-block mr-2" />
                    View Full Profile
                  </Link>
                  {viewingApplication.candidate.profile.resume && (
                    <a
                      href={viewingApplication.candidate.profile.resume.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors"
                    >
                      <FaDownload className="inline-block mr-2" />
                      Download Resume
                    </a>
                  )}
                  <button
                    onClick={() => setViewingApplication(null)}
                    className="px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Applications;