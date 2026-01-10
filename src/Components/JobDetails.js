import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDatabase, ref, get, set } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { toast } from 'react-toastify';
import { 
  FaBuilding, 
  FaMapMarkerAlt, 
  FaClock, 
  FaDollarSign, 
  FaHeart, 
  FaBriefcase, 
  FaGraduationCap, 
  FaCalendarAlt,
  FaEnvelope,
  FaPhone,
  FaGlobe,
  FaIndustry,
  FaQuestionCircle,
  FaLaptopHouse
} from 'react-icons/fa';
// Import Firebase functions
import { getFunctions, httpsCallable } from 'firebase/functions';

const JobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [answers, setAnswers] = useState({});
  const [isCandidate, setIsCandidate] = useState(false);
  const [candidateData, setCandidateData] = useState(null);
  const auth = getAuth();
  const db = getDatabase();
  const functions = getFunctions();

  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        // First, find which employer has this job
        const jobsRef = ref(db, 'jobs');
        const jobsSnapshot = await get(jobsRef);
        
        let foundJob = null;
        let employerId = null;

        if (jobsSnapshot.exists()) {
          // Search through each employer's jobs
          jobsSnapshot.forEach((employerSnapshot) => {
            const employerJobs = employerSnapshot.val();
            if (employerJobs[id]) {
              foundJob = employerJobs[id];
              employerId = employerSnapshot.key;
            }
          });
        }

        if (foundJob) {
          // Fetch employer details
          const employerRef = ref(db, `employers/${employerId}/profile`);
          const employerSnapshot = await get(employerRef);
          const employerData = employerSnapshot.exists() ? employerSnapshot.val() : null;

          // Combine job and employer data
          const fullJobData = {
            ...foundJob,
            id,
            employerId,
            companyName: employerData?.companyName || foundJob.companyName || 'Company Name',
            employer: employerData || null
          };

          setJob(fullJobData);

          // Initialize answers state based on questions
          if (fullJobData.questions) {
            const initialAnswers = {};
            fullJobData.questions.forEach(q => {
              initialAnswers[q.id] = q.type === 'multiple_choice' ? '' : '';
            });
            setAnswers(initialAnswers);
          }

          // Check user status if logged in
          if (auth.currentUser) {
            const userId = auth.currentUser.uid;

            // Check if user is a candidate
            const candidateRef = ref(db, `candidates/${userId}`);
            const candidateSnapshot = await get(candidateRef);
            
            if (candidateSnapshot.exists()) {
              setIsCandidate(true);
              setCandidateData(candidateSnapshot.val());
            }

            // Check application and favorite status
            const [favSnapshot, appSnapshot] = await Promise.all([
              get(ref(db, `candidates/${userId}/favorites/${id}`)),
              get(ref(db, `candidates/${userId}/applications/${id}`))
            ]);
            
            setIsFavorite(favSnapshot.exists());
            setHasApplied(appSnapshot.exists());
          }
        } else {
          setError('Job not found');
        }
      } catch (err) {
        console.error('Error fetching job details:', err);
        setError('Failed to load job details');
      } finally {
        setLoading(false);
      }
    };

    fetchJobDetails();
  }, [id, db, auth.currentUser]);

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const validateAnswers = () => {
    if (!job.questions) return true;
    
    for (const question of job.questions) {
      if (question.required && (!answers[question.id] || answers[question.id].trim() === '')) {
        toast.error(`Please answer the required question: ${question.question}`);
        return false;
      }
    }
    return true;
  };

  const handleApply = async () => {
    if (!auth.currentUser) {
      toast.info('Please sign in to apply for this job');
      navigate('/candidate-sign-in');
      return;
    }

    try {
      // Check if user is an employer
      const employerRef = ref(db, `employers/${auth.currentUser.uid}`);
      const employerSnapshot = await get(employerRef);
      
      if (employerSnapshot.exists()) {
        toast.error('Employers cannot apply for jobs. Please use a candidate account.');
        return;
      }

      // Verify user is a candidate
      if (!isCandidate) {
        toast.error('Only candidates can apply for jobs. Please register as a candidate.');
        navigate("/candidate-register");
        return;
      }

      if (hasApplied) {
        toast.info('You have already applied for this job');
        return;
      }

      if (job.questions && job.questions.length > 0) {
        setIsApplyModalOpen(true);
        return;
      }

      await submitApplication();
    } catch (error) {
      console.error('Error checking user type:', error);
      toast.error('Failed to submit application. Please try again.');
    }
  };

  const submitApplication = async () => {
    if (job.questions && job.questions.length > 0 && !validateAnswers()) {
      return;
    }

    try {
      // Double check employer status before submitting
      const employerRef = ref(db, `employers/${auth.currentUser.uid}`);
      const employerSnapshot = await get(employerRef);
      
      if (employerSnapshot.exists()) {
        toast.error('Employers cannot apply for jobs. Please use a candidate account.');
        return;
      }

      // Double check candidate status
      if (!isCandidate) {
        toast.error('Only candidates can apply for jobs. Please register as a candidate.');
        navigate("/candidate-register");
        return;
      }

      const userId = auth.currentUser.uid;
      const applicationRef = ref(db, `candidates/${userId}/applications/${id}`);
      
      const applicationData = {
        jobId: id,
        employerId: job.employerId,
        status: 'pending',
        appliedAt: Date.now(),
        jobTitle: job.jobTitle,
        companyName: job.companyName
      };

      if (job.questions && job.questions.length > 0) {
        applicationData.answers = answers;
      }

      await set(applicationRef, applicationData);

      const applicationId = `app-${Date.now()}-${userId.substring(0, 5)}`;

      // Create application in employer's jobs applications node
      const jobApplicationRef = ref(db, `jobs/${job.employerId}/${id}/applications/${userId}`);
      await set(jobApplicationRef, {
        candidateId: userId,
        applicationId: applicationId,
        status: 'pending',
        appliedAt: Date.now(),
        answers: answers
      });

      // Call the Cloud Function to send notification to employer
      try {
        const notifyCandidateApplication = httpsCallable(functions, 'notifyCandidateApplication');
        
        // Prepare data for the notification
        const notificationData = {
          employerId: job.employerId,
          jobId: id,
          jobTitle: job.jobTitle,
          candidateId: userId,
          candidateName: candidateData?.profile?.fullName || 'Candidate',
          applicationId: applicationId,
          summary: candidateData?.profile?.summary || 'No summary provided',
          skills: candidateData?.profile?.skills || [],
          experience: candidateData?.profile?.experience || 'Not specified',
          education: candidateData?.profile?.education || 'Not specified'
        };
        
        await notifyCandidateApplication(notificationData);
        console.log('Application notification sent to employer');
      } catch (notifyError) {
        console.error('Error sending application notification:', notifyError);
        // Don't fail the application process if notification fails
      }

      setHasApplied(true);
      setIsApplyModalOpen(false);
      toast.success('Application submitted successfully!');
    } catch (error) {
      console.error('Error submitting application:', error);
      toast.error('Failed to submit application. Please try again.');
    }
  };

  const handleFavorite = async () => {
    if (!auth.currentUser) {
      toast.info('Please sign in to save jobs');
      navigate('/candidate-sign-in');
      return;
    }

    if (!isCandidate) {
      toast.error('Only candidates can save jobs');
      return;
    }

    try {
      const userId = auth.currentUser.uid;
      const favoriteRef = ref(db, `candidates/${userId}/favorites/${id}`);

      if (isFavorite) {
        await set(favoriteRef, null);
        setIsFavorite(false);
        toast.success('Job removed from favorites');
      } else {
        await set(favoriteRef, {
          jobId: id,
          employerId: job.employerId,
          savedAt: Date.now(),
          jobTitle: job.jobTitle,
          companyName: job.companyName
        });
        setIsFavorite(true);
        toast.success('Job saved to favorites!');
      }
    } catch (error) {
      console.error('Error updating favorites:', error);
      toast.error('Failed to update favorites. Please try again.');
    }
  };

  const ApplicationQuestionsModal = () => (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
  
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                <FaQuestionCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Application Questions
                </h3>
                <div className="mt-4 space-y-4">
                  {job.questions.map((question) => (
                    <div key={question.id} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {question.question}
                        {question.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      
                      {question.type === 'multiple_choice' ? (
                        <select
                          value={answers[question.id] || ''}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          required={question.required}
                        >
                          <option value="">Select an option</option>
                          {question.options?.map((option, index) => (
                            <option key={index} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : question.type === 'yes_no' ? (
                        <div className="flex space-x-4">
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              name={`question_${question.id}`}
                              value="Yes"
                              checked={answers[question.id] === 'Yes'}
                              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                              className="form-radio h-4 w-4 text-blue-600"
                            />
                            <span className="ml-2">Yes</span>
                          </label>
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              name={`question_${question.id}`}
                              value="No"
                              checked={answers[question.id] === 'No'}
                              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                              className="form-radio h-4 w-4 text-blue-600"
                            />
                            <span className="ml-2">No</span>
                          </label>
                        </div>
                      ) : (
                        <textarea
                          value={answers[question.id] || ''}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 resize-y min-h-[100px]"
                          required={question.required}
                          placeholder="Enter your answer here..."
                          style={{ 
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'break-word',
                            lineHeight: '1.5'
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={submitApplication}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-950 text-base font-medium text-white hover:bg-[#cddd3a] hover:text-blue-950 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Submit Application
            </button>
            <button
              type="button"
              onClick={() => setIsApplyModalOpen(false)}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Company Header Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="col-span-2">
              {/* Logo and Basic Info */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  {job.companyLogo ? (
                    <img src={job.companyLogo} alt={job.companyName} className="w-full h-full object-cover rounded-lg"/>
                  ) : (
                    <FaBuilding className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-blue-950">{job.jobTitle}</h1>
                  <p className="text-lg text-gray-700">{job.companyName}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {job.employmentType}
                    </span>
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                      {job.experience}
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Details Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <FaMapMarkerAlt className="text-gray-500" />
                  <span>{job.parish}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FaBriefcase className="text-gray-500" />
                  <span>{job.employmentType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FaLaptopHouse className="text-gray-500" />
                  <span>{job.workType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FaDollarSign className="text-gray-500" />
                  <span>{job.salary}</span>
                </div>
                {job.questions && job.questions.length > 0 && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <FaQuestionCircle className="text-gray-500" />
                    <span>{job.questions.length} Screening {job.questions.length === 1 ? 'Question' : 'Questions'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons Column */}
            <div className="flex flex-col gap-3 justify-center">
              <button
                onClick={handleApply}
                disabled={hasApplied || !isCandidate}
                className={`w-full py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2
                  ${hasApplied 
                    ? 'bg-green-100 text-green-800 cursor-not-allowed' 
                    : !isCandidate
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-950 text-white hover:bg-[#cddd3a] hover:text-blue-950'
                  }`}
              >
                {hasApplied ? 'Already Applied' : 'Apply Now'}
              </button>
              <button
                onClick={handleFavorite}
                disabled={!isCandidate}
                className={`w-full py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2
                  ${!isCandidate
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : isFavorite
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <FaHeart className={isFavorite ? 'fill-current' : 'regular'} />
                {isFavorite ? 'Saved' : 'Save Job'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Job Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Job Description */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-blue-950 mb-4">Job Description</h2>
              <div className="prose max-w-none">
                <p className="whitespace-pre-line text-gray-700">{job.description}</p>
              </div>
            </div>

            {/* Requirements */}
            {job.requirements && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-blue-950 mb-4">Requirements</h2>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-line text-gray-700">{job.requirements}</p>
                </div>
              </div>
            )}

            {/* Other Requirements */}
            {job.otherRequirements && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-blue-950 mb-4">Other Requirements</h2>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-line text-gray-700">{job.otherRequirements}</p>
                </div>
              </div>
            )}

            {/* Benefits */}
            {job.benefits && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-blue-950 mb-4">Benefits</h2>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-line text-gray-700">{job.benefits}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Additional Info */}
          <div className="space-y-6">
            {/* Job Overview */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-blue-950 mb-4">Job Overview</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <FaCalendarAlt className="text-gray-500 mt-1" />
                  <div>
                    <p className="text-sm font-medium">Posted Date</p>
                    <p className="text-gray-600">
                      {new Date(job.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FaIndustry className="text-gray-500 mt-1" />
                  <div>
                    <p className="text-sm font-medium">Industry</p>
                    <p className="text-gray-600">{job.industry}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FaGraduationCap className="text-gray-500 mt-1" />
                  <div>
                    <p className="text-sm font-medium">Education Level</p>
                    <p className="text-gray-600">{job.degreeLevel}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FaClock className="text-gray-500 mt-1" />
                  <div>
                    <p className="text-sm font-medium">Experience</p>
                    <p className="text-gray-600">{job.experience}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FaLaptopHouse className="text-gray-500 mt-1" />
                  <div>
                    <p className="text-sm font-medium">Work Type</p>
                    <p className="text-gray-600">{job.workType}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Company Contact Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-blue-950 mb-4">Contact Information</h2>
              <div className="space-y-4">
                {job.contactEmail && (
                  <div className="flex items-start gap-3">
                    <FaEnvelope className="text-gray-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <a href={`mailto:${job.contactEmail}`} className="text-blue-600 hover:underline">
                        {job.contactEmail}
                      </a>
                    </div>
                  </div>
                )}

                {job.contactPhone && (
                  <div className="flex items-start gap-3">
                    <FaPhone className="text-gray-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <p className="text-gray-600">{job.contactPhone}</p>
                    </div>
                  </div>
                )}

                {job.website && (
                  <div className="flex items-start gap-3">
                    <FaGlobe className="text-gray-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">Website</p>
                      <a 
                        href={job.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {job.website}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Application Instructions */}
        {job.applicationInstructions && (
          <div className="mt-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-blue-950 mb-4">How to Apply</h2>
              <div className="prose max-w-none">
                <p className="whitespace-pre-line text-gray-700">
                  {job.applicationInstructions}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Job Post Info */}
        <div className="mt-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 text-center">
              Posted on{' '}
              {new Date(job.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
              {job.expiryDate && ` • Expires on ${new Date(job.expiryDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}`}
            </p>
          </div>
        </div>

        {/* Share Job Section */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 mb-2">Know someone who would be perfect for this role?</p>
          <div className="flex justify-center gap-4 flex-wrap">
            <button 
              onClick={() => {
                const subject = encodeURIComponent(`Job Opportunity: ${job.jobTitle} at ${job.companyName}`);
                const body = encodeURIComponent(
                  `Hi,\n\nI found this job opportunity that might interest you:\n\n` +
                  `Position: ${job.jobTitle}\n` +
                  `Company: ${job.companyName}\n` +
                  `Location: ${job.parish}\n` +
                  `Employment Type: ${job.employmentType}\n` +
                  `Experience Required: ${job.experience}\n` +
                  `Salary: ${job.salary}\n\n` +
                  `Job Description:\n${job.description.substring(0, 200)}${job.description.length > 200 ? '...' : ''}\n\n` +
                  `View full job details and apply here: ${window.location.href}\n\n` +
                  `Best regards`
                );
                window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <FaEnvelope />
              Share via Email
            </button>
            
            <button 
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `${job.jobTitle} at ${job.companyName}`,
                    text: `Check out this job opportunity: ${job.jobTitle} at ${job.companyName}`,
                    url: window.location.href
                  }).catch(console.error);
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('Job link copied to clipboard!');
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
            >
              Share Link
            </button>
          </div>
        </div>

        {/* Back to Jobs Link */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/jobs')}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to All Jobs
          </button>
        </div>
      </div>

      {/* Application Questions Modal */}
      {isApplyModalOpen && <ApplicationQuestionsModal />}
    </div>
  );
};

export default JobDetails;