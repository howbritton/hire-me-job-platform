import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { FaSearch } from 'react-icons/fa';
import { getDatabase, ref, query, orderByChild, onValue } from 'firebase/database';
import { app } from '../firebase';

const TemporaryWorkersList = () => {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    const db = getDatabase(app);
    const workersRef = query(ref(db, 'temporaryWorkers'), orderByChild('status'));

    const unsubscribe = onValue(workersRef, (snapshot) => {
      if (snapshot.exists()) {
        const workersData = [];
        snapshot.forEach((childSnapshot) => {
          const worker = {
            id: childSnapshot.key,
            ...childSnapshot.val()
          };
          if (worker.status === 'active') {
            workersData.push(worker);
          }
        });
        setWorkers(workersData);
      } else {
        setWorkers([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isFilterOpen && !event.target.closest('.filter-dropdown')) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  const handleCreateListing = () => {
    navigate('/temporary-workers/apply');
  };

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = (
      worker.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filter === 'all') return matchesSearch;
    if (filter === 'strenuousWork') return matchesSearch && worker.canDoStrenuousWork;
    if (filter === 'whatsapp') return matchesSearch && worker.whatsappContact;
    return matchesSearch;
  });

  const getFilterLabel = () => {
    switch (filter) {
      case 'strenuousWork':
        return 'Can Do Strenuous Work';
      case 'whatsapp':
        return 'WhatsApp Available';
      default:
        return 'All Workers';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-[#263571]">
          Temporary Work - No Skills Required!
        </h1>
        <Button
          variant="contained"
          onClick={handleCreateListing}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Join the Workforce
        </Button>
      </div>

      <div className="max-w-5xl mx-auto mb-8 flex flex-col sm:flex-row gap-4 items-center">
        {/* Search Bar */}
        <div className="flex-1 relative w-full">
          <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or location..."
            className="w-full pl-12 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter Dropdown */}
        <div className="relative filter-dropdown w-full sm:w-auto">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="w-full sm:w-auto px-4 py-2 border rounded-lg bg-white flex items-center justify-between gap-2 min-w-[150px]"
          >
            <span className="text-gray-700">Filter:</span>
            <span className="text-gray-900">{getFilterLabel()}</span>
            <span className="ml-2">▼</span>
          </button>

          {isFilterOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-10">
              <button 
                className="w-full py-2 px-4 text-left hover:bg-gray-100"
                onClick={() => {
                  setFilter('all');
                  setIsFilterOpen(false);
                }}
              >
                All Workers
              </button>
              <button 
                className="w-full py-2 px-4 text-left hover:bg-gray-100"
                onClick={() => {
                  setFilter('strenuousWork');
                  setIsFilterOpen(false);
                }}
              >
                Can Do Strenuous Work
              </button>
              <button 
                className="w-full py-2 px-4 text-left hover:bg-gray-100"
                onClick={() => {
                  setFilter('whatsapp');
                  setIsFilterOpen(false);
                }}
              >
                WhatsApp Available
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-600">Loading...</div>
      ) : filteredWorkers.length === 0 ? (
        <div className="text-center py-8 text-gray-600">No workers found matching your criteria</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {filteredWorkers.map((worker) => (
            <div key={worker.id} className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-blue-900 mb-2">{worker.name}</h3>
              <p className="text-gray-600 mb-2">
                <strong>Location:</strong> {worker.location}
              </p>
              <p className="text-gray-600 mb-2">
                <strong>Contact:</strong>{' '}
                <a href={`mailto:${worker.email}`} className="text-blue-600 hover:underline">
                  {worker.email}
                </a>
              </p>
              <p className="text-gray-600 mb-2">
                <strong>Phone:</strong> {worker.phone}
              </p>
              <div className="space-y-1 mt-4">
                {worker.canDoStrenuousWork && (
                  <p className="text-green-600">✓ Available for strenuous work</p>
                )}
                {worker.whatsappContact && (
                  <p className="text-green-600">✓ Available on WhatsApp</p>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Listed since: {worker.listedDate ? formatDate(worker.listedDate) : 'N/A'}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-center text-gray-600">
        <p>
          Please contact us at{' '}
          <a href="mailto:info@hiremeja.com" className="text-blue-600 hover:underline">
            info@hiremeja.com
          </a>{' '}
          to be removed from the listing.
        </p>
      </div>
    </div>
  );
};

export default TemporaryWorkersList;