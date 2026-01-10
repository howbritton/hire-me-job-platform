import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get, remove } from 'firebase/database';
import { app } from '../../firebase';
import { toast } from 'react-toastify';

const AllCandidates = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const db = getDatabase(app);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const candidatesRef = ref(db, 'candidates');
        const snapshot = await get(candidatesRef);

        if (snapshot.exists()) {
          const candidatesData = snapshot.val();
          const candidatesArray = Object.entries(candidatesData).map(([id, data]) => ({
            id,
            ...data,
            fullName: `${data.firstName} ${data.middleInitial ? data.middleInitial + ' ' : ''}${data.lastName}`,
            email: data.email,
            phone: data.phone,
            status: data.labourAvailability === 'yes' ? 'Available' : 'Unavailable'
          }));
          setCandidates(candidatesArray);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching candidates:', error);
        toast.error('Error loading candidates');
        setLoading(false);
      }
    };

    fetchCandidates();
  }, [db]);

  const handleDelete = async (candidateId) => {
    if (window.confirm('Are you sure you want to delete this candidate?')) {
      try {
        await remove(ref(db, `candidates/${candidateId}`));
        toast.success('Candidate deleted successfully');
        setCandidates(candidates.filter(c => c.id !== candidateId));
      } catch (error) {
        console.error('Error deleting candidate:', error);
        toast.error('Error deleting candidate');
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-blue-950">All Candidates</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
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
            {candidates.map((candidate) => (
              <tr key={candidate.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {candidate.fullName}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{candidate.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{candidate.phone}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{candidate.parish}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    candidate.status === 'Available' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {candidate.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => {
                      setSelectedCandidate(candidate);
                      setIsModalOpen(true);
                    }}
                    className="text-blue-950 hover:text-[#cddd3a] mr-3"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(candidate.id)}
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

      {isModalOpen && selectedCandidate && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Candidate Details
                </h3>
                <div className="border-t border-gray-200 py-3">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedCandidate.fullName}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Birth Date</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedCandidate.birthDate}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Email</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedCandidate.email}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Phone</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedCandidate.phone}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Address</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedCandidate.address}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Parish</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedCandidate.parish}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Employment Type</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedCandidate.employmentType}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Labour Availability</dt>
                      <dd className="mt-1 text-sm text-gray-900">{selectedCandidate.labourAvailability}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-950 text-base font-medium text-white hover:bg-[#cddd3a] hover:text-blue-950 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllCandidates;