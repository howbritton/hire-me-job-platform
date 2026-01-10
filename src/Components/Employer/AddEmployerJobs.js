import React, { useState, useEffect, useRef } from 'react';
import { getDatabase, ref, push, get, set } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../firebase';
import { X } from 'lucide-react';
import { toast } from 'react-toastify';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { FaImage, FaTrash } from 'react-icons/fa';
import { storage } from '../../firebase';

const LogoUpload = ({ currentLogo, onLogoChange }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const auth = getAuth();

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setUploading(true);
    try {
      // Create a unique path for the logo using employer ID and timestamp
      const fileName = `${auth.currentUser.uid}-${Date.now()}-${file.name}`;
      const logoRef = storageRef(storage, `company-logos/${fileName}`);
      
      // Upload the new image
      await uploadBytes(logoRef, file);
      const downloadURL = await getDownloadURL(logoRef);
      
      // If there's an existing logo, delete it
      if (currentLogo && currentLogo.includes('company-logos')) {
        try {
          // Extract the old file path from the URL
          const oldLogoRef = storageRef(storage, currentLogo);
          await deleteObject(oldLogoRef);
        } catch (error) {
          console.error('Error deleting old logo:', error);
        }
      }

      onLogoChange(downloadURL);
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentLogo) return;

    try {
      if (currentLogo.includes('company-logos')) {
        const logoRef = storageRef(storage, currentLogo);
        await deleteObject(logoRef);
      }
      onLogoChange('');
      toast.success('Logo removed successfully');
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Failed to remove logo');
    }
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
      <div className="flex items-start space-x-4">
        <div className="w-32 h-32 relative border rounded-lg overflow-hidden flex items-center justify-center bg-gray-50">
          {currentLogo ? (
            <img 
              src={currentLogo} 
              alt="Company logo" 
              className="w-full h-full object-cover"
            />
          ) : (
            <FaImage className="w-8 h-8 text-gray-400" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-[#cddd3a] hover:text-blue-950 disabled:opacity-50 transition-colors duration-200"
          >
            {uploading ? 'Uploading...' : 'Upload Logo'}
          </button>
          {currentLogo && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              disabled={uploading}
              className="px-4 py-2 flex items-center text-red-600 hover:text-red-700"
            >
              <FaTrash className="w-4 h-4 mr-2" />
              Remove Logo
            </button>
          )}
          <p className="text-sm text-gray-500">
            Recommended: Square image, max 2MB
          </p>
        </div>
      </div>
    </div>
  );
};

const AddEmployerJobs = ({ onClose, jobsRemaining }) => {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [employerEmail, setEmployerEmail] = useState('');
  const [subscriptionDetails, setSubscriptionDetails] = useState(null);
  const [formData, setFormData] = useState({
    jobTitle: '',
    description: '',
    companyName: '',
    companyLogo: '',
    parish: '',
    industry: '',
    degreeLevel: '',
    employmentType: 'Full-time',
    workType: 'On-site',
    experience: '',
    salary: '',
    otherRequirements: '',
    contactName: '',
    website: '',
    socialMedia: {
      facebook: '',
      twitter: '',
      linkedin: '',
      instagram: ''
    },
    questions: []
  });

  const auth = getAuth(app);
  const db = getDatabase(app);
  const functions = getFunctions(app);
  const notifyJobSubmission = httpsCallable(functions, 'notifyJobSubmission');

  useEffect(() => {
    const fetchEmployerData = async () => {
      try {
        if (!auth.currentUser) return;
        
        // Fetch employer data to get their email and subscription info
        const employerRef = ref(db, `employers/${auth.currentUser.uid}`);
        const snapshot = await get(employerRef);
        
        let email = '';
        
        if (snapshot.exists()) {
          const employerData = snapshot.val();
          email = employerData.email || auth.currentUser.email || '';
          
          // Only update if we got a valid email
          if (email) {
            console.log("Setting employer email:", email);
            setEmployerEmail(email);
          }
        } else if (auth.currentUser.email) {
          // Fallback to auth email if employer data doesn't exist
          email = auth.currentUser.email;
          setEmployerEmail(email);
        }
      } catch (error) {
        console.error('Error fetching employer data:', error);
      }
    };

    const fetchQuestions = async () => {
      try {
        if (!auth.currentUser) return;
        
        const questionsRef = ref(db, `employers/${auth.currentUser.uid}/questions`);
        const snapshot = await get(questionsRef);
        if (snapshot.exists()) {
          const questionsData = Object.entries(snapshot.val()).map(([id, data]) => ({
            id,
            ...data
          }));
          setQuestions(questionsData);
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
      }
    };

    if (auth.currentUser) {
      fetchEmployerData();
      fetchQuestions();
    }
  }, [auth.currentUser, db]);

  // Calculate expiration date based on subscription package
  const calculateExpirationDate = (subscription) => {
    const today = new Date();
    let expirationDate;

    // First try to use package duration
    if (subscription && subscription.package && subscription.package.duration) {
      expirationDate = new Date(today);
      expirationDate.setDate(today.getDate() + subscription.package.duration);
    } 
    // Fallback to subscription end date
    else if (subscription && subscription.endDate) {
      expirationDate = new Date(subscription.endDate);
    } 
    // Default fallback - 30 days from now
    else {
      expirationDate = new Date(today);
      expirationDate.setDate(today.getDate() + 30);
    }

    // Set time to end of day
    expirationDate.setHours(23, 59, 59, 999);
    
    return expirationDate;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (name.includes('socialMedia.')) {
      const socialMediaField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        socialMedia: {
          ...prev.socialMedia,
          [socialMediaField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleLogoChange = (logoUrl) => {
    setFormData(prev => ({
      ...prev,
      companyLogo: logoUrl
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!auth.currentUser) {
        throw new Error('Not authenticated');
      }

      if (jobsRemaining <= 0) {
        throw new Error('Job post limit reached');
      }

      // Set applicationEmail from employer data
      const applicationEmail = employerEmail || '';

      // Calculate expiration date based on subscription
      let formattedExpirationDate = null;
      const expirationDate = calculateExpirationDate(subscriptionDetails);
      formattedExpirationDate = expirationDate.toISOString();

      const pendingJobsRef = ref(db, `pending-jobs/${auth.currentUser.uid}`);
      const newJobRef = push(pendingJobsRef);
      
      const employerRef = ref(db, `employers/${auth.currentUser.uid}/profile`);
      const employerSnapshot = await get(employerRef);
      const employerData = employerSnapshot.exists() ? employerSnapshot.val() : null;

      const jobData = {
        ...formData,
        expirationDate: formattedExpirationDate,
        employerId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'pending',
        applications: 0,
        companyName: employerData?.companyName || formData.companyName,
        contactEmail: employerData?.email || applicationEmail,
        contactPhone: employerData?.phone || '',
        applicationEmail: applicationEmail,
        receiveEmails: true
      };

      // First save the job data
      await set(newJobRef, jobData);

      // Then notify admins about the new job submission
      try {
        await notifyJobSubmission(jobData);
        await fetch('https://api.hiremeja.com/api/notify/job-approval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company: jobData.companyName,
            position: jobData.jobTitle
          })
        });
      } catch (error) {
        console.error('Error sending admin notification:', error);
        // Don't throw here - we still want to consider the job submission successful
        // even if the notification fails
      }

      onClose();
      toast.success('Job submitted for approval! Admin will review your submission.');
    } catch (error) {
      console.error('Error posting job:', error);
      toast.error(error.message === 'Job post limit reached' 
        ? 'You have reached your job posting limit' 
        : 'Error submitting job. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center overflow-y-auto p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl mt-20 mb-8 relative">
        <div className="sticky top-0 bg-white p-6 border-b rounded-t-lg z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-blue-950">Post New Job</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Your job posting will be reviewed by our admin team before being published.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <LogoUpload
            currentLogo={formData.companyLogo}
            onLogoChange={handleLogoChange}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
              <input
                type="text"
                name="jobTitle"
                required
                value={formData.jobTitle}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input
                type="text"
                name="companyName"
                required
                value={formData.companyName}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              name="description"
              required
              value={formData.description}
              onChange={handleChange}
              rows={6}
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parish *</label>
              <select
                name="parish"
                required
                value={formData.parish}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Parish</option>
                <option value="Kingston">Kingston</option>
                <option value="Saint Andrew">Saint Andrew</option>
                <option value="Saint Catherine">Saint Catherine</option>
                <option value="Clarendon">Clarendon</option>
                <option value="Manchester">Manchester</option>
                <option value="Saint Elizabeth">Saint Elizabeth</option>
                <option value="Westmoreland">Westmoreland</option>
                <option value="Saint James">Saint James</option>
                <option value="Trelawny">Trelawny</option>
                <option value="Saint Ann">Saint Ann</option>
                <option value="Saint Mary">Saint Mary</option>
                <option value="Portland">Portland</option>
                <option value="Saint Thomas">Saint Thomas</option>
                <option value="Hanover">Hanover</option>
                <option value="Remote">Remote</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry *</label>
              <select
                name="industry"
                required
                value={formData.industry}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Industry</option>
                <option value="Technology">Technology</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Finance">Finance</option>
                <option value="Education">Education</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Retail">Retail</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Required Degree Level *</label>
              <select
                name="degreeLevel"
                required
                value={formData.degreeLevel}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Degree Level</option>
                <option value="None Required">None Required</option>
                <option value="High School/Equivalent">High School/Equivalent</option>
                <option value="Associate's Degree">Associate's Degree</option>
                <option value="Bachelor's Degree">Bachelor's Degree</option>
                <option value="Master's Degree">Master's Degree</option>
                <option value="Doctorate">Doctorate</option>
                <option value="Professional Certification">Professional Certification</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Type *</label>
              <select
                name="workType"
                required
                value={formData.workType}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="On-site">On-site</option>
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type *</label>
              <select
                name="employmentType"
                required
                value={formData.employmentType}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="full-time">Full Time</option>
                <option value="part-time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
                <option value="Volunteer">Volunteer</option>
                <option value="Freelance">Freelance</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience *</label>
              <select
                name="experience"
                required
                value={formData.experience}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Experience Level</option>
                <option value="Entry Level">Entry Level (0+)</option>
                <option value="1+ years">1+ years</option>
                <option value="2+ years">2+ years</option>
                <option value="3+ years">3+ years</option>
                <option value="5+ years">5+ years</option>
                <option value="7+ years">7+ years</option>
                <option value="10+ years">10+ years</option>
                <option value="15+ years">15+ years</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
            <input
              type="text"
              name="salary"
              value={formData.salary}
              onChange={handleChange}
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. $50,000 - $70,000 per year"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Other Requirements</label>
            <textarea
              name="otherRequirements"
              value={formData.otherRequirements}
              onChange={handleChange}
              rows={4}
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pre-screening Questions</label>
            <div className="space-y-2">
              {questions.map((question) => (
                <div key={question.id} className="flex items-start">
                  <input
                    type="checkbox"
                    id={question.id}
                    onChange={(e) => {
                      const updatedQuestions = e.target.checked
                        ? [...formData.questions, question]
                        : formData.questions.filter(q => q.id !== question.id);
                      setFormData(prev => ({
                        ...prev,
                        questions: updatedQuestions
                      }));
                    }}
                    checked={formData.questions.some(q => q.id === question.id)}
                    className="mt-1 mr-2"
                  />
                  <label htmlFor={question.id} className="text-sm text-gray-600">
                    {question.question}
                    <span className="ml-2 text-xs text-gray-400">
                      ({question.type === 'multiple_choice' ? 'Multiple Choice' : 'Yes/No'})
                      {question.required && ' • Required'}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Application Email section removed */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input
                type="text"
                name="contactName"
                value={formData.contactName}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
              <input
                type="url"
                name="socialMedia.facebook"
                value={formData.socialMedia.facebook}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="https://facebook.com/company"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Twitter</label>
              <input
                type="url"
                name="socialMedia.twitter"
                value={formData.socialMedia.twitter}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="https://twitter.com/company"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
              <input
                type="url"
                name="socialMedia.linkedin"
                value={formData.socialMedia.linkedin}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="https://linkedin.com/company"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
              <input
                type="url"
                name="socialMedia.instagram"
                value={formData.socialMedia.instagram}
                onChange={handleChange}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="https://instagram.com/company"
              />
            </div>
          </div>

          <div className="sticky bottom-0 bg-white pt-4 border-t mt-6">
            <div className="flex flex-col-reverse md:flex-row md:justify-between md:items-center gap-4">
              <div className="text-sm text-gray-600">
                All job postings require admin approval before being published
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-950 text-white rounded-md hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEmployerJobs;