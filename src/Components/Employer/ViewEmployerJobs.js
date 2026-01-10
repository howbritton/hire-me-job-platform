import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { Building, MapPin, Briefcase, Plus, Calendar, GraduationCap, DollarSign, X } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import AddEmployerJobs from './AddEmployerJobs';
import EditEmployerJobs from './EditEmployerJobs';
import 'react-toastify/dist/ReactToastify.css';

const JobList = ({ jobs, onView, onEdit }) => {
  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <div key={job.id} className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex justify-between items-start">
            <div className="flex-grow">
              <h3 
                onClick={() => onView(job)}
                className="text-xl font-semibold text-blue-950 hover:text-blue-600 cursor-pointer"
              >
                {job.jobTitle}
              </h3>
              <div className="mt-2 space-y-2">
                <div className="flex items-center text-gray-600">
                  <Building className="w-4 h-4 mr-2" />
                  <span>{job.companyName}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <MapPin className="w-4 h-4 mr-2" />
                  <span>{job.parish}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Briefcase className="w-4 h-4 mr-2" />
                  <span>{job.employmentType}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>Posted: {new Date(job.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <span className={`px-3 py-1 rounded-full text-sm ${
                job.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {job.status === 'active' ? 'Active' : 'Inactive'}
              </span>
              <div className="flex space-x-2 mt-2">
                <button
                  onClick={() => onView(job)}
                  className="flex items-center px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-blue-900"
                >
                  View Details
                </button>
                <button
                  onClick={() => onEdit(job.id)}
                  className="flex items-center px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-blue-900"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const JobDetails = ({ job, onClose }) => {
  if (!job) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center overflow-y-auto p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl mt-20 mb-8 relative">
        <div className="sticky top-0 bg-white p-6 border-b rounded-t-lg z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-blue-950">{job.jobTitle}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex justify-between items-center">
            <span className={`px-3 py-1 rounded-full text-sm ${
              job.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {job.status === 'active' ? 'Active' : 'Inactive'}
            </span>
            <span className="text-sm text-gray-500">
              Posted on {new Date(job.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center text-gray-600">
              <Building className="w-5 h-5 mr-2" />
              <span>{job.companyName}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <MapPin className="w-5 h-5 mr-2" />
              <span>{job.parish}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <Briefcase className="w-5 h-5 mr-2" />
              <span>{job.employmentType}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <Calendar className="w-5 h-5 mr-2" />
              <span>{job.experience}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <GraduationCap className="w-5 h-5 mr-2" />
              <span>{job.degreeLevel}</span>
            </div>
            {job.salary && (
              <div className="flex items-center text-gray-600">
                <DollarSign className="w-5 h-5 mr-2" />
                <span>{job.salary}</span>
              </div>
            )}
          </div>

          {/* Industry */}
          {job.industry && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Industry</h2>
              <p className="text-gray-600">{job.industry}</p>
            </div>
          )}

          {/* Description */}
          <div>
            <h2 className="text-xl font-semibold mb-3">Description</h2>
            <p className="text-gray-600 whitespace-pre-line">{job.description}</p>
          </div>

          {/* Other Requirements */}
          {job.otherRequirements && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Other Requirements</h2>
              <p className="text-gray-600 whitespace-pre-line">{job.otherRequirements}</p>
            </div>
          )}

          {/* Contact Information */}
          <div>
            <h2 className="text-xl font-semibold mb-3">Contact Information</h2>
            <div className="space-y-2 text-gray-600">
              <p>Email: {job.applicationEmail}</p>
              {job.receiveEmails && <p className="text-sm text-gray-500">Receives application notifications</p>}
              {job.contactName && <p>Contact Person: {job.contactName}</p>}
              {job.website && (
                <p>
                  Website:{' '}
                  <a href={job.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {job.website}
                  </a>
                </p>
              )}
            </div>
          </div>

          {/* Social Media Links */}
          {job.socialMedia && Object.values(job.socialMedia).some(link => link) && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Social Media</h2>
              <div className="space-y-2 text-gray-600">
                {job.socialMedia.facebook && (
                  <p>
                    Facebook:{' '}
                    <a href={job.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {job.socialMedia.facebook}
                    </a>
                  </p>
                )}
                {job.socialMedia.twitter && (
                  <p>
                    Twitter:{' '}
                    <a href={job.socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {job.socialMedia.twitter}
                    </a>
                  </p>
                )}
                {job.socialMedia.linkedin && (
                  <p>
                    LinkedIn:{' '}
                    <a href={job.socialMedia.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {job.socialMedia.linkedin}
                    </a>
                  </p>
                )}
                {job.socialMedia.instagram && (
                  <p>
                    Instagram:{' '}
                    <a href={job.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {job.socialMedia.instagram}
                    </a>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pre-screening Questions */}
          {job.questions && job.questions.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Pre-screening Questions</h2>
              <div className="space-y-3">
                {job.questions.map((question, index) => (
                  <div key={question.id} className="border-b pb-3">
                    <p className="font-medium">{index + 1}. {question.question}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Type: {question.type === 'multiple_choice' ? 'Multiple Choice' : 'Yes/No'}
                      {question.required && ' • Required'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ViewEmployerJobs = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobsRemaining, setJobsRemaining] = useState(3);
  
  const auth = getAuth(app);
  const db = getDatabase(app);

  useEffect(() => {
    if (auth.currentUser) {
      const jobsRef = ref(db, `jobs/${auth.currentUser.uid}`);
      
      const unsubscribe = onValue(jobsRef, (snapshot) => {
        const jobsData = snapshot.val();
        if (jobsData) {
          const jobsList = Object.entries(jobsData).map(([id, data]) => ({
            id,
            ...data
          }));
          setJobs(jobsList);
          setJobsRemaining(Math.max(0, 3 - jobsList.length));
        } else {
          setJobs([]);
          setJobsRemaining(3);
        }
      });

      return () => unsubscribe();
    }
  }, [auth.currentUser, db]);

  const handleView = (job) => {
    setSelectedJob(job);
    setShowJobDetails(true);
  };

  const handleEdit = (jobId) => {
    setSelectedJobId(jobId);
    setShowEditForm(true);
  };

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">Manage Jobs</h1>
          <p className="text-gray-600 mt-1">{jobsRemaining} of 3 job posts remaining</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          disabled={jobsRemaining === 0}
          className="flex items-center px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-blue-900 disabled:opacity-50"
        >
          <Plus className="w-5 h-5 mr-2" />
          Post New Job
        </button>
      </div>

      {/* Job List */}
      {jobs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No jobs posted yet</p>
        </div>
      ) : (
        <JobList 
          jobs={jobs}
          onView={handleView}
          onEdit={handleEdit}
        />
      )}

      {/* Add Job Form Modal */}
      {showAddForm && (
        <AddEmployerJobs
          onClose={() => setShowAddForm(false)}
          jobsRemaining={jobsRemaining}
        />
      )}

      {/* Edit Job Form Modal */}
      {showEditForm && selectedJobId && (
        <EditEmployerJobs
          jobId={selectedJobId}
          onClose={() => {
            setShowEditForm(false);
            setSelectedJobId(null);
          }}
        />
      )}

      {/* Job Details Modal */}
      {showJobDetails && selectedJob && (
        <JobDetails
          job={selectedJob}
          onClose={() => {
            setShowJobDetails(false);
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
};

export default ViewEmployerJobs;