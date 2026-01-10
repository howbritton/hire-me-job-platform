import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, update } from 'firebase/database';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { getFunctions, httpsCallable } from 'firebase/functions';

const ToggleSwitch = ({ isChecked, onChange, disabled }) => (
  <div className="flex items-center">
    <label className="relative inline-flex items-center cursor-pointer">
      <input 
        type="checkbox" 
        className="sr-only peer"
        checked={isChecked}
        onChange={onChange}
        disabled={disabled}
      />
      <div className={`
        w-11 h-6 rounded-full peer 
        peer-focus:outline-none peer-focus:ring-4 
        ${isChecked 
          ? 'bg-green-500 peer-focus:ring-green-300' 
          : 'bg-red-500 peer-focus:ring-red-300'
        }
        after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
        after:bg-white after:border-gray-300 after:border after:rounded-full 
        after:h-5 after:w-5 after:transition-all
        ${isChecked ? 'after:translate-x-full' : 'after:translate-x-0'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}></div>
    </label>
    <span className={`ml-3 text-sm font-medium ${isChecked ? 'text-green-700' : 'text-red-700'}`}>
      {isChecked ? 'Active (Public)' : 'Inactive (Private)'}
    </span>
  </div>
);

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deactivationFilter, setDeactivationFilter] = useState('all');
  const db = getDatabase(app);

  // Filter users based on criteria - memoized to avoid recalculation
  const filteredUsers = useCallback(() => {
    return users.filter(user => {
      const matchesRole = selectedRole === 'all' || user.role === selectedRole;
      const matchesSearch = user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Add filter for auto-deactivation
      const matchesDeactivation = 
        deactivationFilter === 'all' || 
        (deactivationFilter === 'auto-deactivated' && user.autoDeactivatedAt) ||
        (deactivationFilter === 'not-auto-deactivated' && !user.autoDeactivatedAt);
      
      return matchesRole && matchesSearch && matchesDeactivation;
    });
  }, [users, selectedRole, searchTerm, deactivationFilter]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [employersSnap, candidatesSnap] = await Promise.all([
          get(ref(db, 'employers')),
          get(ref(db, 'candidates'))
        ]);

        let allUsers = [];

        if (employersSnap.exists()) {
          const employers = Object.entries(employersSnap.val()).map(([id, data]) => ({
            id,
            ...data,
            fullName: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
            role: 'employer',
            status: data.status || 'active',
            isPublic: data.isPublic !== false,
            createdAt: data.createdAt || 'N/A',
            updatedAt: data.updatedAt || data.createdAt || 'N/A',
            autoDeactivatedAt: data.autoDeactivatedAt || null
          }));
          allUsers = [...allUsers, ...employers];
        }

        if (candidatesSnap.exists()) {
          const candidates = Object.entries(candidatesSnap.val()).map(([id, data]) => ({
            id,
            ...data,
            fullName: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
            role: 'candidate',
            status: data.isPublic === false ? 'inactive' : (data.status || 'active'), // Set status based on isPublic
            isPublic: data.isPublic !== false,
            createdAt: data.createdAt || 'N/A',
            updatedAt: data.updatedAt || data.createdAt || 'N/A',
            autoDeactivatedAt: data.autoDeactivatedAt || null
          }));
          allUsers = [...allUsers, ...candidates];
        }

        setUsers(allUsers);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Error loading users');
        setLoading(false);
      }
    };

    fetchUsers();
  }, [db]);

  const handleStatusChange = async (userId, role, isActive) => {
    try {
      const newStatus = isActive ? 'active' : 'inactive';
      const userRef = ref(db, `${role}s/${userId}`);
      const updates = {
        status: 'active', // Always keep status as active since it's handled separately
        isPublic: isActive, // Use isPublic to control visibility
        updatedAt: new Date().toISOString()
      };
      
      // If we're reactivating a previously auto-deactivated profile, clear the auto-deactivation flag
      if (isActive) {
        updates.autoDeactivatedAt = null;
      }

      await update(userRef, updates);

      // If the user is an employer and status is inactive, update all their jobs to inactive
      if (role === 'employer' && !isActive) {
        const jobsRef = ref(db, `jobs/${userId}`);
        const jobsSnap = await get(jobsRef);
        
        if (jobsSnap.exists()) {
          const jobUpdates = {};
          Object.keys(jobsSnap.val()).forEach(jobId => {
            jobUpdates[`jobs/${userId}/${jobId}/status`] = 'inactive';
          });
          await update(ref(db), jobUpdates);
        }
      }

      toast.success('User status updated successfully');
      
      // Update the local state
      setUsers(prevUsers => prevUsers.map(user => {
        if (user.id === userId) {
          return {
            ...user,
            status: newStatus,
            isPublic: isActive,
            updatedAt: new Date().toISOString(),
            // Clear autoDeactivatedAt if reactivating
            autoDeactivatedAt: isActive ? null : user.autoDeactivatedAt
          };
        }
        return user;
      }));
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Error updating user status');
    }
  };

  const handleDeleteUser = async (userId, role) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        // Initialize the Firebase Functions
        const functions = getFunctions();
        const deleteUserFunction = httpsCallable(functions, 'deleteUser');
        
        // Show loading toast
        const loadingToast = toast.loading('Deleting user...');
        
        // Call the Cloud Function to delete the user
        const result = await deleteUserFunction({
          userId: userId,
          userType: role === 'employer' ? 'employer' : 'candidate'
        });
        
        // Handle the result
        if (result.data.success) {
          toast.update(loadingToast, { 
            render: 'User deleted successfully', 
            type: 'success', 
            isLoading: false,
            autoClose: 3000
          });
          
          // Update local state to remove the user
          setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
        } else {
          // Function executed but reported an error
          toast.update(loadingToast, { 
            render: `Error: ${result.data.message || 'Could not delete user'}`, 
            type: 'error', 
            isLoading: false,
            autoClose: 5000
          });
        }
      } catch (error) {
        // Function execution failed
        console.error('Error deleting user:', error);
        
        // Extract the actual error message from the error object
        const errorMessage = error.message || 'Unknown error occurred';
        toast.error(`Error deleting user: ${errorMessage}`);
      }
    }
  };
  
  const handleDownloadUsers = () => {
    try {
      // Filter users based on current filters
      const dataToExport = filteredUsers().map(user => ({
        Name: user.fullName || 'N/A',
        Email: user.email || 'N/A',
        Role: user.role || 'N/A',
        Status: user.isPublic ? 'Active (Public)' : 'Inactive (Private)',
        CreatedAt: user.createdAt ? formatDate(user.createdAt) : 'N/A',
        UpdatedAt: user.updatedAt ? formatDate(user.updatedAt) : 'N/A',
        AutoDeactivatedAt: user.autoDeactivatedAt ? formatDate(user.autoDeactivatedAt) : 'N/A'
      }));
      
      // Convert to CSV
      const headers = Object.keys(dataToExport[0]);
      const csvRows = [];
      
      // Add headers
      csvRows.push(headers.join(','));
      
      // Add data rows
      for (const row of dataToExport) {
        const values = headers.map(header => {
          const value = row[header] || '';
          // Escape quotes and wrap in quotes if needed
          return `"${String(value).replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
      }
      
      // Create a blob and download
      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `users_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('User list downloaded successfully');
    } catch (error) {
      console.error('Error downloading users:', error);
      toast.error('Error downloading user list');
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${month} ${day}, ${year}`;
    } catch (error) {
      return 'N/A';
    }
  };

  // Function to run manual deactivation check
  const handleRunDeactivationCheck = async () => {
    if (window.confirm('Are you sure you want to run the profile deactivation check? This will deactivate profiles that have not been updated in 30+ days.')) {
      try {
        // Initialize the Firebase Functions
        const functions = getFunctions();
        const checkDeactivationFunction = httpsCallable(functions, 'manualProfileDeactivationCheck');
        
        // Show loading toast
        const loadingToast = toast.loading('Running profile deactivation check...');
        
        // Call the Cloud Function to run the check
        const result = await checkDeactivationFunction();
        
        // Handle the result
        toast.update(loadingToast, { 
          render: `Deactivation check complete. ${result.data.deactivatedProfiles.employers + result.data.deactivatedProfiles.candidates} profiles deactivated.`, 
          type: 'success', 
          isLoading: false,
          autoClose: 5000
        });
        
        // Refresh the user list to show updated statuses
        window.location.reload();
        
      } catch (error) {
        // Function execution failed
        console.error('Error running deactivation check:', error);
        
        // Extract the actual error message from the error object
        const errorMessage = error.message || 'Unknown error occurred';
        toast.error(`Error: ${errorMessage}`);
      }
    }
  };

  // Get the actual filtered users for rendering
  const displayUsers = filteredUsers();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-blue-950 mb-6">User Management</h2>
      
      {/* Filters and actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name or email..."
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
        >
          <option value="all">All Users</option>
          <option value="employer">Employers</option>
          <option value="candidate">Candidates</option>
        </select>
        <select
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={deactivationFilter}
          onChange={(e) => setDeactivationFilter(e.target.value)}
        >
          <option value="all">All Deactivation Status</option>
          <option value="auto-deactivated">Auto-Deactivated Only</option>
          <option value="not-auto-deactivated">Not Auto-Deactivated</option>
        </select>
      </div>
      
      {/* Actions bar */}
      <div className="flex justify-between mb-4">
        <button
          onClick={handleRunDeactivationCheck}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Run Deactivation Check
        </button>
        <button
          onClick={handleDownloadUsers}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
          disabled={displayUsers.length === 0}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Users
        </button>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created At
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Updated
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Auto-Deactivated
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayUsers.map((user) => (
              <tr key={user.id} className={user.autoDeactivatedAt && !user.isPublic ? "bg-amber-50" : ""}>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{user.fullName || 'N/A'}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{user.email}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.role === 'employer' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <ToggleSwitch 
                    isChecked={user.status === 'active'}
                    onChange={() => handleStatusChange(user.id, user.role, user.status !== 'active')}
                    disabled={false}
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{formatDate(user.createdAt)}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{formatDate(user.updatedAt)}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {user.autoDeactivatedAt ? (
                    <div className="text-sm text-amber-700 font-medium">{formatDate(user.autoDeactivatedAt)}</div>
                  ) : (
                    <div className="text-sm text-gray-500">No</div>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDeleteUser(user.id, user.role)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete user"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {displayUsers.length === 0 && (
        <div className="text-center py-4">
          <p className="text-gray-500">No users found</p>
        </div>
      )}
      
      {/* Information panel */}
      <div className="mt-6 p-4 bg-amber-50 rounded-md border border-amber-200">
        <h3 className="text-lg font-medium text-amber-800 mb-2">Auto-Deactivation Information</h3>
        <ul className="text-sm text-amber-700 space-y-1 ml-4">
          <li>• Profiles are automatically deactivated after 30 days of inactivity</li>
          <li>• Auto-deactivated profiles are highlighted in amber</li>
          <li>• Reactivating a profile will clear its auto-deactivation status</li>
          <li>• The system runs a daily check at midnight to deactivate inactive profiles</li>
          <li>• You can manually trigger a deactivation check using the "Run Deactivation Check" button</li>
        </ul>
      </div>
    </div>
  );
};

export default UserManagement;