import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { ref as dbRef, get, getDatabase } from 'firebase/database';
import { 
  FaEnvelope, FaCalendar, FaBuilding, FaGraduationCap, FaEdit, 
  FaPhone, FaMapMarkerAlt, FaBriefcase, FaVideo,
  FaFileAlt, FaUser, FaImage, FaExclamationCircle
} from 'react-icons/fa';
import { Link } from 'react-router-dom';

const getYouTubeVideoId = (url) => {
  if (!url) return null;
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^/?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^/?]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const CandidatePersonalResume = () => {
  const [resumeData, setResumeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missingFields, setMissingFields] = useState([]);

  const auth = getAuth();
  const database = getDatabase();

  const validateRequiredFields = (data) => {
    const required = [
      { field: 'firstName', label: 'First Name' },
      { field: 'lastName', label: 'Last Name' },
      { field: 'email', label: 'Email' },
      { field: 'phone', label: 'Phone' },
      { field: 'parish', label: 'Parish' },
      { field: 'employmentType', label: 'Employment Type' },
      { field: ['profile', 'resume'], label: 'Resume Document' },
      { field: ['profile', 'aboutMe'], label: 'About Me' },
      { field: ['profile', 'skills'], label: 'Skills' }
    ];

    const missing = required.filter(({ field, label }) => {
      if (Array.isArray(field)) {
        return !field.reduce((obj, key) => obj?.[key], data);
      }
      return !data[field];
    });

    setMissingFields(missing);
    return missing.length === 0;
  };

  useEffect(() => {
    const fetchResumeData = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          setError('Please sign in to view your resume');
          setLoading(false);
          return;
        }

        const userRef = dbRef(database, `candidates/${userId}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
          const userData = snapshot.val();
          setResumeData(userData);
          validateRequiredFields(userData);
        } else {
          setError('No resume data found');
        }
      } catch (err) {
        console.error('Error:', err);
        setError('Failed to fetch resume data');
      } finally {
        setLoading(false);
      }
    };

    fetchResumeData();
  }, [auth.currentUser, database]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  if (!resumeData) {
    return (
      <div className="text-center py-8">
        <Link to="/candidate/resume/edit" className="inline-flex items-center px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors duration-200">
          <FaEdit className="mr-2" />
          Create Your Resume
        </Link>
      </div>
    );
  }

  const formatEmploymentType = (type) => {
    if (!type) return '';
    return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="space-y-8 bg-white rounded-lg shadow-md p-6">
      {missingFields.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <FaExclamationCircle className="text-lg" />
            Please complete the following required fields:
          </div>
          <ul className="list-disc ml-8">
            {missingFields.map(({ label }, index) => (
              <li key={index}>{label}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-950">Personal Resume</h1>
        <Link to="/candidate/resume/edit" className="inline-flex items-center px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors duration-200">
          <FaEdit className="mr-2" />
          Edit Resume
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
            <FaImage />
            <span>Profile Photo <span className="text-sm text-gray-500">(optional)</span></span>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg min-h-[200px] flex items-center justify-center">
            {resumeData.profile?.photo?.url ? (
              <img 
                src={resumeData.profile.photo.url}
                alt={`${resumeData.firstName} ${resumeData.lastName}`}
                className="max-w-full max-h-[200px] rounded-lg object-cover"
              />
            ) : (
              <span className="text-gray-400">No profile photo uploaded</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
            <FaVideo />
            <span>Video Introduction <span className="text-sm text-gray-500">(optional)</span></span>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg min-h-[200px] flex items-center justify-center">
            {resumeData.profile?.video?.youtubeUrl && getYouTubeVideoId(resumeData.profile.video.youtubeUrl) ? (
              <div className="w-full aspect-video">
                <iframe
                  className="w-full h-full rounded-lg"
                  src={`https://www.youtube.com/embed/${getYouTubeVideoId(resumeData.profile.video.youtubeUrl)}`}
                  title="Video Introduction"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <span className="text-gray-400">No video introduction provided</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
          <FaUser />
          <h2>Basic Information</h2>
        </div>
        <div className={`bg-gray-50 p-4 rounded-lg ${(!resumeData.firstName || !resumeData.lastName) ? 'ring-2 ring-red-500' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Full Name: <span className="text-red-500">*</span></span>
              <span>
                {resumeData.firstName} {resumeData.middleInitial && `${resumeData.middleInitial}.`} {resumeData.lastName}
              </span>
            </div>
            
            <div className={`flex items-center gap-2 ${!resumeData.email ? 'ring-2 ring-red-500 p-2 rounded' : ''}`}>
              <FaEnvelope className="text-blue-950" />
              <span className="font-semibold">Email: <span className="text-red-500">*</span></span>
              <span>{resumeData.email}</span>
            </div>
            
            <div className={`flex items-center gap-2 ${!resumeData.phone ? 'ring-2 ring-red-500 p-2 rounded' : ''}`}>
              <FaPhone className="text-blue-950" />
              <span className="font-semibold">Phone: <span className="text-red-500">*</span></span>
              <span>{resumeData.phone}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <FaMapMarkerAlt className="text-blue-950" />
              <span className="font-semibold">Address: <span className="text-gray-400">(optional)</span></span>
              <span>{resumeData.address}</span>
            </div>
            
            <div className={`flex items-center gap-2 ${!resumeData.parish ? 'ring-2 ring-red-500 p-2 rounded' : ''}`}>
              <FaMapMarkerAlt className="text-blue-950" />
              <span className="font-semibold">Parish: <span className="text-red-500">*</span></span>
              <span>{resumeData.parish}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
          <FaBriefcase />
          <h2>Employment Details</h2>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg ${!resumeData.employmentType ? 'ring-2 ring-red-500' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Employment Type: <span className="text-red-500">*</span></span>
            <span>{formatEmploymentType(resumeData.employmentType)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="font-semibold">Gender: <span className="text-gray-400">(optional)</span></span>
            <span>{resumeData.gender && resumeData.gender.charAt(0).toUpperCase() + resumeData.gender.slice(1)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="font-semibold">Birth Date: <span className="text-gray-400">(optional)</span></span>
            <span>{resumeData.birthDate && new Date(resumeData.birthDate).toLocaleDateString()}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="font-semibold">Physical Labour: <span className="text-gray-400">(optional)</span></span>
            <span>
              {resumeData.labourAvailability?.toLowerCase() === 'yes' ? 'Available' : 'Not Available'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
          <FaUser />
          <h2>About Me <span className="text-red-500">*</span></h2>
        </div>
        <div className={`bg-gray-50 p-4 rounded-lg ${!resumeData.profile?.aboutMe ? 'ring-2 ring-red-500' : ''}`}>
          {resumeData.profile?.aboutMe ? (
            <p className="whitespace-pre-line text-gray-700">{resumeData.profile.aboutMe}</p>
          ) : (
            <span className="text-red-500">Please add an about me section</span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
          <FaGraduationCap />
          <h2>Skills <span className="text-red-500">*</span></h2>
        </div>
        <div className={`bg-gray-50 p-4 rounded-lg ${!resumeData.profile?.skills?.length ? 'ring-2 ring-red-500' : ''}`}>
          {resumeData.profile?.skills && resumeData.profile.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {resumeData.profile.skills.map((skill, index) => (
                <span key={index} className="px-3 py-1 bg-[#cddd3a] text-blue-950 rounded-full text-sm font-medium">
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-red-500">Please add at least one skill</span>
          )}
        </div>
      </div>

      {resumeData.profile?.workExperience && resumeData.profile.workExperience.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
            <FaBuilding />
            <h2>Work Experience <span className="text-gray-400">(optional)</span></h2>
          </div>
          {resumeData.profile.workExperience.map((exp, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <FaBuilding className="text-blue-950" />
                <h3 className="text-xl font-semibold text-blue-950">{exp.position}</h3>
              </div>
              <div className="text-gray-600">
                <span className="font-medium">{exp.company}</span>
                <span className="mx-2">•</span>
                <span className="flex items-center gap-1">
                  <FaCalendar className="inline text-blue-950" />
                  {exp.startDate} - {exp.endDate || 'Present'}
                </span>
              </div>
              <p className="whitespace-pre-line text-gray-700">{exp.description}</p>
            </div>
          ))}
        </div>
      )}

      {resumeData.profile?.education && resumeData.profile.education.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
            <FaGraduationCap />
            <h2>Education <span className="text-gray-400">(optional)</span></h2>
          </div>
          {resumeData.profile.education.map((edu, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <FaGraduationCap className="text-blue-950" />
                <h3 className="text-xl font-semibold text-blue-950">{edu.institution}</h3>
              </div>
              <div className="text-gray-600">
                <span>{edu.degree} in {edu.field}</span>
                <span className="mx-2">•</span>
                <span>Class of {edu.graduationYear}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
          <FaFileAlt />
          <h2>Documents <span className="text-red-500">*</span></h2>
        </div>
        <div className={`bg-gray-50 p-4 rounded-lg ${!resumeData.profile?.resume?.url ? 'ring-2 ring-red-500' : ''}`}>
          <div className="space-y-4">
            {resumeData.profile?.resume?.url ? (
              <a
                href={resumeData.profile.resume.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors duration-200"
              >
                <FaFileAlt className="mr-2" />
                View Full Resume
              </a>
            ) : (
              <span className="text-red-500">Please upload your resume document</span>
            )}

            {resumeData.profile?.documents && resumeData.profile.documents.map((doc, index) => (
              <div key={index} className="flex items-center gap-2">
                <FaFileAlt className="text-blue-950" />
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-950 hover:text-[#cddd3a]"
                >
                  {doc.name}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(!resumeData.profile?.workExperience?.length && 
        !resumeData.profile?.education?.length && 
        !resumeData.profile?.skills?.length) && (
        <div className="mt-8 p-4 bg-blue-50 text-blue-950 rounded-lg">
          <p className="text-center">
            Want to add work experience, education, and skills? 
            <Link 
              to="/candidate/resume/edit" 
              className="ml-2 text-blue-950 font-bold hover:text-[#cddd3a]"
            >
              Complete your resume →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
};

export default CandidatePersonalResume;  