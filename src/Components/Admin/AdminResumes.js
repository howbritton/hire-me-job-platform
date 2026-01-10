import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, remove } from 'firebase/database';
import { getStorage, ref as storageRef, deleteObject } from 'firebase/storage';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { FaDownload, FaTrash, FaUser, FaEye, FaLock, FaSearch } from 'react-icons/fa';

const AdminResumes = () => {
  const [resumes, setResumes] = useState([]);
  const [filteredResumes, setFilteredResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalResumes: 0,
    privateProfiles: 0,
    publicProfiles: 0,
    completedProfiles: 0 // Add this to match dashboard
  });

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    visibility: 'all', // all, public, private
    dateRange: 'all', // all, today, week, month
    sortBy: 'newest' // newest, oldest, name
  });

  const db = getDatabase(app);
  const storage = getStorage(app);

  const fetchResumes = useCallback(async () => {
    try {
      const candidatesRef = ref(db, 'candidates');
      const snapshot = await get(candidatesRef);

      if (snapshot.exists()) {
        const candidatesData = Object.entries(snapshot.val())
          .filter(([_, data]) => data.profile?.resume?.url) // Check for resume URL specifically
          .map(([id, data]) => ({
            id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            isPublic: data.isPublic === true, // Explicit check for true (same as dashboard)
            profileStatus: data.profileStatus,
            profile: data.profile || {},
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          }));

        // Count completed profiles using same logic as dashboard
        const completedProfiles = candidatesData.filter(c => {
          return c.isPublic === true && 
                 (c.profileStatus === 'active' || c.profileStatus === 'completed') &&
                 c.profile?.resume?.url;
        }).length;

        setStats({
          totalResumes: candidatesData.length,
          privateProfiles: candidatesData.filter(c => !c.isPublic).length,
          publicProfiles: candidatesData.filter(c => c.isPublic).length,
          completedProfiles: completedProfiles
        });

        setResumes(candidatesData);
        setFilteredResumes(candidatesData);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching resumes:', error);
      toast.error('Error loading resumes');
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...resumes];

    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(resume => 
        `${resume.firstName} ${resume.lastName}`.toLowerCase().includes(searchLower) ||
        resume.email.toLowerCase().includes(searchLower) ||
        resume.profile.resume.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply visibility filter
    if (filters.visibility !== 'all') {
      filtered = filtered.filter(resume => 
        filters.visibility === 'public' ? resume.isPublic : !resume.isPublic
      );
    }

    // Apply date range filter
    const now = new Date();
    if (filters.dateRange !== 'all') {
      filtered = filtered.filter(resume => {
        const resumeDate = new Date(resume.updatedAt || resume.createdAt);
        switch (filters.dateRange) {
          case 'today':
            return resumeDate.toDateString() === now.toDateString();
          case 'week':
            const weekAgo = new Date(now.setDate(now.getDate() - 7));
            return resumeDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
            return resumeDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'newest':
          return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
        case 'oldest':
          return new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt);
        case 'name':
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        default:
          return 0;
      }
    });

    setFilteredResumes(filtered);
  }, [resumes, searchTerm, filters]);

  const handleDownload = async (resume) => {
    try {
      window.open(resume.profile.resume.url, '_blank');
    } catch (error) {
      console.error('Error downloading resume:', error);
      toast.error('Error downloading resume');
    }
  };

  const handleDelete = async (resume) => {
    if (window.confirm('Are you sure you want to delete this resume?')) {
      try {
        // Delete resume file from storage
        const fileUrl = new URL(resume.profile.resume.url);
        const filePath = decodeURIComponent(fileUrl.pathname.split('/o/')[1].split('?')[0]);
        const fileRef = storageRef(storage, filePath);
        await deleteObject(fileRef);

        // Update database
        await remove(ref(db, `candidates/${resume.id}/profile/resume`));
        
        toast.success('Resume deleted successfully');
        fetchResumes();
      } catch (error) {
        console.error('Error deleting resume:', error);
        toast.error('Error deleting resume');
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
      <h2 className="text-2xl font-bold text-blue-950 mb-6">Resume Management</h2>

      {/* Stats Section - Updated to match dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Total Resumes</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalResumes}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Public Profiles</h3>
          <p className="text-3xl font-bold text-green-600">{stats.publicProfiles}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Private Profiles</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.privateProfiles}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Completed Profiles</h3>
          <p className="text-3xl font-bold text-emerald-600">{stats.completedProfiles}</p>
          <p className="text-sm text-emerald-700 mt-1">Active + Resume</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by name, email, or file name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex gap-4">
            <select
              value={filters.visibility}
              onChange={(e) => setFilters(prev => ({ ...prev, visibility: e.target.value }))}
              className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Profiles</option>
              <option value="public">Public Only</option>
              <option value="private">Private Only</option>
            </select>

            <select
              value={filters.dateRange}
              onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
              className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
            </select>

            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
              className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {filteredResumes.length} of {resumes.length} resumes
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Candidate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resume Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Profile Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Updated
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredResumes.map((resume) => (
              <tr key={resume.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      {resume.profile.photo ? (
                        <img
                          src={resume.profile.photo.url}
                          alt={`${resume.firstName} ${resume.lastName}`}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-blue-950 flex items-center justify-center">
                          <FaUser className="h-6 w-6 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {resume.firstName} {resume.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {resume.email}
                      </div>
                      {/* Add profile status indicator */}
                      <div className="text-xs text-gray-400">
                        Status: {resume.profileStatus || 'Not set'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {resume.profile.resume.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    Uploaded: {new Date(resume.profile.resume.uploadedAt).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="space-y-1">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      resume.isPublic 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {resume.isPublic ? (
                        <FaEye className="mr-1" />
                      ) : (
                        <FaLock className="mr-1" />
                      )}
                      {resume.isPublic ? 'Public' : 'Private'}
                    </span>
                    {/* Show if this is a completed profile */}
                    {resume.isPublic && (resume.profileStatus === 'active' || resume.profileStatus === 'completed') && (
                      <div className="text-xs text-emerald-600 font-medium">
                        ✓ Completed Profile
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {new Date(resume.updatedAt || resume.createdAt).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(resume.updatedAt || resume.createdAt).toLocaleTimeString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleDownload(resume)}
                      className="text-blue-950 hover:text-blue-700 transition-colors"
                      title="Download Resume"
                    >
                      <FaDownload className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(resume)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                      title="Delete Resume"
                    >
                      <FaTrash className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredResumes.length === 0 && (
          <div className="text-center py-8">
            <FaSearch className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Resumes Found
            </h3>
            <p className="text-gray-500">
              {searchTerm || filters.visibility !== 'all' || filters.dateRange !== 'all'
                ? "No resumes match your search criteria. Try adjusting your filters."
                : "There are currently no candidate resumes in the system."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminResumes;