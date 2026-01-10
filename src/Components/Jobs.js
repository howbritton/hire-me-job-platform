import React, { useState, useEffect } from "react";
import { FaBuilding, FaHeart, FaQuestionCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { getDatabase, ref, get, set, update } from 'firebase/database';
import jobBanner from '../assets/job-banner.png';
import { getAuth } from 'firebase/auth';
import { toast } from 'react-toastify';
// Import Firebase functions
import { getFunctions, httpsCallable } from 'firebase/functions';

const Hero = () => {
  return (
    <header
      className="max-w-full light text-white bg-center bg-cover bg-fixed"
      style={{
        backgroundImage: `url(${jobBanner})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center center",
      }}
    >
      <div className="py-24 md:py-32 bg-black bg-opacity-50 dark:bg-opacity-70">
        <div className="container px-4 m-auto">
          <div className="grid grid-cols-12">
            <div className="col-span-12 text-center">
              <div className="text-center">
                <div className="w-3/4 m-auto">
                  <p style={{ lineHeight: "1.5", color: "#cddd3a" }} 
                     className="text-5xl text-center font-extrabold uppercase">
                    Available Job Listing
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const JobCard = ({ job }) => {
  const navigate = useNavigate();
  const auth = getAuth();
  const db = getDatabase();
  const functions = getFunctions();
  const [isFavorite, setIsFavorite] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [isCandidate, setIsCandidate] = useState(false);
  const [candidateData, setCandidateData] = useState(null);

  useEffect(() => {
    const checkUserStatus = async () => {
      if (auth.currentUser) {
        const userId = auth.currentUser.uid;
        
        try {
          // Check if user is a candidate
          const candidateRef = ref(db, `candidates/${userId}`);
          const candidateSnapshot = await get(candidateRef);
          
          if (candidateSnapshot.exists()) {
            setIsCandidate(true);
            setCandidateData(candidateSnapshot.val());
          }

          // Check application and favorite status
          const [favSnapshot, appSnapshot] = await Promise.all([
            get(ref(db, `candidates/${userId}/favorites/${job.id}`)),
            get(ref(db, `candidates/${userId}/applications/${job.id}`))
          ]);
          
          setIsFavorite(favSnapshot.exists());
          setHasApplied(appSnapshot.exists());
        } catch (error) {
          console.error('Error checking user status:', error);
        }
      }
    };

    checkUserStatus();
  }, [auth.currentUser, db, job.id]);

  const handleView = () => {
    navigate(`/jobs/${job.id}`);
  };

  const handleApply = async () => {
    if (!auth.currentUser) {
      toast.info('Please sign in to apply for jobs');
      navigate("/candidate-sign-in");
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
        navigate(`/jobs/${job.id}?action=apply`);
        return;
      }

      const userId = auth.currentUser.uid;
      const applicationRef = ref(db, `candidates/${userId}/applications/${job.id}`);
      const applicationId = `app-${Date.now()}-${userId.substring(0, 5)}`;
      
      const applicationData = {
        jobId: job.id,
        employerId: job.employerId,
        status: 'pending',
        appliedAt: Date.now(),
        jobTitle: job.jobTitle,
        companyName: job.companyName,
        applicationId: applicationId
      };
      
      await set(applicationRef, applicationData);

      const jobApplicationRef = ref(db, `jobs/${job.employerId}/${job.id}/applications/${userId}`);
      await set(jobApplicationRef, {
        candidateId: userId,
        status: 'pending',
        appliedAt: Date.now(),
        applicationId: applicationId
      });

      // Call the Cloud Function to send notification to employer
      try {
        const notifyCandidateApplication = httpsCallable(functions, 'notifyCandidateApplication');
        
        // Prepare data for the notification
        const notificationData = {
          employerId: job.employerId,
          jobId: job.id,
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
      toast.success('Application submitted successfully!');
    } catch (error) {
      console.error('Error submitting application:', error);
      toast.error('Failed to submit application. Please try again.');
    }
  };

  const handleFavorite = async () => {
    if (!auth.currentUser) {
      toast.info('Please sign in to save jobs');
      navigate("/candidate-sign-in");
      return;
    }

    if (!isCandidate) {
      toast.error('Only candidates can save jobs');
      return;
    }

    try {
      const userId = auth.currentUser.uid;
      const favoriteRef = ref(db, `candidates/${userId}/favorites/${job.id}`);

      if (isFavorite) {
        await set(favoriteRef, null);
        setIsFavorite(false);
        toast.success('Job removed from favorites');
      } else {
        await set(favoriteRef, {
          jobId: job.id,
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

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 mb-4 flex flex-col md:flex-row justify-between items-start border border-gray-200">
      <div className="flex flex-col md:flex-row items-start md:items-center w-full md:w-auto mb-4 md:mb-0">
        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center mb-4 md:mb-0 md:mr-5 overflow-hidden flex-shrink-0">
          {job.companyLogo ? (
            <img
              src={job.companyLogo}
              alt={`${job.companyName} logo`}
              className="w-full h-full object-cover"
            />
          ) : (
            <FaBuilding className="w-8 h-8 text-gray-400" />
          )}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-blue-950 mb-1">
            {job.jobTitle}
          </h1>
          <div className="text-gray-600 text-lg mb-2">{job.companyName}</div>
          <span className="text-gray-400 text-sm capitalize">
            Posted: {new Date(job.createdAt || job.updatedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
            {job.approvedAt && (
              <span className="ml-2">
                • Approved: {new Date(job.approvedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            )}
          </span>
          <div className="text-gray-500 mb-1">
            {job.salary} • {job.parish}
          </div>
          <div className="text-gray-600 text-md mb-2">
            {job.description.length > 150
              ? `${job.description.substring(0, 150)}...`
              : job.description}
          </div>
          {job.questions && job.questions.length > 0 && (
            <div className="flex items-center text-gray-500 text-sm mt-2">
              <FaQuestionCircle className="mr-1" />
              {job.questions.length} screening {job.questions.length === 1 ? 'question' : 'questions'}
            </div>
          )}
        </div>
        {/* Expiration indicator */}
        {job.daysUntilExpiration !== null && job.daysUntilExpiration < 7 && (
          <div className="text-orange-600 text-sm flex items-center mt-2">
            <span className="mr-1">⏱️</span>
            {job.daysUntilExpiration <= 0 
              ? 'Expires today' 
              : `Expires in ${job.daysUntilExpiration} day${job.daysUntilExpiration !== 1 ? 's' : ''}`}
          </div>
        )}
      </div>
      <div className="flex flex-col md:flex-row items-stretch md:items-center space-y-2 md:space-y-0 md:space-x-3 w-full md:w-auto">
        <button 
          onClick={handleView}
          className="text-blue-600 bg-blue-100 px-4 py-2 rounded-full transition duration-300 ease-in-out hover:bg-blue-200 hover:text-blue-700"
        >
          View Details
        </button>
        <button 
          onClick={handleApply}
          disabled={hasApplied}
          className={`flex items-center justify-center px-4 py-2 rounded-full transition duration-300 ease-in-out ${
            hasApplied
              ? 'bg-green-100 text-green-600 cursor-not-allowed'
              : 'bg-green-100 text-green-600 hover:bg-green-200 hover:text-green-700'
          }`}
        >
          {hasApplied ? 'Applied' : job.questions && job.questions.length > 0 ? 'Apply' : 'Quick Apply'}
        </button>
        <button
          onClick={handleFavorite}
          className={`flex items-center justify-center px-4 py-2 rounded-full transition duration-300 ease-in-out ${
            isFavorite
              ? 'bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700'
              : 'bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700'
          }`}
        >
          <FaHeart className={`mr-2 ${isFavorite ? 'fill-current' : 'regular'}`} />
          {isFavorite ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
};

const Jobs = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    jobLocation: "All Locations",
    requiredWorkSite: "Any Type",
    employmentType: "Any Employment Type",
    title: "",
  });

  const jobLocations = [
    "Clarendon", "Hanover", "Kingston", "Manchester", "Portland",
    "Saint Andrew", "Saint Ann", "Saint Catherine", "Saint Elizabeth",
    "Saint James", "Saint Mary", "Saint Thomas", "Trelawny", "Westmoreland",
  ];

  const SidebarModal = ({ isOpen, onClose, filters, setFilters }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-start justify-end">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        <div className="bg-white w-80 h-full p-4 overflow-y-auto shadow-lg relative">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Filter Jobs</h3>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>
          <div className="flex flex-col gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Search by Keyword
              </label>
              <input
                type="text"
                placeholder="Job title, keywords, or company"
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.title}
                onChange={(e) => setFilters(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <select
                value={filters.jobLocation}
                onChange={(e) => setFilters(prev => ({ ...prev, jobLocation: e.target.value }))}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="All Locations">All Locations</option>
                {jobLocations.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Work Type
              </label>
              <select
                value={filters.requiredWorkSite}
                onChange={(e) => setFilters(prev => ({ ...prev, requiredWorkSite: e.target.value }))}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Any Type">Any Type</option>
                <option value="Remote">Remote</option>
                <option value="On-site">On-site</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Employment Type
              </label>
              <select
                value={filters.employmentType}
                onChange={(e) => setFilters(prev => ({ ...prev, employmentType: e.target.value }))}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Any Employment Type">Any Employment Type</option>
                <option value="full-time">Full Time</option>
                <option value="part-time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
                <option value="Volunteer">Volunteer</option>
                <option value="Freelance">Freelance</option>
              </select>
            </div>

            <button 
              className="w-full bg-blue-950 text-white py-2 rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors duration-200"
              onClick={onClose}
            >
              Apply Filters
            </button>

            <button 
              className="w-full border border-gray-300 py-2 rounded-md hover:bg-gray-50 transition-colors duration-200"
              onClick={() => {
                setFilters({
                  jobLocation: "All Locations",
                  requiredWorkSite: "Any Type",
                  employmentType: "Any Employment Type",
                  title: "",
                });
                onClose();
              }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced cleanup function to handle approval-based expiration
  const cleanupExpiredJobs = async () => {
    try {
      console.log('[Jobs] Starting expired jobs cleanup...');
      const db = getDatabase();
      const now = new Date();
      
      // Get all jobs
      const jobsRef = ref(db, 'jobs');
      const jobsSnapshot = await get(jobsRef);
      
      // Get all employer subscriptions to check for expired subscriptions
      const employersRef = ref(db, 'employers');
      const employersSnapshot = await get(employersRef);
      
      if (!jobsSnapshot.exists()) {
        console.log('[Jobs] No jobs found for cleanup');
        return 0;
      }
      
      const updates = {};
      let expiredCount = 0;
      const allJobs = jobsSnapshot.val();
      const allEmployers = employersSnapshot.exists() ? employersSnapshot.val() : {};
      
      // Check each employer's jobs
      Object.entries(allJobs).forEach(([employerId, employerJobs]) => {
        if (employerJobs && typeof employerJobs === 'object') {
          // Get employer subscription info
          const employer = allEmployers[employerId];
          const subscription = employer?.subscription;
          
          Object.entries(employerJobs).forEach(([jobId, job]) => {
            // Only check approved/active jobs
            if (job.status !== 'approved' && job.status !== 'active') {
              return;
            }
            
            let shouldExpire = false;
            let expireReason = '';
            
            // Priority 1: Check job's own expiration date (set at approval time)
            if (job.expirationDate) {
              const expirationDate = new Date(job.expirationDate);
              
              if (now > expirationDate) {
                shouldExpire = true;
                expireReason = 'Job expiration date reached';
                console.log(`[Jobs] Job expired by date: ${job.jobTitle} (${jobId}) - Expired: ${expirationDate.toISOString()}`);
              }
            }
            
            // Priority 2: Check if employer subscription has expired (backup check)
            if (!shouldExpire && subscription && subscription.endDate) {
              const subscriptionEndDate = new Date(subscription.endDate);
              
              if (now > subscriptionEndDate) {
                shouldExpire = true;
                expireReason = 'Employer subscription expired';
                console.log(`[Jobs] Job expired by subscription: ${job.jobTitle} (${jobId}) - Subscription expired: ${subscriptionEndDate.toISOString()}`);
              }
            }
            
            // Priority 3: If job was approved but has no expiration date, check approval date + subscription duration
            if (!shouldExpire && job.approvedAt && !job.expirationDate && subscription) {
              const approvalDate = new Date(job.approvedAt);
              let calculatedExpiration;
              
              if (subscription.package && subscription.package.duration) {
                calculatedExpiration = new Date(approvalDate);
                calculatedExpiration.setDate(approvalDate.getDate() + subscription.package.duration);
              } else if (subscription.endDate) {
                calculatedExpiration = new Date(subscription.endDate);
              }
              
              if (calculatedExpiration && now > calculatedExpiration) {
                shouldExpire = true;
                expireReason = 'Calculated expiration from approval date reached';
                console.log(`[Jobs] Job expired by calculated date: ${job.jobTitle} (${jobId}) - Calculated: ${calculatedExpiration.toISOString()}`);
              }
            }
            
            if (shouldExpire) {
              console.log(`[Jobs] Expiring job: ${job.jobTitle} (ID: ${jobId}) - Reason: ${expireReason}`);
              
              // Move to expired jobs collection with detailed metadata
              updates[`expired-jobs/${employerId}/${jobId}`] = {
                ...job,
                status: 'expired',
                expiredAt: now.toISOString(),
                expireReason: expireReason,
                originalExpirationDate: job.expirationDate,
                approvedAt: job.approvedAt,
                employerSubscriptionEndDate: subscription?.endDate,
                // Add cleanup metadata
                cleanupProcessedAt: now.toISOString(),
                cleanupVersion: '2.0'
              };
              
              // Remove from active jobs
              updates[`jobs/${employerId}/${jobId}`] = null;
              
              expiredCount++;
            }
          });
        }
      });
      
      // Apply all updates in batch
      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
        console.log(`[Jobs] Automatically expired ${expiredCount} jobs`);
      }
      
      return expiredCount;
    } catch (error) {
      console.error('[Jobs] Error cleaning up expired jobs:', error);
      return 0;
    }
  };

  // Function to recalculate expiration dates for existing jobs without proper expiration dates
  const recalculateJobExpirations = async () => {
    try {
      console.log('[Jobs] Starting job expiration recalculation...');
      const db = getDatabase();
      
      const jobsRef = ref(db, 'jobs');
      const jobsSnapshot = await get(jobsRef);
      
      const employersRef = ref(db, 'employers');
      const employersSnapshot = await get(employersRef);
      
      if (!jobsSnapshot.exists()) {
        console.log('[Jobs] No jobs found for recalculation');
        return 0;
      }
      
      const updates = {};
      let updatedCount = 0;
      const allJobs = jobsSnapshot.val();
      const allEmployers = employersSnapshot.exists() ? employersSnapshot.val() : {};
      
      Object.entries(allJobs).forEach(([employerId, employerJobs]) => {
        if (employerJobs && typeof employerJobs === 'object') {
          const employer = allEmployers[employerId];
          const subscription = employer?.subscription;
          
          Object.entries(employerJobs).forEach(([jobId, job]) => {
            // Only update jobs that are approved but missing expiration date
            if ((job.status === 'approved' || job.status === 'active') && !job.expirationDate && job.approvedAt) {
              let calculatedExpiration;
              
              if (subscription && subscription.endDate) {
                calculatedExpiration = new Date(subscription.endDate);
              } else if (subscription?.package?.duration && job.approvedAt) {
                const approvalDate = new Date(job.approvedAt);
                calculatedExpiration = new Date(approvalDate);
                calculatedExpiration.setDate(approvalDate.getDate() + subscription.package.duration);
              }
              
              if (calculatedExpiration) {
                updates[`jobs/${employerId}/${jobId}/expirationDate`] = calculatedExpiration.toISOString();
                updates[`jobs/${employerId}/${jobId}/expirationCalculatedAt`] = new Date().toISOString();
                updates[`jobs/${employerId}/${jobId}/expirationBasedOn`] = subscription?.endDate ? 'subscription_end_date' : 'approval_plus_duration';
                updatedCount++;
                
                console.log(`[Jobs] Updated expiration for: ${job.jobTitle} (${jobId}) - Expires: ${calculatedExpiration.toISOString()}`);
              }
            }
          });
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
        console.log(`[Jobs] Recalculated expiration dates for ${updatedCount} jobs`);
      }
      
      return updatedCount;
    } catch (error) {
      console.error('[Jobs] Error recalculating job expirations:', error);
      return 0;
    }
  };

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        // First, cleanup any expired jobs
        await cleanupExpiredJobs();
        
        // Recalculate expiration dates for jobs missing them (run once)
        await recalculateJobExpirations();
        
        const db = getDatabase();
        const jobsRef = ref(db, 'jobs');
        const snapshot = await get(jobsRef);

        if (snapshot.exists()) {
          const jobsData = [];
          Object.entries(snapshot.val()).forEach(([employerId, employerJobs]) => {
            Object.entries(employerJobs).forEach(([jobId, job]) => {
              // Only include jobs that are approved and not expired
              if (job.status === 'approved') {
                const isExpired = job.expirationDate && new Date(job.expirationDate) < new Date();
                
                if (!isExpired) {
                  jobsData.push({
                    id: jobId,
                    employerId,
                    ...job,
                    title: job.jobTitle,
                    location: job.parish,
                    daysUntilExpiration: job.expirationDate ? 
                      Math.ceil((new Date(job.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)) : null,
                    updatedAt: job.updatedAt || job.approvedAt || job.createdAt || new Date().toISOString()
                  });
                } else {
                  console.log(`[Jobs] Found expired job during fetch: ${job.jobTitle}, scheduling for cleanup`);
                }
              }
            });
          });

          jobsData.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          setJobs(jobsData);
          console.log(`[Jobs] Loaded ${jobsData.length} active approved jobs`);
        } else {
          setJobs([]);
        }
      } catch (err) {
        console.error('Error fetching jobs:', err);
        setError('Failed to load jobs. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();

    // Set up periodic cleanup every 5 minutes
    const cleanupInterval = setInterval(async () => {
      const expiredCount = await cleanupExpiredJobs();
      if (expiredCount > 0) {
        // If jobs were expired, refresh the list
        const db = getDatabase();
        const jobsRef = ref(db, 'jobs');
        const snapshot = await get(jobsRef);
        
        if (snapshot.exists()) {
          const jobsData = [];
          Object.entries(snapshot.val()).forEach(([employerId, employerJobs]) => {
            Object.entries(employerJobs).forEach(([jobId, job]) => {
              if (job.status === 'approved') {
                const isExpired = job.expirationDate && new Date(job.expirationDate) < new Date();
                if (!isExpired) {
                  jobsData.push({
                    id: jobId,
                    employerId,
                    ...job,
                    title: job.jobTitle,
                    location: job.parish,
                    daysUntilExpiration: job.expirationDate ? 
                      Math.ceil((new Date(job.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)) : null,
                    updatedAt: job.updatedAt || job.approvedAt || job.createdAt || new Date().toISOString()
                  });
                }
              }
            });
          });
          jobsData.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          setJobs(jobsData);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

  const filteredJobs = jobs.filter((job) => {
    const matchesLocation =
      filters.jobLocation === "All Locations" ||
      job.parish === filters.jobLocation;
  
    // Add null check for workType
    const matchesWorkSite =
      filters.requiredWorkSite === "Any Type" ||
      (job.workType && job.workType.toLowerCase() === filters.requiredWorkSite.toLowerCase());
  
    const matchesEmploymentType =
      filters.employmentType === "Any Employment Type" ||
      job.employmentType.toLowerCase() === filters.employmentType.toLowerCase();
  
    const searchTerm = filters.title.toLowerCase();
    const matchesSearchTerm =
      !filters.title ||
      job.jobTitle.toLowerCase().includes(searchTerm) ||
      job.description.toLowerCase().includes(searchTerm) ||
      job.companyName.toLowerCase().includes(searchTerm);
  
    return matchesLocation && matchesWorkSite && matchesEmploymentType && matchesSearchTerm;
  });

  if (loading) {
    return (
      <div className="max-w-full">
        <Hero />
        <div className="container mx-auto py-20 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-full">
        <Hero />
        <div className="container mx-auto py-20">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full">
      <Hero />
      <div className="container mx-auto py-20 px-4">
        <button
          className="w-full bg-blue-950 text-white p-3 rounded-md mb-6 md:hidden hover:bg-[#cddd3a] hover:text-blue-950 transition-colors duration-200"
          onClick={() => setIsSidebarOpen(true)}
        >
          Filter Jobs
        </button>

        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Main Content */}
            <div className="col-span-1 md:col-span-9 lg:col-span-9">
              <div className="space-y-6">
                {filteredJobs.length > 0 ? (
                  filteredJobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))
                ) : (
                  <div className="text-center p-8 bg-gray-50 rounded-lg">
                    <p className="text-2xl text-gray-500">No jobs found matching your criteria.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden md:block md:col-span-3 lg:col-span-3">
              <div className="bg-white shadow-md rounded-lg p-6 space-y-6 sticky top-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Search by Keyword
                  </label>
                  <input
                    type="text"
                    placeholder="Job title, keywords, or company"
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={filters.title}
                    onChange={(e) => setFilters(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Location
                  </label>
                  <select
                    value={filters.jobLocation}
                    onChange={(e) => setFilters(prev => ({ ...prev, jobLocation: e.target.value }))}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="All Locations">All Locations</option>
                    {jobLocations.map(location => (
                      <option key={location} value={location}>{location}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Work Type
                  </label>
                  <select
                    value={filters.requiredWorkSite}
                    onChange={(e) => setFilters(prev => ({ ...prev, requiredWorkSite: e.target.value }))}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Any Type">Any Type</option>
                    <option value="Remote">Remote</option>
                    <option value="On-site">On-site</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Employment Type
                  </label>
                  <select
                    value={filters.employmentType}
                    onChange={(e) => setFilters(prev => ({ ...prev, employmentType: e.target.value }))}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Any Employment Type">Any Employment Type</option>
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                    <option value="Volunteer">Volunteer</option>
                    <option value="Freelance">Freelance</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <button 
                    className="w-full bg-blue-950 text-white py-2 rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors duration-200"
                    onClick={() => {
                      // Filters are already applied automatically through the filteredJobs logic
                    }}
                  >
                    Apply Filters
                  </button>

                  <button 
                    className="w-full border border-gray-300 py-2 rounded-md hover:bg-gray-50 transition-colors duration-200"
                    onClick={() => {
                      setFilters({
                        jobLocation: "All Locations",
                        requiredWorkSite: "Any Type",
                        employmentType: "Any Employment Type",
                        title: "",
                      });
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Filter Sidebar */}
          <SidebarModal
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            filters={filters}
            setFilters={setFilters}
          />
        </div>

        {/* Job Count */}
        <div className="mt-6 text-center text-gray-600">
          Showing {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
          {(filters.title || filters.jobLocation !== "All Locations" || 
            filters.requiredWorkSite !== "Any Type" || 
            filters.employmentType !== "Any Employment Type") && " matching your criteria"}
        </div>
      </div>
    </div>
  );
};

export default Jobs;