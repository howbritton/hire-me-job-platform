import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  FaEnvelope, FaCalendar, FaBuilding, FaGraduationCap, FaEye, 
  FaPhone, FaMapMarkerAlt, FaBriefcase, FaVideo,
  FaFileAlt, FaUser, FaImage, FaArrowLeft, FaTimes
} from 'react-icons/fa';

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

const CandidateDetailModal = ({ candidate, onClose }) => {
  const formatEmploymentType = (type) => {
    if (!type) return '';
    return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-blue-950">
            {candidate.firstName} {candidate.lastName} - Profile Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Profile Photo and Video */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
                <FaImage />
                <span>Profile Photo</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg min-h-[200px] flex items-center justify-center">
                {candidate.profile?.photo?.url ? (
                  <img 
                    src={candidate.profile.photo.url}
                    alt={`${candidate.firstName} ${candidate.lastName}`}
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
                <span>Video Introduction</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg min-h-[200px] flex items-center justify-center">
                {candidate.profile?.video?.youtubeUrl && getYouTubeVideoId(candidate.profile.video.youtubeUrl) ? (
                  <div className="w-full aspect-video">
                    <iframe
                      className="w-full h-full rounded-lg"
                      src={`https://www.youtube.com/embed/${getYouTubeVideoId(candidate.profile.video.youtubeUrl)}`}
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

          {/* Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
              <FaUser />
              <h3>Basic Information</h3>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Full Name:</span>
                  <span>
                    {candidate.firstName} {candidate.middleInitial && `${candidate.middleInitial}.`} {candidate.lastName}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <FaEnvelope className="text-blue-950" />
                  <span className="font-semibold">Email:</span>
                  <span>{candidate.email}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <FaPhone className="text-blue-950" />
                  <span className="font-semibold">Phone:</span>
                  <span>{candidate.phone}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <FaMapMarkerAlt className="text-blue-950" />
                  <span className="font-semibold">Address:</span>
                  <span>{candidate.address || 'Not provided'}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <FaMapMarkerAlt className="text-blue-950" />
                  <span className="font-semibold">Parish:</span>
                  <span>{candidate.parish}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Employment Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
              <FaBriefcase />
              <h3>Employment Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Employment Type:</span>
                <span>{formatEmploymentType(candidate.employmentType)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-semibold">Gender:</span>
                <span>{candidate.gender && candidate.gender.charAt(0).toUpperCase() + candidate.gender.slice(1)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-semibold">Birth Date:</span>
                <span>{candidate.birthDate && new Date(candidate.birthDate).toLocaleDateString()}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-semibold">Physical Labour:</span>
                <span>
                  {candidate.labourAvailability?.toLowerCase() === 'yes' ? 'Available' : 'Not Available'}
                </span>
              </div>
            </div>
          </div>

          {/* About Me */}
          {candidate.profile?.aboutMe && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
                <FaUser />
                <h3>About Me</h3>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="whitespace-pre-line text-gray-700">{candidate.profile.aboutMe}</p>
              </div>
            </div>
          )}

          {/* Skills */}
          {candidate.profile?.skills && candidate.profile.skills.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
                <FaGraduationCap />
                <h3>Skills</h3>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex flex-wrap gap-2">
                  {candidate.profile.skills.map((skill, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-950 rounded-full text-sm font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Work Experience */}
          {candidate.profile?.workExperience && candidate.profile.workExperience.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
                <FaBuilding />
                <h3>Work Experience</h3>
              </div>
              {candidate.profile.workExperience.map((exp, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <FaBuilding className="text-blue-950" />
                    <h4 className="text-xl font-semibold text-blue-950">{exp.position}</h4>
                  </div>
                  <div className="text-gray-600">
                    <span className="font-medium">{exp.company}</span>
                    <span className="mx-2">•</span>
                    <span className="flex items-center gap-1">
                      <FaCalendar className="inline text-blue-950" />
                      {exp.startDate} - {exp.endDate || 'Present'}
                    </span>
                  </div>
                  {exp.description && (
                    <p className="whitespace-pre-line text-gray-700">{exp.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Education */}
          {candidate.profile?.education && candidate.profile.education.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
                <FaGraduationCap />
                <h3>Education</h3>
              </div>
              {candidate.profile.education.map((edu, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <FaGraduationCap className="text-blue-950" />
                    <h4 className="text-xl font-semibold text-blue-950">{edu.institution}</h4>
                  </div>
                  <div className="text-gray-600">
                    <span>{edu.degree} {edu.field && `in ${edu.field}`}</span>
                    {edu.graduationYear && (
                      <>
                        <span className="mx-2">•</span>
                        <span>Class of {edu.graduationYear}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Documents */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-blue-950">
              <FaFileAlt />
              <h3>Documents</h3>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-4">
                {candidate.profile?.resume?.url ? (
                  <a
                    href={candidate.profile.resume.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                  >
                    <FaFileAlt className="mr-2" />
                    View Resume Document
                  </a>
                ) : (
                  <span className="text-gray-500">No resume document uploaded</span>
                )}

                {candidate.profile?.documents && candidate.profile.documents.map((doc, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <FaFileAlt className="text-blue-950" />
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-950 hover:underline"
                    >
                      {doc.name}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const CompletedProfilesList = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const navigate = useNavigate();
  const db = getDatabase(app);
  const auth = getAuth(app);

  const fetchCompletedProfiles = useCallback(async () => {
    try {
      const candidatesRef = ref(db, 'candidates');
      const snapshot = await get(candidatesRef);
      
      if (snapshot.exists()) {
        const completedProfiles = Object.entries(snapshot.val())
          .map(([id, data]) => ({
            id,
            ...data
          }))
          .filter(candidate => 
            candidate.isPublic === true && 
            (candidate.profileStatus === 'active' || candidate.profileStatus === 'completed') &&
            candidate.profile?.resume?.url
          );
        
        setCandidates(completedProfiles);
      } else {
        setCandidates([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching completed profiles:', error);
      toast.error('Error loading profiles');
      setLoading(false);
    }
  }, [db]);

  const handleViewDetails = async (candidateId) => {
    try {
      // Fetch the full candidate data including profile details
      const candidateRef = ref(db, `candidates/${candidateId}`);
      const snapshot = await get(candidateRef);
      
      if (snapshot.exists()) {
        setSelectedCandidate(snapshot.val());
      } else {
        toast.error('Candidate profile not found');
      }
    } catch (error) {
      console.error('Error fetching candidate details:', error);
      toast.error('Error loading candidate details');
    }
  };

  useEffect(() => {
    // Check admin access
    const checkAdminAccess = async () => {
      if (!auth.currentUser) {
        navigate('/admin-login');
        return;
      }

      try {
        const adminRef = ref(db, `admins/${auth.currentUser.uid}`);
        const snapshot = await get(adminRef);
        
        if (snapshot.exists()) {
          fetchCompletedProfiles();
        } else {
          toast.error('Access denied. Admin privileges required.');
          navigate('/admin-login');
        }
      } catch (error) {
        console.error('Error checking admin access:', error);
        navigate('/admin-login');
      }
    };

    checkAdminAccess();
  }, [auth.currentUser, db, navigate, fetchCompletedProfiles]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-blue-950">Completed Candidate Profiles</h2>
        <p className="text-gray-600">
          Candidates with public, active profiles and resumes ({candidates.length} total)
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-3 px-4 text-left">Name</th>
              <th className="py-3 px-4 text-left">Email</th>
              <th className="py-3 px-4 text-left">Phone</th>
              <th className="py-3 px-4 text-left">Parish</th>
              <th className="py-3 px-4 text-left">Employment Type</th>
              <th className="py-3 px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {candidates.length > 0 ? (
              candidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    {candidate.firstName} {candidate.lastName}
                  </td>
                  <td className="py-3 px-4">{candidate.email}</td>
                  <td className="py-3 px-4">{candidate.phone}</td>
                  <td className="py-3 px-4">{candidate.parish}</td>
                  <td className="py-3 px-4">
                    {candidate.employmentType ? 
                      candidate.employmentType.split('-').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ') : 'Not specified'
                    }
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleViewDetails(candidate.id)}
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <FaEye className="mr-1" />
                      View Profile
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-4 px-4 text-center text-gray-500" colSpan="6">
                  No completed profiles found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <CandidateDetailModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  );
};

export default CompletedProfilesList;