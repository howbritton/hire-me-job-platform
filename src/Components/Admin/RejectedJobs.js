import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { toast, ToastContainer } from 'react-toastify';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import "react-toastify/dist/ReactToastify.css";

const RejectedJobs = () => {
  const [rejectedJobs, setRejectedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const db = getDatabase(app);
  const auth = getAuth(app);

  const fetchRejectedJobs = useCallback(async () => {
    try {
      const rejectedJobsRef = ref(db, 'rejected-jobs');
      const snapshot = await get(rejectedJobsRef);
      
      if (snapshot.exists()) {
        const jobs = [];
        Object.entries(snapshot.val()).forEach(([employerId, employerJobs]) => {
          Object.entries(employerJobs).forEach(([jobId, job]) => {
            jobs.push({
              id: jobId,
              employerId,
              ...job
            });
          });
        });
        setRejectedJobs(jobs);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching rejected jobs:', error);
      toast.error('Error loading rejected jobs');
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    const checkAdminAndFetchJobs = async () => {
      if (!auth.currentUser) return;
      
      try {
        const adminRef = ref(db, `admins/${auth.currentUser.uid}`);
        const adminSnapshot = await get(adminRef);
        
        if (!adminSnapshot.exists()) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }
        
        setIsAdmin(true);
        await fetchRejectedJobs();
      } catch (error) {
        console.error('Error checking admin status:', error);
        toast.error('Error verifying admin access');
        setLoading(false);
      }
    };

    checkAdminAndFetchJobs();
  }, [auth.currentUser, db, fetchRejectedJobs]);

  const toggleJobExpansion = (jobId) => {
    setExpandedJobs(prev => ({
      ...prev,
      [jobId]: !prev[jobId]
    }));
  };

  const filteredJobs = rejectedJobs.filter(job => {
    const searchLower = searchTerm.toLowerCase();
    return (
      job.jobTitle?.toLowerCase().includes(searchLower) ||
      job.companyName?.toLowerCase().includes(searchLower) ||
      job.description?.toLowerCase().includes(searchLower) ||
      job.parish?.toLowerCase().includes(searchLower) ||
      job.industry?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return <div className="flex justify-center items-center h-96">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <p className="text-red-600 text-lg font-semibold mb-2">Access Denied</p>
          <p className="text-gray-600">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <ToastContainer 
        position="top-right" 
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        limit={1}
      />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-blue-950">Rejected Jobs</h1>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      
      {filteredJobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-600">
            {searchTerm ? 'No jobs match your search criteria' : 'No rejected jobs found'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-blue-950">
                      {job.jobTitle}
                    </h2>
                    <div className="text-sm text-gray-600 mt-1">
                      {job.companyName} • {job.parish}
                    </div>
                    <div className="text-sm text-red-600 mt-1">
                      Rejected on: {new Date(job.rejectedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="px-2 py-1 text-sm rounded-full bg-blue-100 text-blue-800">
                    {job.employmentType}
                  </span>
                  <span className="px-2 py-1 text-sm rounded-full bg-purple-100 text-purple-800">
                    {job.industry}
                  </span>
                  <span className="px-2 py-1 text-sm rounded-full bg-green-100 text-green-800">
                    {job.experience}
                  </span>
                </div>

                <div className="relative">
                  <div className={`prose max-w-none ${!expandedJobs[job.id] ? 'max-h-24 overflow-hidden' : ''}`}>
                    <p className="text-gray-700">{job.description}</p>
                  </div>
                  
                  <button
                    onClick={() => toggleJobExpansion(job.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center mt-2"
                  >
                    {expandedJobs[job.id] ? (
                      <>Show Less <ChevronUp className="ml-1 h-4 w-4" /></>
                    ) : (
                      <>Show More <ChevronDown className="ml-1 h-4 w-4" /></>
                    )}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold">Required Education:</p>
                    <p className="text-gray-600">{job.degreeLevel}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Salary:</p>
                    <p className="text-gray-600">{job.salary || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Contact:</p>
                    <p className="text-gray-600">{job.applicationEmail}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Posted:</p>
                    <p className="text-gray-600">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RejectedJobs;