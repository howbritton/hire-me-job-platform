import React, { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, get, update } from 'firebase/database';
import { FaBuilding, FaMapMarkerAlt, FaClock, FaDollarSign, FaEye } from 'react-icons/fa';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';

const EMAIL_SERVICE_URL = 'http://34.228.74.248:3001';

const AppliedJobs = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();
  const db = getDatabase();

  const sendApplicationNotification = useCallback(async (applicationData, jobData, employerData) => {
    try {
      const response = await fetch(`${EMAIL_SERVICE_URL}/notify-application`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicationData: {
            employerEmail: employerData?.email || jobData.employerEmail,
            jobTitle: jobData.jobTitle,
            candidateName: `${auth.currentUser?.displayName || 'Candidate'}`,
            candidateEmail: auth.currentUser?.email,
            appliedAt: applicationData.appliedAt,
            answers: applicationData.answers || {},
            employmentType: jobData.employmentType,
            salary: jobData.salary,
            parish: jobData.parish
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send application notification');
      }
    } catch (error) {
      console.error('Error sending application notification:', error);
    }
  }, [auth.currentUser]);

  const fetchApplications = useCallback(async () => {
    try {
      if (!auth.currentUser) {
        toast.error('Please sign in to view your applications');
        return;
      }

      const applicationsRef = ref(db, `candidates/${auth.currentUser.uid}/applications`);
      const snapshot = await get(applicationsRef);

      if (snapshot.exists()) {
        const applicationsData = snapshot.val();
        
        const jobPromises = Object.entries(applicationsData).map(async ([id, application]) => {
          const jobsRef = ref(db, 'jobs');
          const jobsSnapshot = await get(jobsRef);
          
          let foundJob = null;
          let employerId = application.employerId;

          if (jobsSnapshot.exists()) {
            const employerJobs = jobsSnapshot.child(employerId).val();
            if (employerJobs && employerJobs[application.jobId]) {
              foundJob = employerJobs[application.jobId];

              // Fetch employer data
              const employerRef = ref(db, `employers/${employerId}/profile`);
              const employerSnapshot = await get(employerRef);
              const employerData = employerSnapshot.exists() ? employerSnapshot.val() : null;

              // Send notification for new applications
              if (!application.notificationSent) {
                await sendApplicationNotification(application, foundJob, employerData);
                // Mark notification as sent
                await update(ref(db, `candidates/${auth.currentUser.uid}/applications/${id}`), {
                  notificationSent: true
                });
              }

              // Trigger confetti if status is 'hired'
              if (application.status.toLowerCase() === 'hired') {
                triggerConfetti();
              }

              return {
                id,
                ...application,
                job: {
                  ...foundJob,
                  id: application.jobId,
                  employerId,
                  companyName: employerData?.companyName || foundJob.companyName || 'Company Name',
                  employer: employerData || null
                }
              };
            }
          }
          return null;
        });

        const resolvedApplications = await Promise.all(jobPromises);
        const validApplications = resolvedApplications
          .filter(app => app !== null)
          .sort((a, b) => b.appliedAt - a.appliedAt);

        setApplications(validApplications);
      } else {
        setApplications([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Error loading applications');
      setLoading(false);
    }
  }, [auth.currentUser, db, sendApplicationNotification]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const colors = ['#00b894', '#00cec9', '#0984e3', '#6c5ce7'];

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  const getStatusBadgeColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'reviewed':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'shortlisted':
        return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'hired':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-blue-950">Applied Jobs</h2>
      </div>
      <div className="p-6">
        {applications.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">You haven't applied to any jobs yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {applications.map((application) => (
              <div key={application.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-blue-950 mb-2">
                      {application.job.jobTitle}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-gray-600 mb-4">
                      <div className="flex items-center">
                        <FaBuilding className="mr-2" />
                        {application.job.companyName}
                      </div>
                      {application.job.parish && (
                        <div className="flex items-center">
                          <FaMapMarkerAlt className="mr-2" />
                          {application.job.parish}
                        </div>
                      )}
                      {application.job.employmentType && (
                        <div className="flex items-center">
                          <FaClock className="mr-2" />
                          {application.job.employmentType}
                        </div>
                      )}
                      {application.job.salary && (
                        <div className="flex items-center">
                          <FaDollarSign className="mr-2" />
                          {application.job.salary}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex flex-col items-start gap-2">
                        <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusBadgeColor(application.status)}`}>
                          {application.status}
                        </span>
                        {application.status.toLowerCase() === 'hired' && (
                          <span className="text-green-600 text-sm font-medium animate-pulse">
                            🎉 Congratulations on your new role!
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        Applied on {formatDate(application.appliedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0 md:ml-6 flex items-start">
                    <button
                      onClick={() => window.location.href = `/jobs/${application.job.id}`}
                      className="flex items-center justify-center px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors duration-200"
                    >
                      <FaEye className="mr-2" />
                      View Job
                    </button>
                  </div>
                </div>

                {application.job.description && (
                  <div className="mt-4 text-gray-600">
                    <p className="line-clamp-2">{application.job.description}</p>
                  </div>
                )}

                {/* Application Timeline Section */}
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <h4 className="text-lg font-semibold text-gray-700 mb-3">Application Timeline</h4>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <div className="w-24 text-gray-500">Applied:</div>
                      <div className="flex-1">{formatDate(application.appliedAt)}</div>
                    </div>
                    {application.reviewedAt && (
                      <div className="flex items-center text-sm">
                        <div className="w-24 text-gray-500">Reviewed:</div>
                        <div className="flex-1">{formatDate(application.reviewedAt)}</div>
                      </div>
                    )}
                    {application.shortlistedAt && (
                      <div className="flex items-center text-sm">
                        <div className="w-24 text-gray-500">Shortlisted:</div>
                        <div className="flex-1">{formatDate(application.shortlistedAt)}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submitted Answers Section */}
                {application.answers && Object.keys(application.answers).length > 0 && (
                  <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-700 mb-2">Your Responses</h4>
                    <div className="space-y-3">
                      {application.job.questions?.map((question) => (
                        <div key={question.id} className="text-sm">
                          <p className="font-medium text-gray-700">{question.question}</p>
                          <p className="text-gray-600 mt-1">{application.answers[question.id]}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Employer Feedback Section */}
                {application.feedback && (
                  <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-700 mb-2">Employer Feedback</h4>
                    <p className="text-gray-600">{application.feedback}</p>
                  </div>
                )}

                {/* Interview Schedule Section */}
                {application.interview && (
                  <div className="mt-4 bg-blue-50 p-4 rounded-lg">
                    <h4 className="text-lg font-semibold text-blue-900 mb-2">Interview Schedule</h4>
                    <div className="space-y-2">
                      <p className="text-blue-800">
                        Date: {formatDate(application.interview.date)}
                      </p>
                      <p className="text-blue-800">
                        Time: {new Date(application.interview.date).toLocaleTimeString()}
                      </p>
                      {application.interview.location && (
                        <p className="text-blue-800">
                          Location: {application.interview.location}
                        </p>
                      )}
                      {application.interview.notes && (
                        <p className="text-blue-700 mt-2">
                          Additional Notes: {application.interview.notes}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Application Statistics */}
      {applications.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xl font-bold text-gray-700">{applications.length}</div>
              <div className="text-sm text-gray-500">Total Applications</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xl font-bold text-yellow-700">
                {applications.filter(app => app.status.toLowerCase() === 'pending').length}
              </div>
              <div className="text-sm text-gray-500">Pending Review</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xl font-bold text-blue-700">
                {applications.filter(app => app.status.toLowerCase() === 'reviewed').length}
              </div>
              <div className="text-sm text-gray-500">Under Review</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xl font-bold text-green-700">
                {applications.filter(app => app.status.toLowerCase() === 'shortlisted').length}
              </div>
              <div className="text-sm text-gray-500">Shortlisted</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppliedJobs;