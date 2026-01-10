import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getDatabase, ref, get, update } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { 
  FaBriefcase, 
  FaMapMarkerAlt, 
  FaEnvelope, 
  FaPhone, 
  FaDownload, 
  FaCalendarAlt, 
  FaUserAlt,
  FaPlayCircle,
  FaPauseCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaDumbbell,
  FaExclamationTriangle,
  FaGraduationCap,
  FaHeart,
  FaRegHeart
} from 'react-icons/fa';

// Utility function to extract YouTube video ID
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

// Check if a profile is expiring soon (within 14 days)
const isProfileExpiringSoon = (profile) => {
  if (!profile.expiryDate) return false;
  
  const expiryDate = new Date(profile.expiryDate);
  const currentDate = new Date();
  const daysDifference = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
  
  return daysDifference <= 14 && daysDifference > 0;
};

const ViewCandidateProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const { id } = useParams();
  const db = getDatabase(app);
  const auth = getAuth(app);

  useEffect(() => {
    const fetchCandidateProfile = async () => {
      try {
        const profileRef = ref(db, `candidates/${id}`);
        const snapshot = await get(profileRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          // Only show if profile is public
          if (data.profile?.isPublic !== false) {
            setProfile(data);
          } else {
            toast.error('This profile is private');
          }
        } else {
          toast.error('Profile not found');
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Error loading profile data');
        setLoading(false);
      }
    };

    fetchCandidateProfile();
  }, [id, db]);

  // Check if this candidate is in favorites
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!auth.currentUser) return;
      
      try {
        const favoritesRef = ref(db, `employers/${auth.currentUser.uid}/favorites/${id}`);
        const snapshot = await get(favoritesRef);
        setIsFavorite(snapshot.exists());
      } catch (error) {
        console.error('Error checking favorite status:', error);
      }
    };

    checkFavoriteStatus();
  }, [id, db, auth.currentUser]);

  const handleVideoToggle = () => {
    const videoElement = document.getElementById('profileVideo');
    if (videoElement) {
      if (isPlaying) {
        videoElement.pause();
      } else {
        videoElement.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleFavorite = async () => {
    if (!auth.currentUser) {
      toast.error('You must be logged in to add favorites');
      return;
    }
    
    try {
      const favoritesRef = ref(db, `employers/${auth.currentUser.uid}/favorites`);
      
      if (isFavorite) {
        // Remove from favorites
        await update(favoritesRef, {
          [id]: null
        });
        setIsFavorite(false);
        toast.success('Removed from favorites');
      } else {
        // Add to favorites
        await update(favoritesRef, {
          [id]: true
        });
        setIsFavorite(true);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error updating favorite status:', error);
      toast.error('Error updating favorites');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Profile Not Available</h2>
        <p className="text-gray-600">This profile is either private or does not exist.</p>
      </div>
    );
  }

  // Check if video content exists to display
  const hasYouTubeVideo = profile.profile?.video?.youtubeUrl && getYouTubeVideoId(profile.profile.video.youtubeUrl);
  const hasDirectVideo = profile.profile?.video?.url;
  const showVideoSection = hasYouTubeVideo || hasDirectVideo;
  
  // Check if profile is expiring soon
  const expiringSoon = isProfileExpiringSoon(profile);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        {/* Profile Expiration Notice - only visible to profile owner */}
        {expiringSoon && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex items-center">
              <FaExclamationTriangle className="flex-shrink-0 h-5 w-5 text-yellow-400 mr-2" />
              <span className="text-yellow-700">
                This candidate's profile will expire soon. Some information may not be up to date.
              </span>
            </div>
          </div>
        )}

        {/* Profile Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            {profile.profile?.photo ? (
              <img
                src={profile.profile.photo.url}
                alt={`${profile.firstName} ${profile.lastName}`}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500 text-2xl">
                  {profile.firstName?.[0]}
                </span>
              </div>
            )}
            <div className="ml-4">
              <h2 className="text-2xl font-bold text-blue-950">
                {profile.firstName} {profile.middleInitial ? `${profile.middleInitial}. ` : ''}{profile.lastName}
              </h2>
              {profile.profile?.title && (
                <p className="text-lg text-gray-600">{profile.profile.title}</p>
              )}
            </div>
          </div>
          
          {/* Favorite Button */}
          <button
            onClick={toggleFavorite}
            className="text-red-500 hover:text-red-600 p-2 flex items-center"
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorite ? (
              <>
                <FaHeart size={24} />
                <span className="ml-2 hidden md:inline">Remove from Favorites</span>
              </>
            ) : (
              <>
                <FaRegHeart size={24} />
                <span className="ml-2 hidden md:inline">Add to Favorites</span>
              </>
            )}
          </button>
        </div>

        {/* Video Section - Only show if a valid video exists */}
        {showVideoSection && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Profile Video</h3>
            <div className="relative aspect-video w-full max-w-2xl mx-auto rounded-lg overflow-hidden">
              {hasYouTubeVideo ? (
                // YouTube Video
                <iframe
                  className="w-full h-full rounded-lg"
                  src={`https://www.youtube.com/embed/${getYouTubeVideoId(profile.profile.video.youtubeUrl)}`}
                  title="Video Introduction"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : hasDirectVideo && (
                // Direct video file
                <>
                  <video
                    id="profileVideo"
                    src={profile.profile.video.url}
                    className="w-full h-full object-contain"
                    controlsList="nodownload"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  >
                    Your browser does not support the video tag.
                  </video>
                  <button
                    onClick={handleVideoToggle}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 hover:bg-opacity-40 transition-opacity"
                  >
                    {isPlaying ? (
                      <FaPauseCircle className="w-16 h-16 text-white" />
                    ) : (
                      <FaPlayCircle className="w-16 h-16 text-white" />
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {profile.email && (
            <div className="flex items-center">
              <FaEnvelope className="mr-2 text-blue-950" />
              <span>{profile.email}</span>
            </div>
          )}
          {profile.phone && (
            <div className="flex items-center">
              <FaPhone className="mr-2 text-blue-950" />
              <span>{profile.phone}</span>
            </div>
          )}
          {profile.parish && (
            <div className="flex items-center">
              <FaMapMarkerAlt className="mr-2 text-blue-950" />
              <span>{profile.parish}</span>
            </div>
          )}
          {profile.employmentType && (
            <div className="flex items-center">
              <FaBriefcase className="mr-2 text-blue-950" />
              <span>{profile.employmentType}</span>
            </div>
          )}
          {profile.birthDate && (
            <div className="flex items-center">
              <FaCalendarAlt className="mr-2 text-blue-950" />
              <span>{new Date(profile.birthDate).toLocaleDateString()}</span>
            </div>
          )}
          {profile.gender && (
            <div className="flex items-center">
              <FaUserAlt className="mr-2 text-blue-950" />
              <span>{profile.gender}</span>
            </div>
          )}
          {profile.labourAvailability && (
            <div className="flex items-center">
              <FaDumbbell className="mr-2 text-blue-950" />
              <span>
                Available for strenuous physical labour: {' '}
                {profile.labourAvailability === 'yes' ? (
                  <span className="flex items-center text-green-600">
                    <FaCheckCircle className="ml-1 mr-1" /> Yes
                  </span>
                ) : (
                  <span className="flex items-center text-red-600">
                    <FaTimesCircle className="ml-1 mr-1" /> No
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* About Me */}
        {profile.profile?.aboutMe && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">About Me</h3>
            <p className="text-gray-600 whitespace-pre-line">{profile.profile.aboutMe}</p>
          </div>
        )}

        {/* Skills */}
        {profile.profile?.skills && profile.profile.skills.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {profile.profile.skills.map((skill, index) => (
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

        {/* Experience */}
        {profile.profile?.workExperience && profile.profile.workExperience.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Work Experience</h3>
            <div className="space-y-4">
              {profile.profile.workExperience.map((exp, index) => (
                <div key={index} className="border-l-2 border-blue-950 pl-4">
                  <h4 className="font-medium text-gray-900">{exp.position}</h4>
                  <p className="text-gray-600">{exp.company}</p>
                  <p className="text-sm text-gray-500">
                    {exp.startDate} - {exp.endDate || 'Present'}
                  </p>
                  <p className="text-gray-600 mt-2">{exp.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education - UPDATED to show graduation year */}
        {profile.profile?.education && profile.profile.education.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              <FaGraduationCap className="inline-block mr-2" />
              Education
            </h3>
            <div className="space-y-4">
              {profile.profile.education.map((edu, index) => (
                <div key={index} className="border-l-2 border-blue-950 pl-4">
                  <h4 className="font-medium text-gray-900">{edu.degree} {edu.field && `in ${edu.field}`}</h4>
                  <p className="text-gray-600">{edu.institution}</p>
                  
                  {/* Date display logic - show graduation year if available */}
                  <p className="text-sm text-gray-500">
                    {edu.startDate && (
                      <>
                        {edu.startDate} - {edu.endDate || 'Present'}
                      </>
                    )}
                    
                    {(!edu.startDate && !edu.endDate && edu.graduationYear) && (
                      <>Class of {edu.graduationYear}</>
                    )}
                    
                    {(edu.endDate && edu.graduationYear && !edu.endDate.includes(edu.graduationYear)) && (
                      <> (Graduated: {edu.graduationYear})</>
                    )}
                  </p>
                  
                  {edu.description && (
                    <p className="text-gray-600 mt-2">{edu.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resume Download */}
        {profile.profile?.resume && (
          <div className="mt-6">
            <a
              href={profile.profile.resume.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-blue-950 text-white rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors duration-200"
            >
              <FaDownload className="mr-2" />
              Download Resume
            </a>
          </div>
        )}

        {/* Additional Information */}
        <div className="mt-6 text-sm text-gray-500">
          <p>Profile last updated: {new Date(profile.updatedAt || profile.createdAt).toLocaleDateString()}</p>
          {profile.expiryDate && (
            <p>Profile valid until: {new Date(profile.expiryDate).toLocaleDateString()}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewCandidateProfile;