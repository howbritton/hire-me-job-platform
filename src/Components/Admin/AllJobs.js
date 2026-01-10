import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, set, remove } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { 
  ChevronDown, 
  ChevronUp, 
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
  X,
  User,
  RefreshCw
} from 'lucide-react';
import { app } from '../../firebase';
import { toast } from 'react-toastify';

const AllJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState({});
  const [selectedJob, setSelectedJob] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  const db = getDatabase(app);
  const auth = getAuth(app);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!auth.currentUser) {
        setIsAdmin(false);
        return;
      }

      try {
        const adminRef = ref(db, `admins/${auth.currentUser.uid}`);
        const snapshot = await get(adminRef);
        setIsAdmin(snapshot.exists());
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [auth.currentUser, db]);

  const fetchJobs = useCallback(async () => {
    try {
      console.log('Fetching jobs...');
      const jobsRef = ref(db, 'jobs');
      const snapshot = await get(jobsRef);
      
      console.log('Snapshot:', snapshot.val());
      if (snapshot.exists()) {
        const allJobs = [];
        Object.entries(snapshot.val()).forEach(([employerId, employerJobs]) => {
          Object.entries(employerJobs).forEach(([jobId, job]) => {
            // Include both active and approved jobs
            if (job.status === 'active' || job.status === 'approved') {
              allJobs.push({
                id: jobId,
                employerId,
                ...job
              });
            }
          });
        });
        // Sort jobs by creation date (newest first)
        allJobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        console.log('Processed jobs:', allJobs);
        setJobs(allJobs);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleBackToReview = async (job) => {
    try {
      // Move to pending-jobs node
      const pendingJobRef = ref(db, `pending-jobs/${job.employerId}/${job.id}`);
      await set(pendingJobRef, {
        ...job,
        status: 'pending',
        movedToReviewAt: new Date().toISOString()
      });

      // Remove from jobs node
      const jobRef = ref(db, `jobs/${job.employerId}/${job.id}`);
      await remove(jobRef);

      // Update local state
      setJobs(prev => prev.filter(j => j.id !== job.id));
      
      if (showModal && selectedJob?.id === job.id) {
        setShowModal(false);
        setSelectedJob(null);
      }

      toast.success('Job moved back to review successfully');
    } catch (error) {
      console.error('Error moving job back to review:', error);
      toast.error('Error moving job back to review');
    }
  };

  const toggleJobExpansion = (jobId) => {
    setExpandedJobs(prev => ({
      ...prev,
      [jobId]: !prev[jobId]
    }));
  };

  const filteredJobs = jobs.filter(job => {
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

          {/* Admin Actions */}
          {isAdmin && (
            <div className="mt-6 pt-6 border-t">
              <button
                onClick={() => handleBackToReview(job)}
                className="flex items-center justify-center w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Send Back to Review
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="flex justify-center items-center h-96">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-blue-950">All Jobs</h1>
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
            {searchTerm ? 'No jobs match your search criteria' : 'No jobs available'}
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
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setSelectedJob(job);
                        setShowModal(true);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      View Details
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleBackToReview(job)}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors flex items-center"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Back to Review
                      </button>
                    )}
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

export default AllJobs;