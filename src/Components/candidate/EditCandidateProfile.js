import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDatabase, ref, get, update } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { 
  FaCamera, 
  FaSave,
  FaTimes 
} from 'react-icons/fa';

// Form component for editing candidate profile
const EditCandidateProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = getDatabase(app);
  const storage = getStorage(app);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    middleInitial: '',
    lastName: '',
    email: '',
    phone: '',
    parish: '',
    employmentType: '',
    birthDate: '',
    gender: '',
    labourAvailability: 'no',
    address: '',
    profile: {
      isPublic: true,
      title: '',
      aboutMe: '',
      skills: [],
      education: [],
      workExperience: [],
    }
  });
  
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [skillInput, setSkillInput] = useState('');
  
  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileRef = ref(db, `candidates/${id}`);
        const snapshot = await get(profileRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          setProfile(data);
          
          // Transform data for form
          const initialFormData = {
            firstName: data.firstName || '',
            middleInitial: data.middleInitial || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            parish: data.parish || '',
            employmentType: data.employmentType || '',
            birthDate: data.birthDate || '',
            gender: data.gender || '',
            labourAvailability: data.labourAvailability || 'no',
            address: data.address || '',
            profile: {
              isPublic: data.profile?.isPublic !== false, // default to true
              title: data.profile?.title || '',
              aboutMe: data.profile?.aboutMe || '',
              skills: data.profile?.skills || [],
              education: data.profile?.education || [],
              workExperience: data.profile?.workExperience || [],
              // Keep existing references to files
              photo: data.profile?.photo || null,
              resume: data.profile?.resume || null,
              video: data.profile?.video || null,
            }
          };
          
          setFormData(initialFormData);
          
          // Set photo preview if it exists
          if (data.profile?.photo?.url) {
            setPhotoPreview(data.profile.photo.url);
          }
        } else {
          toast.error('Profile not found');
          navigate('/dashboard');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Error loading profile data');
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [id, db, navigate]);
  
  // Handle photo file change
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [section, field] = name.split('.');
      setFormData({
        ...formData,
        [section]: {
          ...formData[section],
          [field]: type === 'checkbox' ? checked : value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };
  
  // Handle skills management
  const addSkill = () => {
    if (skillInput.trim() !== '' && !formData.profile.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        profile: {
          ...formData.profile,
          skills: [...formData.profile.skills, skillInput.trim()]
        }
      });
      setSkillInput('');
    }
  };
  
  const removeSkill = (skillToRemove) => {
    setFormData({
      ...formData,
      profile: {
        ...formData.profile,
        skills: formData.profile.skills.filter(skill => skill !== skillToRemove)
      }
    });
  };
  
  // Handle education management
  const addEducation = () => {
    setFormData({
      ...formData,
      profile: {
        ...formData.profile,
        education: [
          ...formData.profile.education,
          { degree: '', institution: '', startDate: '', endDate: '', description: '' }
        ]
      }
    });
  };
  
  const updateEducation = (index, field, value) => {
    const updatedEducation = [...formData.profile.education];
    updatedEducation[index] = {
      ...updatedEducation[index],
      [field]: value
    };
    
    setFormData({
      ...formData,
      profile: {
        ...formData.profile,
        education: updatedEducation
      }
    });
  };
  
  const removeEducation = (index) => {
    setFormData({
      ...formData,
      profile: {
        ...formData.profile,
        education: formData.profile.education.filter((_, i) => i !== index)
      }
    });
  };
  
  // Handle work experience management
  const addWorkExperience = () => {
    setFormData({
      ...formData,
      profile: {
        ...formData.profile,
        workExperience: [
          ...formData.profile.workExperience,
          { position: '', company: '', startDate: '', endDate: '', description: '' }
        ]
      }
    });
  };
  
  const updateWorkExperience = (index, field, value) => {
    const updatedExperience = [...formData.profile.workExperience];
    updatedExperience[index] = {
      ...updatedExperience[index],
      [field]: value
    };
    
    setFormData({
      ...formData,
      profile: {
        ...formData.profile,
        workExperience: updatedExperience
      }
    });
  };
  
  const removeWorkExperience = (index) => {
    setFormData({
      ...formData,
      profile: {
        ...formData.profile,
        workExperience: formData.profile.workExperience.filter((_, i) => i !== index)
      }
    });
  };
  
  // Save profile function
  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Create a copy of the form data that we'll update with any file uploads
      const profileToSave = { ...formData };
      
      // Upload photo if changed
      if (photoFile) {
        const photoRef = storageRef(storage, `candidates/${id}/photo/${photoFile.name}`);
        await uploadBytes(photoRef, photoFile);
        const photoURL = await getDownloadURL(photoRef);
        
        profileToSave.profile.photo = {
          url: photoURL,
          filename: photoFile.name,
          contentType: photoFile.type,
          uploadedAt: new Date().toISOString()
        };
      }
      
      // Add update timestamps
      profileToSave.updatedAt = new Date().toISOString();
      
      // Remove any unnecessary properties that might cause validation errors
      const sanitizedProfile = sanitizeProfileData(profileToSave);
      
      // Update in the database
      const profileRef = ref(db, `candidates/${id}`);
      
      // Use update instead of set to preserve any fields we're not changing
      await update(profileRef, sanitizedProfile);
      
      toast.success('Profile updated successfully!');
      setSaving(false);
      
      // Redirect to view profile
      navigate(`/candidate/profile/${id}`);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(`Error updating profile: ${error.message}`);
      setSaving(false);
    }
  };
  
  // This function removes any undefined or problematic values from the profile data
  const sanitizeProfileData = (profileData) => {
    // Create a deep copy
    const sanitized = JSON.parse(JSON.stringify(profileData));
    
    // Clean arrays from null values
    if (sanitized.profile.skills) {
      sanitized.profile.skills = sanitized.profile.skills.filter(skill => skill !== null && skill !== undefined);
    }
    
    if (sanitized.profile.education) {
      sanitized.profile.education = sanitized.profile.education.filter(edu => edu !== null && edu !== undefined);
    }
    
    if (sanitized.profile.workExperience) {
      sanitized.profile.workExperience = sanitized.profile.workExperience.filter(exp => exp !== null && exp !== undefined);
    }
    
    return sanitized;
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-blue-950 mb-6">Edit Profile</h2>
      
      <form onSubmit={saveProfile}>
        {/* Basic Information */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Middle Initial</label>
              <input
                type="text"
                name="middleInitial"
                value={formData.middleInitial}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                maxLength={1}
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>
        </div>
        
        {/* Profile Visibility */}
        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="profile.isPublic"
              checked={formData.profile.isPublic}
              onChange={handleChange}
              className="mr-2 h-4 w-4"
            />
            <span className="text-gray-700">Make profile visible to employers</span>
          </label>
        </div>
        
        {/* Profile Photo */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Photo</h3>
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-500 text-4xl">
                    {formData.firstName?.[0]}
                  </span>
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 bg-blue-950 text-white rounded-full w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-blue-800">
                <FaCamera size={14} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
            <div className="text-sm text-gray-500">
              <p>Upload a professional photo</p>
              <p>Square format recommended, max 5MB</p>
            </div>
          </div>
        </div>
        
        {/* Contact Information */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Parish</label>
              <select
                name="parish"
                value={formData.parish}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">Select Parish</option>
                <option value="Kingston">Kingston</option>
                <option value="St. Andrew">St. Andrew</option>
                <option value="St. Catherine">St. Catherine</option>
                <option value="Clarendon">Clarendon</option>
                <option value="Manchester">Manchester</option>
                <option value="St. Elizabeth">St. Elizabeth</option>
                <option value="Westmoreland">Westmoreland</option>
                <option value="Hanover">Hanover</option>
                <option value="St. James">St. James</option>
                <option value="Trelawny">Trelawny</option>
                <option value="St. Ann">St. Ann</option>
                <option value="St. Mary">St. Mary</option>
                <option value="Portland">Portland</option>
                <option value="St. Thomas">St. Thomas</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Street Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
        
        {/* Personal Information */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">Birth Date</label>
              <input
                type="date"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Employment Type</label>
              <select
                name="employmentType"
                value={formData.employmentType}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">Select Type</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Freelance">Freelance</option>
                <option value="Internship">Internship</option>
                <option value="Casual">Casual</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Available for Strenuous Physical Labour</label>
              <select
                name="labourAvailability"
                value={formData.labourAvailability}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Professional Profile */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Professional Profile</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">Professional Title</label>
              <input
                type="text"
                name="profile.title"
                value={formData.profile.title}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="e.g. Senior Software Developer"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">About Me</label>
              <textarea
                name="profile.aboutMe"
                value={formData.profile.aboutMe}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md h-32"
                placeholder="Share your professional background, goals, and what makes you unique"
              ></textarea>
            </div>
          </div>
        </div>
        
        {/* Skills */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Skills</h3>
          <div className="flex mb-3">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              className="flex-grow p-2 border border-gray-300 rounded-l-md"
              placeholder="Add a skill"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
            />
            <button
              type="button"
              onClick={addSkill}
              className="bg-blue-950 text-white px-4 py-2 rounded-r-md hover:bg-blue-800"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {formData.profile.skills.map((skill, index) => (
              <div
                key={index}
                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="ml-2 text-blue-800 hover:text-blue-950"
                >
                  <FaTimes size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
        
        {/* Education */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Education</h3>
            <button
              type="button"
              onClick={addEducation}
              className="text-blue-950 hover:text-blue-800"
            >
              + Add Education
            </button>
          </div>
          
          <div className="space-y-6">
            {formData.profile.education.map((edu, index) => (
              <div key={index} className="border rounded-md p-4 relative">
                <button
                  type="button"
                  onClick={() => removeEducation(index)}
                  className="absolute top-2 right-2 text-gray-500 hover:text-red-600"
                >
                  <FaTimes />
                </button>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-gray-700 mb-2">Degree/Certificate</label>
                    <input
                      type="text"
                      value={edu.degree}
                      onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Institution</label>
                    <input
                      type="text"
                      value={edu.institution}
                      onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-gray-700 mb-2">Start Date</label>
                    <input
                      type="text"
                      value={edu.startDate}
                      onChange={(e) => updateEducation(index, 'startDate', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="e.g. Sept 2018"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">End Date (or Expected)</label>
                    <input
                      type="text"
                      value={edu.endDate}
                      onChange={(e) => updateEducation(index, 'endDate', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="e.g. May 2022 or Present"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-gray-700 mb-2">Description (Optional)</label>
                  <textarea
                    value={edu.description}
                    onChange={(e) => updateEducation(index, 'description', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    rows="2"
                  ></textarea>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Work Experience */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Work Experience</h3>
            <button
              type="button"
              onClick={addWorkExperience}
              className="text-blue-950 hover:text-blue-800"
            >
              + Add Experience
            </button>
          </div>
          
          <div className="space-y-6">
            {formData.profile.workExperience.map((exp, index) => (
              <div key={index} className="border rounded-md p-4 relative">
                <button
                  type="button"
                  onClick={() => removeWorkExperience(index)}
                  className="absolute top-2 right-2 text-gray-500 hover:text-red-600"
                >
                  <FaTimes />
                </button>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-gray-700 mb-2">Position</label>
                    <input
                      type="text"
                      value={exp.position}
                      onChange={(e) => updateWorkExperience(index, 'position', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Company</label>
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => updateWorkExperience(index, 'company', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-gray-700 mb-2">Start Date</label>
                    <input
                      type="text"
                      value={exp.startDate}
                      onChange={(e) => updateWorkExperience(index, 'startDate', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="e.g. Jan 2020"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">End Date</label>
                    <input
                      type="text"
                      value={exp.endDate}
                      onChange={(e) => updateWorkExperience(index, 'endDate', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="e.g. Dec 2022 or Present"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-gray-700 mb-2">Description</label>
                  <textarea
                    value={exp.description}
                    onChange={(e) => updateWorkExperience(index, 'description', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    rows="3"
                    placeholder="Describe your responsibilities and achievements"
                  ></textarea>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Form Actions */}
        <div className="mt-8 flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate(`/candidate/profile/${id}`)}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-950 text-white rounded-md hover:bg-blue-800 flex items-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <FaSave className="mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditCandidateProfile;