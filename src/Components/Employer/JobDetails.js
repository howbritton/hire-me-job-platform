import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDatabase, ref, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { Building, MapPin, Briefcase, Calendar, GraduationCap, DollarSign } from 'lucide-react';

const JobDetails = () => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = getAuth(app);
  const db = getDatabase(app);

  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        const jobRef = ref(db, `jobs/${auth.currentUser.uid}/${id}`);
        const snapshot = await get(jobRef);
        
        if (snapshot.exists()) {
          setJob({ id: snapshot.key, ...snapshot.val() });
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching job details:', error);
        setLoading(false);
      }
    };

    if (auth.currentUser) {
      fetchJobDetails();
    }
  }, [id, auth.currentUser, db]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Job not found</h2>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-start mb-6">
        <h1 className="text-3xl font-bold text-blue-950">{job.jobTitle}</h1>
        <button
          onClick={() => navigate('/employer/jobs')}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Back to Jobs
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
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
  );
};

export default JobDetails;