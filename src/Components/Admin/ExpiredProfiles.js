import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get, update } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { 
  FaArrowLeft, 
  FaCalendarCheck, 
  FaEye, 
  FaEnvelope, 
  FaPhone, 
  FaToggleOff,
  FaToggleOn,
  FaFilter,
  FaDownload,
  FaSearch,
  FaCalendarTimes,
  FaUndo,
  FaClock
} from 'react-icons/fa';
import toast, { Toaster } from 'react-hot-toast';

const ExpiredProfiles = () => {
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

  // Define expiration types
  const getExpirationInfo = (candidate) => {
    const now = new Date();
    const info = {
      isExpired: false,
      reasons: [],
      expirationDate: null,
      autoDeactivatedAt: null,
      daysExpired: 0
    };

    // Check expiration date
    if (candidate.expirationDate) {
      const expirationDate = new Date(candidate.expirationDate);
      info.expirationDate = expirationDate;
      
      if (expirationDate < now) {
        info.isExpired = true;
        info.reasons.push('Expiration date passed');
        info.daysExpired = Math.floor((now - expirationDate) / (1000 * 60 * 60 * 24));
      }
    }

    // Check auto-deactivation
    if (candidate.autoDeactivatedAt) {
      info.isExpired = true;
      info.autoDeactivatedAt = new Date(candidate.autoDeactivatedAt);
      info.reasons.push('Auto-deactivated');
      
      if (!info.daysExpired) {
        info.daysExpired = Math.floor((now - info.autoDeactivatedAt) / (1000 * 60 * 60 * 24));
      }
    }

    // Check profile status
    if (candidate.profileStatus === 'expired') {
      info.isExpired = true;
      info.reasons.push('Status set to expired');
    }

    return info;
  };

  const fetchExpiredProfiles = async () => {
    try {
      const candidatesRef = ref(db, 'candidates');
      const snapshot = await get(candidatesRef);
      
      if (snapshot.exists()) {
        const candidatesData = snapshot.val();
        const candidatesList = Object.entries(candidatesData).map(([id, data]) => ({
          id,
          ...data
        }));
        
        // Filter for expired profiles
        const expiredProfiles = candidatesList.filter(candidate => {
          const expirationInfo = getExpirationInfo(candidate);
          return expirationInfo.isExpired;
        });
        
        setCandidates(expiredProfiles);
        setFilteredCandidates(expiredProfiles);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching expired profiles:', error);
      toast.error('Error loading expired profiles');
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
          fetchExpiredProfiles();
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
        const expInfo = getExpirationInfo(candidate);
        
        switch (filterType) {
          case 'expiration-date':
            return expInfo.reasons.includes('Expiration date passed');
          case 'auto-deactivated':
            return expInfo.reasons.includes('Auto-deactivated');
          case 'status-expired':
            return expInfo.reasons.includes('Status set to expired');
          case 'recent': // Expired in last 30 days
            return expInfo.daysExpired <= 30;
          case 'old': // Expired more than 30 days ago
            return expInfo.daysExpired > 30;
          default:
            return true;
        }
      });
    }

    setFilteredCandidates(filtered);
  }, [searchTerm, filterType, candidates]);

  const handleReactivateProfile = async (candidateId) => {
    try {
      const newExpirationDate = new Date();
      newExpirationDate.setMonth(newExpirationDate.getMonth() + 3); // Extend for 3 months

      await update(ref(db, `candidates/${candidateId}`), {
        profileStatus: 'active',
        isPublic: true,
        autoDeactivatedAt: null,
        expirationDate: newExpirationDate.toISOString(),
        expirationNotificationSent: false,
        expirationNotificationSentAt: null,
        updatedAt: new Date().toISOString()
      });
      
      toast.success('Profile reactivated successfully');
      fetchExpiredProfiles(); // Refresh the list
    } catch (error) {
      console.error('Error reactivating profile:', error);
      toast.error('Error reactivating profile');
    }
  };

  const exportToCSV = () => {
    const csvData = filteredCandidates.map(candidate => {
      const expInfo = getExpirationInfo(candidate);
      return {
        Name: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
        Email: candidate.email || '',
        Phone: candidate.phone || '',
        Parish: candidate.parish || '',
        'Expiration Date': candidate.expirationDate ? new Date(candidate.expirationDate).toLocaleDateString() : '',
        'Auto Deactivated': candidate.autoDeactivatedAt ? new Date(candidate.autoDeactivatedAt).toLocaleDateString() : '',
        'Days Expired': expInfo.daysExpired,
        'Expiration Reasons': expInfo.reasons.join(', '),
        'Profile Status': candidate.profileStatus || 'Not set',
        'Created At': candidate.createdAt ? new Date(candidate.createdAt).toLocaleDateString() : ''
      };
    });

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expired-profiles-${new Date().toISOString().split('T')[0]}.csv`;
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
              <FaCalendarCheck className="mr-2" />
              Expired Profiles
            </h2>
            <p className="text-gray-600">
              {filteredCandidates.length} of {candidates.length} expired profiles
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
            <option value="all">All Expired</option>
            <option value="expiration-date">Date Expired</option>
            <option value="auto-deactivated">Auto-Deactivated</option>
            <option value="status-expired">Status Expired</option>
            <option value="recent">Recent (≤30 days)</option>
            <option value="old">Older than 30 days</option>
          </select>
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
                Expiration Info
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Days Expired
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCandidates.map((candidate) => {
              const expInfo = getExpirationInfo(candidate);
              
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
                  
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {expInfo.expirationDate && (
                        <div className="text-sm text-red-600">
                          <FaCalendarTimes className="inline mr-1" size={12} />
                          Expired: {expInfo.expirationDate.toLocaleDateString()}
                        </div>
                      )}
                      {expInfo.autoDeactivatedAt && (
                        <div className="text-sm text-orange-600">
                          <FaClock className="inline mr-1" size={12} />
                          Auto-deactivated: {expInfo.autoDeactivatedAt.toLocaleDateString()}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        {expInfo.reasons.join(', ')}
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
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      expInfo.daysExpired <= 7 ? 'bg-yellow-100 text-yellow-800' :
                      expInfo.daysExpired <= 30 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {expInfo.daysExpired} days
                    </span>
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
                    
                    <button
                      onClick={() => handleReactivateProfile(candidate.id)}
                      className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 flex items-center"
                      title="Reactivate Profile"
                    >
                      <FaUndo className="mr-1" size={12} />
                      Reactivate
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {filteredCandidates.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No expired profiles found matching your criteria.
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
                  <strong>Profile Status:</strong> {selectedCandidate.profileStatus || 'Not set'}
                </div>
                <div>
                  <strong>Public:</strong> {selectedCandidate.isPublic ? 'Yes' : 'No'}
                </div>
                <div>
                  <strong>Expiration Date:</strong> {selectedCandidate.expirationDate ? 
                    new Date(selectedCandidate.expirationDate).toLocaleDateString() : 'Not set'}
                </div>
                <div>
                  <strong>Auto-Deactivated:</strong> {selectedCandidate.autoDeactivatedAt ? 
                    new Date(selectedCandidate.autoDeactivatedAt).toLocaleDateString() : 'No'}
                </div>
                <div>
                  <strong>Created:</strong> {selectedCandidate.createdAt ? 
                    new Date(selectedCandidate.createdAt).toLocaleDateString() : 'Unknown'}
                </div>
                <div>
                  <strong>Expiration Info:</strong>
                  <ul className="list-disc ml-6 mt-2">
                    {getExpirationInfo(selectedCandidate).reasons.map((reason, index) => (
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

export default ExpiredProfiles;