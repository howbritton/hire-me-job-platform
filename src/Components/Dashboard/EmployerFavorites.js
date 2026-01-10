import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get, remove } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { Link } from 'react-router-dom';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { FaDownload, FaSearch, FaTrash, FaEye, FaMapMarkerAlt, FaEnvelope, FaPhone, FaRegHeart, FaBriefcase } from 'react-icons/fa';

const FavoriteCard = ({ candidate, onRemove }) => {
  return (
    <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <Link 
          to={`/employer/resumes/${candidate.id}`}
          className="flex items-center flex-1"
        >
          <div className="flex-shrink-0">
            {candidate.profile?.photo ? (
              <img
                src={candidate.profile.photo.url}
                alt={`${candidate.firstName} ${candidate.lastName}`}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500 text-xl">
                  {candidate.firstName?.[0]}
                </span>
              </div>
            )}
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-semibold hover:text-blue-950">
              {candidate.firstName} {candidate.lastName}
            </h3>
            {candidate.profile?.title && (
              <p className="text-gray-600">{candidate.profile.title}</p>
            )}
          </div>
        </Link>
        <button
          onClick={() => onRemove(candidate.id)}
          className="text-red-500 hover:text-red-600 p-2"
          title="Remove from favorites"
        >
          <FaTrash size={16} />
        </button>
      </div>

      <div className="space-y-2 mb-4 text-sm text-gray-600">
        {candidate.email && (
          <div className="flex items-center">
            <FaEnvelope className="mr-2 text-blue-950" />
            {candidate.email}
          </div>
        )}
        {candidate.phone && (
          <div className="flex items-center">
            <FaPhone className="mr-2 text-blue-950" />
            {candidate.phone}
          </div>
        )}
        {candidate.parish && (
          <div className="flex items-center">
            <FaMapMarkerAlt className="mr-2 text-blue-950" />
            {candidate.parish}
          </div>
        )}
        {candidate.employmentType && (
          <div className="flex items-center">
            <FaBriefcase className="mr-2 text-blue-950" />
            {candidate.employmentType}
          </div>
        )}
      </div>

      {candidate.profile?.skills && candidate.profile.skills.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {candidate.profile.skills.slice(0, 4).map((skill, index) => (
              <span
                key={index}
                className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
              >
                {skill}
              </span>
            ))}
            {candidate.profile.skills.length > 4 && (
              <span className="text-gray-500 text-xs">
                +{candidate.profile.skills.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {candidate.profile?.aboutMe && (
        <div className="mb-4">
          <p className="text-gray-600 text-sm line-clamp-3">
            {candidate.profile.aboutMe}
          </p>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <Link
          to={`/employer/resumes/${candidate.id}`}
          className="flex items-center justify-center flex-1 px-4 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors duration-200"
        >
          <FaEye className="mr-2" />
          View Profile
        </Link>
        {candidate.profile?.resume && (
          <a
            href={candidate.profile.resume.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center flex-1 px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors duration-200"
          >
            <FaDownload className="mr-2" />
            Resume
          </a>
        )}
      </div>
    </div>
  );
};

const EmployerFavorites = () => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const auth = getAuth(app);
  const db = getDatabase(app);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const favoritesRef = ref(db, `employers/${auth.currentUser.uid}/favorites`);
        const snapshot = await get(favoritesRef);

        if (snapshot.exists()) {
          const favoriteIds = Object.keys(snapshot.val());
          const candidatePromises = favoriteIds.map(async (candidateId) => {
            const candidateRef = ref(db, `candidates/${candidateId}`);
            const candidateSnap = await get(candidateRef);
            
            if (candidateSnap.exists()) {
              const candidateData = candidateSnap.val();
              return {
                id: candidateId,
                firstName: candidateData.firstName || '',
                lastName: candidateData.lastName || '',
                email: candidateData.email || '',
                phone: candidateData.phone || '',
                parish: candidateData.parish || '',
                employmentType: candidateData.employmentType || '',
                profile: candidateData.profile || {},
                ...candidateData
              };
            }
            return null;
          });

          const candidatesData = await Promise.all(candidatePromises);
          setFavorites(candidatesData.filter(Boolean));
        } else {
          setFavorites([]);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching favorites:', error);
        toast.error('Error loading favorite candidates');
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [auth.currentUser?.uid, db]);

  const handleRemoveFavorite = async (candidateId) => {
    try {
      await remove(ref(db, `employers/${auth.currentUser.uid}/favorites/${candidateId}`));
      toast.success('Removed from favorites');
      setFavorites(prev => prev.filter(fav => fav.id !== candidateId));
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Failed to remove from favorites');
    }
  };

  const filteredFavorites = favorites.filter(candidate => {
    const searchString = searchTerm.toLowerCase();
    return (
      candidate.firstName?.toLowerCase().includes(searchString) ||
      candidate.lastName?.toLowerCase().includes(searchString) ||
      candidate.profile?.title?.toLowerCase().includes(searchString) ||
      candidate.profile?.skills?.some(skill => skill.toLowerCase().includes(searchString))
    );
  });

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
        <h2 className="text-2xl font-bold text-blue-950 mb-4">Favorite Candidates</h2>
        
        <div className="relative w-full md:w-96 mb-6">
          <input
            type="text"
            placeholder="Search by name, skills, or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFavorites.map((candidate) => (
          <FavoriteCard
            key={candidate.id}
            candidate={candidate}
            onRemove={handleRemoveFavorite}
          />
        ))}

        {filteredFavorites.length === 0 && (
          <div className="col-span-full text-center py-8">
            <div className="max-w-sm mx-auto">
              <FaRegHeart className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Favorite Candidates
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm 
                  ? "No favorites match your search criteria"
                  : "You haven't added any candidates to your favorites yet"}
              </p>
              <Link
                to="/employer/resumes"
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-[#cddd3a] hover:text-blue-950 transition-colors duration-200"
              >
                Browse Candidates
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployerFavorites;