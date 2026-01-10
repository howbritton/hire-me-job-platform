import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, set, remove, push } from 'firebase/database';
import { app } from '../../firebase';
import { toast } from 'react-toastify';

const Packages = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPackage, setCurrentPackage] = useState({
    name: '',
    duration: '',
    price: '',
    jobPostLimit: 1,
    features: {
      accessCandidateList: false,
      allowJobPosting: false,
      emailBlast: false,
      socialMediaBlast: false,
      addPreScreeningQuestions: false
    },
    status: 'active'
  });

  const db = getDatabase(app);

  const fetchPackages = useCallback(async () => {
    try {
      const packagesSnap = await get(ref(db, 'packages'));
      if (packagesSnap.exists()) {
        const packagesData = Object.entries(packagesSnap.val()).map(([id, data]) => ({
          id,
          ...data
        }));
        setPackages(packagesData);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error('Error loading packages');
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentPackage(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFeatureToggle = (featureName) => {
    setCurrentPackage(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [featureName]: !prev.features[featureName]
      }
    }));
  };

  const resetForm = () => {
    setCurrentPackage({
      name: '',
      duration: '',
      price: '',
      jobPostLimit: 1,
      features: {
        accessCandidateList: false,
        allowJobPosting: false,
        emailBlast: false,
        socialMediaBlast: false,
        addPreScreeningQuestions: false
      },
      status: 'active'
    });
    setIsEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const packageData = {
        ...currentPackage,
        price: parseFloat(currentPackage.price),
        duration: parseInt(currentPackage.duration),
        jobPostLimit: parseInt(currentPackage.jobPostLimit),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (isEditing && currentPackage.id) {
        await set(ref(db, `packages/${currentPackage.id}`), packageData);
        toast.success('Package updated successfully');
      } else {
        await push(ref(db, 'packages'), packageData);
        toast.success('Package created successfully');
      }

      resetForm();
      fetchPackages();
    } catch (error) {
      console.error('Error saving package:', error);
      toast.error('Error saving package');
    }
  };

  const handleEdit = (pkg) => {
    setCurrentPackage(pkg);
    setIsEditing(true);
  };

  const handleDelete = async (packageId) => {
    if (window.confirm('Are you sure you want to delete this package?')) {
      try {
        await remove(ref(db, `packages/${packageId}`));
        toast.success('Package deleted successfully');
        fetchPackages();
      } catch (error) {
        console.error('Error deleting package:', error);
        toast.error('Error deleting package');
      }
    }
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-950">Packages</h2>
      </div>

      {/* Package Form */}
      <form onSubmit={handleSubmit} className="mb-8 bg-gray-50 p-6 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Package Name*
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentPackage.name}
              onChange={handleInputChange}
              placeholder="e.g., Basic Package"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (days)*
            </label>
            <input
              type="number"
              name="duration"
              required
              min="1"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentPackage.duration}
              onChange={handleInputChange}
              placeholder="e.g., 30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price ($)*
            </label>
            <input
              type="number"
              name="price"
              required
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentPackage.price}
              onChange={handleInputChange}
              placeholder="e.g., 99.99"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Post Limit*
            </label>
            <input
              type="number"
              name="jobPostLimit"
              required
              min="-1"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentPackage.jobPostLimit}
              onChange={handleInputChange}
              placeholder="Enter -1 for unlimited"
            />
            <p className="text-xs text-gray-500 mt-1">Enter -1 for unlimited posts</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="status"
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentPackage.status}
              onChange={handleInputChange}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Features
            </label>
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="accessCandidateList"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={currentPackage.features.accessCandidateList}
                  onChange={() => handleFeatureToggle('accessCandidateList')}
                />
                <label htmlFor="accessCandidateList" className="ml-2 text-gray-700">
                  Access Candidate List
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allowJobPosting"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={currentPackage.features.allowJobPosting}
                  onChange={() => handleFeatureToggle('allowJobPosting')}
                />
                <label htmlFor="allowJobPosting" className="ml-2 text-gray-700">
                  Allow Job Posting
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="emailBlast"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={currentPackage.features.emailBlast}
                  onChange={() => handleFeatureToggle('emailBlast')}
                />
                <label htmlFor="emailBlast" className="ml-2 text-gray-700">
                  Email Blast
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="socialMediaBlast"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={currentPackage.features.socialMediaBlast}
                  onChange={() => handleFeatureToggle('socialMediaBlast')}
                />
                <label htmlFor="socialMediaBlast" className="ml-2 text-gray-700">
                  Social Media Post
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="addPreScreeningQuestions"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={currentPackage.features.addPreScreeningQuestions}
                  onChange={() => handleFeatureToggle('addPreScreeningQuestions')}
                />
                <label htmlFor="addPreScreeningQuestions" className="ml-2 text-gray-700">
                  Add Pre-Screening Questions
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {isEditing ? 'Update Package' : 'Create Package'}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Packages Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Package Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Job Posts
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Features
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {packages.map((pkg) => (
              <tr key={pkg.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{pkg.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{pkg.duration} days</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">${pkg.price}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {pkg.jobPostLimit === -1 ? 'Unlimited' : pkg.jobPostLimit}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {pkg.features.accessCandidateList && <div>• Access Candidate List</div>}
                    {pkg.features.allowJobPosting && <div>• Allow Job Posting</div>}
                    {pkg.features.emailBlast && <div>• Email Blast</div>}
                    {pkg.features.socialMediaBlast && <div>• Social Media Post</div>}
                    {pkg.features.addPreScreeningQuestions && <div>• Pre-Screening Questions</div>}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    pkg.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {pkg.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleEdit(pkg)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(pkg.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {packages.length === 0 && (
        <div className="text-center py-4">
          <p className="text-gray-500">No packages found</p>
        </div>
      )}
    </div>
  );
};

export default Packages;