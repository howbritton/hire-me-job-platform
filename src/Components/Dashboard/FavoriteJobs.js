import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, get, remove, set } from 'firebase/database';
import { toast } from 'react-toastify';
import { FaHeart, FaMapMarkerAlt, FaClock, FaDollarSign, FaBuilding, FaUserAlt } from 'react-icons/fa';

const FavoriteJobs = () => {
  const [favoriteJobs, setFavoriteJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const auth = getAuth();
  const db = getDatabase();

  useEffect(() => {
    const fetchFavoriteJobs = async () => {
      try {
        if (!auth.currentUser) {
          toast.error('Please sign in to view your favorite jobs');
          return;
        }

        const favoritesRef = ref(db, `candidates/${auth.currentUser.uid}/favorites`);
        const snapshot = await get(favoritesRef);

        if (snapshot.exists()) {
          const favoritesData = snapshot.val();
          
          // Fetch complete job details for each favorite
          const jobPromises = Object.entries(favoritesData).map(async ([jobId, favorite]) => {
            // Search through employers to find the job
            const jobsRef = ref(db, 'jobs');
            const jobsSnapshot = await get(jobsRef);
            
            let foundJob = null;
            let employerId = null;

            if (jobsSnapshot.exists()) {
              jobsSnapshot.forEach((employerSnapshot) => {
                const employerJobs = employerSnapshot.val();
                if (employerJobs[jobId]) {
                  foundJob = employerJobs[jobId];
                  employerId = employerSnapshot.key;
                }
              });
            }

            if (foundJob) {
              // Fetch employer details
              const employerRef = ref(db, `employers/${employerId}/profile`);
              const employerSnapshot = await get(employerRef);
              const employerData = employerSnapshot.exists() ? employerSnapshot.val() : null;

              return {
                ...foundJob,
                id: jobId,
                employerId,
                companyName: employerData?.companyName || foundJob.companyName || 'Company Name',
                savedAt: favorite.savedAt
              };
            }
            return null;
          });

          const jobs = await Promise.all(jobPromises);
          setFavoriteJobs(jobs.filter(job => job !== null).sort((a, b) => b.savedAt - a.savedAt));
        } else {
          setFavoriteJobs([]);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching favorite jobs:', error);
        toast.error('Failed to load favorite jobs');
        setLoading(false);
      }
    };

    fetchFavoriteJobs();
  }, [auth.currentUser, db]);

  const removeFavorite = async (jobId) => {
    try {
      await remove(ref(db, `candidates/${auth.currentUser.uid}/favorites/${jobId}`));
      setFavoriteJobs(prev => prev.filter(job => job.id !== jobId));
      toast.success('Job removed from favorites');
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Failed to remove job from favorites');
    }
  };

  const handleApply = async (job) => {
    try {
      const applicationRef = ref(db, `candidates/${auth.currentUser.uid}/applications/${job.id}`);
      const applicationSnapshot = await get(applicationRef);
      
      if (applicationSnapshot.exists()) {
        toast.info('You have already applied for this job');
        return;
      }

      // Check if job has screening questions
      if (job.questions && job.questions.length > 0) {
        // Navigate to job details page with apply action
        navigate(`/jobs/${job.id}?action=apply`);
        return;
      }

      await set(applicationRef, {
        jobId: job.id,
        employerId: job.employerId,
        status: 'pending',
        appliedAt: Date.now(),
        jobTitle: job.jobTitle,
        companyName: job.companyName
      });

      // Add application to employer's jobs applications node
      const jobApplicationRef = ref(db, `jobs/${job.employerId}/${job.id}/applications/${auth.currentUser.uid}`);
      await set(jobApplicationRef, {
        candidateId: auth.currentUser.uid,
        status: 'pending',
        appliedAt: Date.now()
      });

      toast.success('Application submitted successfully!');
    } catch (error) {
      console.error('Error applying for job:', error);
      toast.error('Failed to submit application');
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
    <div className="w-full max-w-6xl mx-auto bg-white">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-blue-950">
          Saved Jobs ({favoriteJobs.length})
        </h2>
      </div>

      <div className="p-6">
        {favoriteJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FaHeart className="text-gray-400 text-5xl mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Saved Jobs Yet</h3>
            <p className="text-gray-500 max-w-md mb-6">
              Start exploring jobs and save your favorites to see them here!
            </p>
            <button
              onClick={() => navigate('/jobs')}
              className="bg-blue-950 text-white px-6 py-2 rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors duration-200"
            >
              Browse Jobs
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {favoriteJobs.map((job) => (
              <div key={job.id} className="bg-white shadow-lg rounded-lg p-6 border border-gray-200">
                <div className="flex flex-col md:flex-row justify-between">
                  <div className="flex flex-col md:flex-row items-start md:items-center w-full md:w-auto mb-4 md:mb-0">
                    <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4 md:mb-0 md:mr-5 overflow-hidden">
                      {job.companyLogo ? (
                        <img
                          src={job.companyLogo}
                          alt={`${job.companyName} logo`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FaUserAlt className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-blue-950 mb-2">
                        {job.jobTitle}
                      </h3>
                      <div className="flex flex-wrap gap-4 text-gray-600 mb-4">
                        <div className="flex items-center">
                          <FaBuilding className="mr-2" />
                          {job.companyName}
                        </div>
                        {job.parish && (
                          <div className="flex items-center">
                            <FaMapMarkerAlt className="mr-2" />
                            {job.parish}
                          </div>
                        )}
                        {job.employmentType && (
                          <div className="flex items-center">
                            <FaClock className="mr-2" />
                            {job.employmentType}
                          </div>
                        )}
                        {job.salary && (
                          <div className="flex items-center">
                            <FaDollarSign className="mr-2" />
                            {job.salary}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mb-4">
                        Saved on {formatDate(job.savedAt)}
                      </div>
                      {job.description && (
                        <p className="text-gray-600 mb-4 line-clamp-2">
                          {job.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="flex items-center justify-center px-4 py-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors duration-200"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleApply(job)}
                      className="flex items-center justify-center px-4 py-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors duration-200"
                    >
                      {job.questions && job.questions.length > 0 ? 'Apply' : 'Quick Apply'}
                    </button>
                    <button
                      onClick={() => removeFavorite(job.id)}
                      className="flex items-center justify-center px-4 py-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors duration-200"
                    >
                      <FaHeart className="mr-2" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoriteJobs;