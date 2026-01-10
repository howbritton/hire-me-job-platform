import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage';
import { ref as dbRef, set, get, getDatabase } from 'firebase/database';
import { FaSpinner, FaPlus, FaTrash, FaExclamationCircle, FaFileAlt, FaImage, FaDownload } from 'react-icons/fa';

const MAX_RESUME_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;   // 5MB

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

const aboutMePlaceholder = `Share your professional story! Include:
• Your current role and years of experience
• Key areas of expertise and specializations
• Notable achievements and certifications
• What you're passionate about in your field
• Your career goals and aspirations
• Any unique skills or perspectives you bring
Keep it professional but let your personality shine through!`;

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
};

const ResumeUpload = () => {
  const [resumeData, setResumeData] = useState({
    aboutMe: '',
    skills: [],
    workExperience: [],
    education: [],
    firstName: '',
    lastName: '',
    email: '',
    video: {
      youtubeUrl: ''
    },
    resume: null, // For storing existing resume file data
    photo: null   // For storing existing photo file data
  });

  const [files, setFiles] = useState({
    resume: null,
    photo: null
  });

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [missingFields, setMissingFields] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');

  const auth = getAuth();
  const storage = getStorage();
  const database = getDatabase();

  const validateForm = (data, files) => {
    const missing = [];
    
    // Resume is required - check if either a new file is selected or an existing one is saved
    if (!files.resume && !data.resume?.url) {
      missing.push('Resume Document');
    }
    
    if (!data.aboutMe?.trim()) {
      missing.push('About Me');
    }
    
    if (!data.skills?.length) {
      missing.push('At least one skill');
    }

    setMissingFields(missing);
    return missing;
  };

  const setErrorAndScroll = (errorMessage) => {
    setError(errorMessage);
    setSuccessMessage('');
    scrollToTop();
  };

  const setSuccessAndScroll = (message) => {
    setSuccessMessage(message);
    setError('');
    scrollToTop();
  };

  const fetchUserData = async () => {
    try {
      setLoadingData(true);
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userRef = dbRef(database, `candidates/${userId}/profile`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        setResumeData(prev => ({
          ...prev,
          ...data,
          // Ensure skills is always an array
          skills: data.skills || []
        }));
      }
      setLoadingData(false);
    } catch (err) {
      setErrorAndScroll('Failed to fetch user data');
      console.error(err);
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (auth.currentUser) {
      fetchUserData();
    } else {
      setLoadingData(false);
    }
  }, [auth.currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileUpload = async (file, type) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setErrorAndScroll('User not authenticated');
        return null;
      }

      const timestamp = Date.now();
      const storagePath = `${type}s/${userId}/${timestamp}_${file.name}`;
      const fileRef = storageRef(storage, storagePath);
      
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      return {
        name: file.name,
        url,
        contentType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('Upload error:', err);
      setErrorAndScroll(`Failed to upload ${type}: ${err.message}`);
      return null;
    }
  };

  const validateFile = (file, type) => {
    const maxSizes = {
      resume: MAX_RESUME_SIZE,
      photo: MAX_PHOTO_SIZE
    };

    if (!file) {
      throw new Error('No file selected');
    }

    if (file.size > maxSizes[type]) {
      throw new Error(`File size exceeds maximum allowed for ${type}`);
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      validateFile(file, type);
      setFiles(prev => ({ ...prev, [type]: file }));
      setMissingFields(prev => prev.filter(field => field !== 'Resume Document'));
    } catch (err) {
      setErrorAndScroll(err.message);
      e.target.value = '';
    }
  };

  const handleSkillAdd = () => {
    setResumeData(prev => ({
      ...prev,
      skills: [...(prev.skills || []), '']
    }));
    setMissingFields(prev => prev.filter(field => field !== 'At least one skill'));
  };

  const handleSkillChange = (index, value) => {
    const newSkills = [...(resumeData.skills || [])];
    newSkills[index] = value;
    setResumeData(prev => ({
      ...prev,
      skills: newSkills
    }));
  };

  const handleSkillDelete = (index) => {
    const newSkills = resumeData.skills.filter((_, i) => i !== index);
    setResumeData(prev => ({
      ...prev,
      skills: newSkills
    }));
  };

  const handleWorkExperienceAdd = () => {
    setResumeData(prev => ({
      ...prev,
      workExperience: [
        ...(prev.workExperience || []),
        {
          company: '',
          position: '',
          startDate: '',
          endDate: '',
          description: ''
        }
      ]
    }));
  };

  const handleEducationAdd = () => {
    setResumeData(prev => ({
      ...prev,
      education: [
        ...(prev.education || []),
        {
          institution: '',
          degree: '',
          field: '',
          graduationYear: ''
        }
      ]
    }));
  };

  const handleSubmit = async () => {
    try {
      const missingFields = validateForm(resumeData, files);
      if (missingFields.length > 0) {
        setErrorAndScroll(`Please complete the following required fields: ${missingFields.join(', ')}`);
        return;
      }

      setLoading(true);
      setError('');

      const userId = auth.currentUser?.uid;
      if (!userId) {
        setErrorAndScroll('User not authenticated');
        return;
      }

      if (resumeData.video?.youtubeUrl && !getYouTubeVideoId(resumeData.video.youtubeUrl)) {
        setErrorAndScroll('Invalid YouTube URL format');
        return;
      }

      const updates = { ...resumeData };

      // Upload new files if selected
      for (const [type, file] of Object.entries(files)) {
        if (file) {
          const fileData = await handleFileUpload(file, type);
          if (!fileData) {
            setErrorAndScroll(`Failed to upload ${type}`);
            return;
          }
          updates[type] = fileData;
        }
      }

      // Calculate an expiry date (90 days from now)
      const currentDate = new Date();
      const expiryDate = new Date(currentDate);
      expiryDate.setDate(expiryDate.getDate() + 90);

      const userRef = dbRef(database, `candidates/${userId}/profile`);
      await set(userRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
        expirationNotificationSent: false
      });

      // Also update the candidate record to include expiry date
      const candidateRef = dbRef(database, `candidates/${userId}`);
      const candidateSnapshot = await get(candidateRef);
      if (candidateSnapshot.exists()) {
        await set(candidateRef, {
          ...candidateSnapshot.val(),
          updatedAt: new Date().toISOString(),
          expiryDate: expiryDate.toISOString(),
          expirationNotificationSent: false
        });
      }

      setFiles({
        resume: null,
        photo: null
      });

      document.querySelectorAll('input[type="file"]').forEach(input => input.value = '');
      
      setSuccessAndScroll('Profile updated successfully!');

    } catch (err) {
      setErrorAndScroll(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get file extension
  const getFileExtension = (filename) => {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  };

  // Clear file selection
  const clearFileSelection = (type) => {
    setFiles(prev => ({ ...prev, [type]: null }));
    document.getElementById(`${type}-upload`).value = '';
  };

  if (loadingData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  if (!auth.currentUser) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Please sign in to access this feature.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {error && (
        <div className="sticky top-0 z-50 bg-white shadow-md">
          <div className="p-4 rounded-md bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="sticky top-0 z-50 bg-white shadow-md">
          <div className="p-4 rounded-md bg-green-50 border border-green-200 text-green-700">
            {successMessage}
          </div>
        </div>
      )}

      {missingFields.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <FaExclamationCircle className="text-lg" />
            Please complete the following required fields:
          </div>
          <ul className="list-disc ml-8">
            {missingFields.map((field, index) => (
              <li key={index}>{field}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Resume <span className="text-red-500">*</span></h2>
        
        {/* Show current resume if it exists */}
        {resumeData.resume?.url && !files.resume && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaFileAlt className="text-blue-950 text-xl" />
                <div>
                  <p className="font-medium">{resumeData.resume.name}</p>
                  <p className="text-sm text-gray-500">Current resume document</p>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={resumeData.resume.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-sm bg-blue-950 text-white rounded-md hover:bg-blue-800 inline-flex items-center"
                >
                  <FaDownload className="mr-1" /> View
                </a>
              </div>
            </div>
          </div>
        )}
        
        <div className={`border-2 border-dashed rounded-lg p-6 text-center hover:border-gray-400 transition-colors
          ${!files.resume && !resumeData.resume?.url && missingFields.includes('Resume Document') ? 'border-red-300' : 'border-gray-300'}`}>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => handleFileChange(e, 'resume')}
            className="hidden"
            id="resume-upload"
          />
          <label htmlFor="resume-upload" className="cursor-pointer block">
            <p>{resumeData.resume?.url ? 'Upload a new resume (optional)' : 'Click to select your resume'}</p>
            <p className="text-sm text-gray-500">Supported formats: PDF, DOC, DOCX (Max 10MB)</p>
          </label>
        </div>
        {files.resume && (
          <div className="flex justify-between items-center text-sm text-gray-600 bg-gray-50 p-2 rounded">
            <span>New file: {files.resume.name}</span>
            <button 
              onClick={() => clearFileSelection('resume')}
              className="text-red-500 hover:text-red-700"
            >
              <FaTrash />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Profile Photo <span className="text-gray-400">(optional)</span></h2>
        
        {/* Show current photo if it exists */}
        {resumeData.photo?.url && !files.photo && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src={resumeData.photo.url} 
                alt="Current profile" 
                className="w-16 h-16 object-cover rounded-full"
              />
              <div>
                <p className="font-medium">Current profile photo</p>
                <p className="text-sm text-gray-500">{resumeData.photo.name}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(e, 'photo')}
            className="hidden"
            id="photo-upload"
          />
          <label htmlFor="photo-upload" className="cursor-pointer block">
            <p>{resumeData.photo?.url ? 'Upload a new photo (optional)' : 'Click to select your photo'}</p>
            <p className="text-sm text-gray-500">Supported formats: JPG, PNG, GIF, WEBP (Max 5MB)</p>
          </label>
        </div>
        {files.photo && (
          <div className="flex justify-between items-center text-sm text-gray-600 bg-gray-50 p-2 rounded">
            <div className="flex items-center gap-2">
              <img 
                src={URL.createObjectURL(files.photo)} 
                alt="Preview" 
                className="w-10 h-10 object-cover rounded-full"
              />
              <span>New file: {files.photo.name}</span>
            </div>
            <button 
              onClick={() => clearFileSelection('photo')}
              className="text-red-500 hover:text-red-700"
            >
              <FaTrash />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Introduction Video <span className="text-gray-400">(optional)</span></h2>
        <div className="space-y-4">
          <div>
            <input
              type="text"
              value={resumeData.video?.youtubeUrl || ''}
              onChange={(e) => setResumeData(prev => ({
                ...prev,
                video: {
                  youtubeUrl: e.target.value
                }
              }))}
              placeholder="Enter your YouTube video URL (e.g., https://www.youtube.com/watch?v=xxxx)"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Paste your YouTube video URL here. Make sure your video is public or unlisted.
            </p>
          </div>

          {resumeData.video?.youtubeUrl && (
            <div>
              {getYouTubeVideoId(resumeData.video.youtubeUrl) ? (
                <div className="aspect-video w-full">
                  <iframe
                    className="w-full h-full rounded-lg"
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(resumeData.video.youtubeUrl)}`}
                    title="Video Introduction Preview"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <p className="text-red-500">Invalid YouTube URL. Please check the format and try again.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">About Me <span className="text-red-500">*</span></h2>
        <textarea
          value={resumeData.aboutMe || ''}
          onChange={(e) => {
            setResumeData(prev => ({ ...prev, aboutMe: e.target.value }));
            if (e.target.value.trim()) {
              setMissingFields(prev => prev.filter(field => field !== 'About Me'));
            }
          }}
          placeholder={aboutMePlaceholder}
          className={`w-full h-48 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${!resumeData.aboutMe && missingFields.includes('About Me') ? 'border-red-300' : 'border-gray-300'}`}
        />
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Skills <span className="text-red-500">*</span></h2>
          <button
            onClick={handleSkillAdd}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
          >
            <FaPlus /> <span>Add Skill</span>
          </button>
        </div>
        <div className={`space-y-2 ${(!resumeData.skills || !resumeData.skills.length) && missingFields.includes('At least one skill') ? 'border-red-300 border-2 p-4 rounded-lg' : ''}`}>
          {resumeData.skills && resumeData.skills.map((skill, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={skill}
                onChange={(e) => handleSkillChange(index, e.target.value)}
                className="flex-grow p-2 border rounded"
                placeholder="Enter skill"
              />
              <button
                onClick={() => handleSkillDelete(index)}
                className="text-red-500 hover:text-red-600"
              >
                <FaTrash />
              </button>
            </div>
          ))}
          {(!resumeData.skills || !resumeData.skills.length) && (
            <p className="text-red-500 text-sm">Please add at least one skill</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Work Experience <span className="text-gray-400">(optional)</span></h2>
          <button
            onClick={handleWorkExperienceAdd}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
          >
            <FaPlus /> <span>Add Work Experience</span>
          </button>
        </div>
        {resumeData.workExperience && resumeData.workExperience.map((exp, index) => (
          <div key={index} className="space-y-4 p-4 border rounded-lg">
            <input
              type="text"
              value={exp.company || ''}
              onChange={(e) => {
                const newExp = [...(resumeData.workExperience || [])];
                newExp[index] = { ...exp, company: e.target.value };
                setResumeData(prev => ({ ...prev, workExperience: newExp }));
              }}
              className="w-full p-2 border rounded"
              placeholder="Company Name"
            />
            <input
              type="text"
              value={exp.position || ''}
              onChange={(e) => {
                const newExp = [...(resumeData.workExperience || [])];
                newExp[index] = { ...exp, position: e.target.value };
                setResumeData(prev => ({ ...prev, workExperience: newExp }));
              }}
              className="w-full p-2 border rounded"
              placeholder="Position"
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                <input
                  type="text"
                  value={exp.startDate || ''}
                  onChange={(e) => {
                    const newExp = [...(resumeData.workExperience || [])];
                    newExp[index] = { ...exp, startDate: e.target.value };
                    setResumeData(prev => ({ ...prev, workExperience: newExp }));
                  }}
                  className="w-full p-2 border rounded"
                  placeholder="e.g. Jan 2020"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">End Date (or "Present")</label>
                <input
                  type="text"
                  value={exp.endDate || ''}
                  onChange={(e) => {
                    const newExp = [...(resumeData.workExperience || [])];
                    newExp[index] = { ...exp, endDate: e.target.value };
                    setResumeData(prev => ({ ...prev, workExperience: newExp }));
                  }}
                  className="w-full p-2 border rounded"
                  placeholder="e.g. Dec 2022 or Present"
                />
              </div>
            </div>
            <textarea
              value={exp.description || ''}
              onChange={(e) => {
                const newExp = [...(resumeData.workExperience || [])];
                newExp[index] = { ...exp, description: e.target.value };
                setResumeData(prev => ({ ...prev, workExperience: newExp }));
              }}
              className="w-full p-2 border rounded"
              placeholder="Job Description"
              rows="3"
            />
            <button
              onClick={() => {
                const newExp = (resumeData.workExperience || []).filter((_, i) => i !== index);
                setResumeData(prev => ({ ...prev, workExperience: newExp }));
              }}
              className="text-red-500 hover:text-red-600 flex items-center space-x-2"
            >
              <FaTrash /> <span>Remove Experience</span>
            </button>
          </div>
        ))}
        {(!resumeData.workExperience || resumeData.workExperience.length === 0) && (
          <p className="text-gray-500 text-sm italic">No work experience added yet.</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Education <span className="text-gray-400">(optional)</span></h2>
          <button
            onClick={handleEducationAdd}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
          >
            <FaPlus /> <span>Add Education</span>
          </button>
        </div>
        {resumeData.education && resumeData.education.map((edu, index) => (
          <div key={index} className="space-y-4 p-4 border rounded-lg">
            <input
              type="text"
              value={edu.institution || ''}
              onChange={(e) => {
                const newEdu = [...(resumeData.education || [])];
                newEdu[index] = { ...edu, institution: e.target.value };
                setResumeData(prev => ({ ...prev, education: newEdu }));
              }}
              className="w-full p-2 border rounded"
              placeholder="Institution Name"
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                value={edu.degree || ''}
                onChange={(e) => {
                  const newEdu = [...(resumeData.education || [])];
                  newEdu[index] = { ...edu, degree: e.target.value };
                  setResumeData(prev => ({ ...prev, education: newEdu }));
                }}
                className="w-full p-2 border rounded"
                placeholder="Degree"
              />
              <input
                type="text"
                value={edu.field || ''}
                onChange={(e) => {
                  const newEdu = [...(resumeData.education || [])];
                  newEdu[index] = { ...edu, field: e.target.value };
                  setResumeData(prev => ({ ...prev, education: newEdu }));
                }}
                className="w-full p-2 border rounded"
                placeholder="Field of Study"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Graduation Year</label>
                <input
                  type="text"
                  value={edu.graduationYear || ''}
                  onChange={(e) => {
                    const newEdu = [...(resumeData.education || [])];
                    newEdu[index] = { ...edu, graduationYear: e.target.value };
                    setResumeData(prev => ({ ...prev, education: newEdu }));
                  }}
                  className="w-full p-2 border rounded"
                  placeholder="e.g. 2022"
                />
              </div>
            </div>
            <button
              onClick={() => {
                const newEdu = (resumeData.education || []).filter((_, i) => i !== index);
                setResumeData(prev => ({ ...prev, education: newEdu }));
              }}
              className="text-red-500 hover:text-red-600 flex items-center space-x-2"
            >
              <FaTrash /> <span>Remove Education</span>
            </button>
          </div>
        ))}
        {(!resumeData.education || resumeData.education.length === 0) && (
          <p className="text-gray-500 text-sm italic">No education added yet.</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`px-6 py-2 text-white rounded-md transition-colors flex items-center space-x-2 ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading && <FaSpinner className="animate-spin" />}
          <span>{loading ? 'Saving Changes...' : 'Save All Changes'}</span>
        </button>
      </div>
    </div>
  );
};

export default ResumeUpload;