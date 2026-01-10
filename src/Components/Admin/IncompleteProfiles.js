import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get, update } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { 
  FaArrowLeft, 
  FaUserEdit, 
  FaEye, 
  FaEnvelope, 
  FaPhone, 
  FaFileUpload, 
  FaToggleOff,
  FaToggleOn,
  FaFilter,
  FaDownload,
  FaSearch,
  FaExclamationTriangle
} from 'react-icons/fa';
import toast, { Toaster } from 'react-hot-toast';

const IncompleteProfiles = () => {
  const [candidates, setCandidates] = useState([]);
  const [filteredCandidates, setFilteredCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const navigate = useNavigate();
  const db = getDatabase(app);
  const auth = getAuth(app);

  // Define incomplete profile types
  const getIncompleteReasons = (candidate) => {
    const reasons = [];
    
    // Check basic info
    if (!candidate.firstName || !candidate.lastName) {
      reasons.push('Missing name');
    }
    if (!candidate.email) {
      reasons.push('Missing email');
    }
    if (!candidate.phone) {
      reasons.push('Missing phone');
    }
    
    // Check resume
    if (!candidate.profile?.resume?.url) {
      reasons.push('No resume uploaded');
    }
    
    // Check public status
    if (candidate.isPublic !== true) {
      reasons.push('Profile not public');
    }
    
    // Check profile status
    if (candidate.profileStatus !== 'active' && candidate.profileStatus !== 'completed') {
      reasons.push('Profile not active');
    }
    
    // Check profile completeness
    if (!candidate.profile?.aboutMe) {
      reasons.push('Missing about me');
    }
    
    return reasons;
  };

  const fetchIncompleteProfiles = async () => {
    try {
      const candidatesRef = ref(db, 'candidates');
      const snapshot = await get(candidatesRef);
      
      if (snapshot.exists()) {
        const candidatesData = snapshot.val();
        const candidatesList = Object.entries(candidatesData).map(([id, data]) => ({
          id,
          ...data
        }));
        
        // Filter for incomplete profiles
        const incompleteProfiles = candidatesList.filter(candidate => {
          const hasBasicInfo = candidate.firstName && candidate.lastName && candidate.email && candidate.phone;
          const hasResume = candidate.profile?.resume?.url;
          const isPublicAndActive = candidate.isPublic === true && 
                                   (candidate.profileStatus === 'active' || candidate.profileStatus === 'completed');
          
          return !hasBasicInfo || !hasResume || !isPublicAndActive;
        });
        
        setCandidates(incompleteProfiles);
        setFilteredCandidates(incompleteProfiles);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching incomplete profiles:', error);
      toast.error('Error loading incomplete profiles');
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!auth.currentUser) {
        navigate('/admin-login');
        return;
      }

      try {
        const adminRef = ref(db, `admins/${auth.currentUser.uid}`);
        const snapshot = await get(adminRef);
        
        if (snapshot.exists()) {
          setIsAdmin(true);
          fetchIncompleteProfiles();
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
  }, [auth.currentUser, db, navigate]);

  // Filter and search functionality
  useEffect(() => {
    let filtered = candidates;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(candidate => 
        `${candidate.firstName || ''} ${candidate.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (candidate.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (candidate.phone || '').includes(searchTerm)
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(candidate => {
        const reasons = getIncompleteReasons(candidate);
        
        switch (filterType) {
          case 'no-basic-info':
            return reasons.some(r => ['Missing name', 'Missing email', 'Missing phone'].includes(r));
          case 'no-resume':
            return reasons.includes('No resume uploaded');
          case 'not-public':
            return reasons.includes('Profile not public');
          case 'not-active':
            return reasons.includes('Profile not active');
          case 'missing-profile':
            return reasons.includes('Missing about me');
          default:
            return true;
        }
      });
    }

    setFilteredCandidates(filtered);
  }, [searchTerm, filterType, candidates]);

  const handleMakePublic = async (candidateId) => {
    try {
      await update(ref(db, `candidates/${candidateId}`), {
        isPublic: true,
        updatedAt: new Date().toISOString()
      });
      
      toast.success('Profile made public successfully');
      fetchIncompleteProfiles(); // Refresh the list
    } catch (error) {
      console.error('Error making profile public:', error);
      toast.error('Error updating profile');
    }
  };

  const handleActivateProfile = async (candidateId) => {
    try {
      await update(ref(db, `candidates/${candidateId}`), {
        profileStatus: 'active',
        updatedAt: new Date().toISOString()
      });
      
      toast.success('Profile activated successfully');
      fetchIncompleteProfiles(); // Refresh the list
    } catch (error) {
      console.error('Error activating profile:', error);
      toast.error('Error updating profile');
    }
  };

  const exportToCSV = () => {
    const csvData = filteredCandidates.map(candidate => ({
      Name: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
      Email: candidate.email || '',
      Phone: candidate.phone || '',
      Parish: candidate.parish || '',
      'Created At': candidate.createdAt ? new Date(candidate.createdAt).toLocaleDateString() : '',
      'Profile Status': candidate.profileStatus || 'Not set',
      'Is Public': candidate.isPublic ? 'Yes' : 'No',
      'Has Resume': candidate.profile?.resume?.url ? 'Yes' : 'No',
      'Incomplete Reasons': getIncompleteReasons(candidate).join(', ')
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incomplete-profiles-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isAdmin || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 w-full">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link to="/admin" className="text-blue-950 hover:text-blue-700">
            <FaArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-blue-950 flex items-center">
              <FaUserEdit className="mr-2" />
              Incomplete Profiles
            </h2>
            <p className="text-gray-600">
              {filteredCandidates.length} of {candidates.length} incomplete profiles
            </p>
          </div>
        </div>
        
        <button
          onClick={exportToCSV}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
        >
          <FaDownload />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
          {/* Search */}
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Incomplete</option>
            <option value="no-basic-info">Missing Basic Info</option>
            <option value="no-resume">No Resume</option>
            <option value="not-public">Not Public</option>
            <option value="not-active">Not Active</option>
            <option value="missing-profile">Missing About Me</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <h3 className="font-semibold text-red-800">Missing Basic Info</h3>
          <p className="text-2xl font-bold text-red-600">
            {candidates.filter(c => getIncompleteReasons(c).some(r => 
              ['Missing name', 'Missing email', 'Missing phone'].includes(r)
            )).length}
          </p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <h3 className="font-semibold text-orange-800">No Resume</h3>
          <p className="text-2xl font-bold text-orange-600">
            {candidates.filter(c => getIncompleteReasons(c).includes('No resume uploaded')).length}
          </p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <h3 className="font-semibold text-yellow-800">Not Public</h3>
          <p className="text-2xl font-bold text-yellow-600">
            {candidates.filter(c => getIncompleteReasons(c).includes('Profile not public')).length}
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <h3 className="font-semibold text-purple-800">Not Active</h3>
          <p className="text-2xl font-bold text-purple-600">
            {candidates.filter(c => getIncompleteReasons(c).includes('Profile not active')).length}
          </p>
        </div>
      </div>

      {/* Profiles Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Candidate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Issues
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCandidates.map((candidate) => {
              const incompleteReasons = getIncompleteReasons(candidate);
              
              return (
                <tr key={candidate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {candidate.firstName || 'No'} {candidate.lastName || 'Name'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {candidate.parish || 'No parish specified'}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-gray-900">
                        <FaEnvelope className="mr-2 text-gray-400" size={12} />
                        {candidate.email || 'No email'}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <FaPhone className="mr-2 text-gray-400" size={12} />
                        {candidate.phone || 'No phone'}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center">
                        {candidate.isPublic ? (
                          <FaToggleOn className="text-green-500 mr-1" />
                        ) : (
                          <FaToggleOff className="text-gray-400 mr-1" />
                        )}
                        <span className="text-sm">
                          {candidate.isPublic ? 'Public' : 'Private'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        Status: {candidate.profileStatus || 'Not set'}
                      </div>
                      <div className="text-sm text-gray-500">
                        Resume: {candidate.profile?.resume?.url ? '✓' : '✗'}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {incompleteReasons.map((reason, index) => (
                        <div key={index} className="flex items-center text-sm text-red-600">
                          <FaExclamationTriangle className="mr-1" size={12} />
                          {reason}
                        </div>
                      ))}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {candidate.createdAt ? new Date(candidate.createdAt).toLocaleDateString() : 'Unknown'}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() => {
                        setSelectedCandidate(candidate);
                        setIsModalOpen(true);
                      }}
                      className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                    >
                      <FaEye />
                    </button>
                    
                    {!candidate.isPublic && (
                      <button
                        onClick={() => handleMakePublic(candidate.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                        title="Make Public"
                      >
                        Public
                      </button>
                    )}
                    
                    {candidate.profileStatus !== 'active' && (
                      <button
                        onClick={() => handleActivateProfile(candidate.id)}
                        className="bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700"
                        title="Activate Profile"
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {filteredCandidates.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No incomplete profiles found matching your criteria.
          </div>
        )}
      </div>

      {/* Modal for viewing candidate details */}
      {isModalOpen && selectedCandidate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">
                  {selectedCandidate.firstName || 'No'} {selectedCandidate.lastName || 'Name'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <strong>Email:</strong> {selectedCandidate.email || 'Not provided'}
                </div>
                <div>
                  <strong>Phone:</strong> {selectedCandidate.phone || 'Not provided'}
                </div>
                <div>
                  <strong>Parish:</strong> {selectedCandidate.parish || 'Not provided'}
                </div>
                <div>
                  <strong>Birth Date:</strong> {selectedCandidate.birthDate || 'Not provided'}
                </div>
                <div>
                  <strong>Employment Type:</strong> {selectedCandidate.employmentType || 'Not specified'}
                </div>
                <div>
                  <strong>Profile Status:</strong> {selectedCandidate.profileStatus || 'Not set'}
                </div>
                <div>
                  <strong>Public:</strong> {selectedCandidate.isPublic ? 'Yes' : 'No'}
                </div>
                <div>
                  <strong>About Me:</strong> {selectedCandidate.profile?.aboutMe || 'Not provided'}
                </div>
                <div>
                  <strong>Resume:</strong> {selectedCandidate.profile?.resume?.url ? 'Uploaded' : 'Not uploaded'}
                </div>
                <div>
                  <strong>Incomplete Reasons:</strong>
                  <ul className="list-disc ml-6 mt-2">
                    {getIncompleteReasons(selectedCandidate).map((reason, index) => (
                      <li key={index} className="text-red-600">{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncompleteProfiles;