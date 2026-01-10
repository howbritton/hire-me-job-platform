import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, update } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { 
  FaHeart, FaCrown, FaRegHeart, FaDownload, FaSearch, FaBriefcase, 
  FaMapMarkerAlt, FaEnvelope, FaPhone, FaEye, FaVideo,
  FaExclamationTriangle, FaLock
} from 'react-icons/fa';

// Utility function to extract YouTube video ID
const getYouTubeVideoId = (url) => {
  if (!url) return null;
  
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^/?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^/?]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
};

const CandidateCard = ({ candidate, isFavorite, onToggleFavorite }) => {
  const [showVideo, setShowVideo] = useState(false);
  
  return (
    <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow bg-white relative">
      <div className="flex items-center justify-between mb-4">
        <Link 
          to={`/employer/resumes/${candidate.id}`}
          className="flex items-center flex-1 hover:text-blue-950"
        >
          <div className="flex items-center">
            {candidate.profile.photo ? (
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
            <div className="ml-3">
              <h3 className="font-semibold text-lg">
                {candidate.firstName} {candidate.lastName}
              </h3>
              {candidate.profile?.title && (
                <p className="text-sm text-gray-600">{candidate.profile.title}</p>
              )}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {candidate.profile?.video?.youtubeUrl && (
            <button
              onClick={() => setShowVideo(!showVideo)}
              className="text-blue-950 hover:text-blue-800 p-2"
              title="Toggle video introduction"
            >
              <FaVideo size={20} />
            </button>
          )}
          <button
            onClick={() => onToggleFavorite(candidate.id)}
            className="text-red-500 hover:text-red-600 p-2"
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorite ? <FaHeart size={20} /> : <FaRegHeart size={20} />}
          </button>
        </div>
      </div>

      {/* Video Section */}
      {showVideo && candidate.profile?.video?.youtubeUrl && (
        <div className="mb-4">
          <div className="aspect-video w-full">
            {getYouTubeVideoId(candidate.profile.video.youtubeUrl) ? (
              <iframe
                className="w-full h-full rounded-lg"
                src={`https://www.youtube.com/embed/${getYouTubeVideoId(candidate.profile.video.youtubeUrl)}`}
                title="Video Introduction"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
                <span className="text-red-500">Invalid YouTube URL</span>
              </div>
            )}
          </div>
        </div>
      )}

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

      {candidate.profile.skills && candidate.profile.skills.length > 0 && (
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

      {candidate.profile.aboutMe && (
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
        {candidate.profile.resume && (
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

// No Subscription component
const NoSubscription = ({ navigate }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-blue-950">Candidate Database</h2>
      </div>
      
      {/* Subscription Status Alert */}
      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
        <div className="flex items-start">
          <FaExclamationTriangle className="text-red-500 mt-0.5 mr-3" />
          <div>
            <p className="font-bold text-red-700">No Active Subscription</p>
            <p className="text-red-600">You currently don't have an active subscription plan.</p>
          </div>
        </div>
      </div>
      
      <div className="text-center py-10">
        <div className="mb-6 flex flex-col items-center">
          <FaLock className="text-gray-400 text-6xl mb-4" />
          <h2 className="text-xl font-bold text-blue-950 mb-2">Access to Candidate Database Locked</h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            To view our full database of qualified candidates, please subscribe to one of our employer plans.
            A subscription gives you access to candidate profiles, resumes, and contact information.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => navigate('/pricing')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              View Subscription Plans
            </button>
            {/* <button
              onClick={() => navigate('/employer/dashboard')}
              className="border border-gray-300 bg-white text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Back to Dashboard
            </button> */}
          </div>
        </div>
      </div>
    </div>
  );
};

// Expired Subscription component
const ExpiredSubscription = ({ navigate, endDate, subscription }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-blue-950">Candidate Database</h2>
      </div>
      
      {/* Subscription Status Alert */}
      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
        <div className="flex items-start">
          <FaExclamationTriangle className="text-yellow-500 mt-0.5 mr-3" />
          <div>
            <p className="font-bold text-yellow-800">Subscription Expired</p>
            <p className="text-yellow-700">
              Your {subscription?.package?.name || "subscription"} plan expired on {new Date(endDate).toLocaleDateString()}.
            </p>
          </div>
        </div>
      </div>
      
      <div className="text-center py-10">
        <div className="mb-6 flex flex-col items-center">
          <FaLock className="text-gray-400 text-6xl mb-4" />
          <h2 className="text-xl font-bold text-blue-950 mb-2">Access to Candidate Database Locked</h2>
          <p className="text-gray-600 mb-2 max-w-2xl mx-auto">
            Your access to our candidate database has expired.
          </p>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Renew your subscription to continue accessing candidate profiles, resumes, and contact information.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => navigate('/pricing')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Renew Subscription
            </button>
            {/* <button
              onClick={() => navigate('/employer/dashboard')}
              className="border border-gray-300 bg-white text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Back to Dashboard
            </button> */}
          </div>
        </div>
      </div>
    </div>
  );
};

const CandidateResumes = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSkills, setFilterSkills] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    hasActiveSubscription: false,
    subscription: null,
    isLoading: true
  });

  const auth = getAuth(app);
  const db = getDatabase(app);
  const navigate = useNavigate();

  // NEW: Function to calculate subscription from payments (matching Pricing/EmployerProfile logic)
  const calculateSubscriptionFromPayments = useCallback(async (userId) => {
    try {
      // Get the user's payment history
      const paymentsRef = ref(db, `payments/${userId}`);
      const paymentsSnapshot = await get(paymentsRef);
      
      if (!paymentsSnapshot.exists()) {
        return null;
      }

      const payments = paymentsSnapshot.val();
      
      // Get the most recent completed payment
      const completedPayments = Object.entries(payments)
        .filter(([id, payment]) => payment.status === 'approved')
        .map(([id, payment]) => ({
          id,
          ...payment,
          createdAt: new Date(payment.createdAt)
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
      
      if (completedPayments.length === 0) {
        return null;
      }

      const latestPayment = completedPayments[0];
      
      // Get package details
      const packageRef = ref(db, `packages/${latestPayment.packageId}`);
      const packageSnapshot = await get(packageRef);
      
      if (!packageSnapshot.exists()) {
        // Package doesn't exist, but we have payment data
        const paymentDate = latestPayment.createdAt;
        const subscriptionEndDate = new Date(paymentDate);
        subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30); // Default 30 days
        
        const now = new Date();
        const isActive = subscriptionEndDate > now;
        
        return {
          package: {
            id: latestPayment.packageId,
            name: latestPayment.packageName || 'Package',
            price: latestPayment.amount,
            features: {}
          },
          startDate: paymentDate.toISOString(),
          endDate: subscriptionEndDate.toISOString(),
          status: isActive ? 'active' : 'expired',
          paymentStatus: 'confirmed'
        };
      }

      const packageData = packageSnapshot.val();
      
      // Calculate subscription end date based on payment date + package duration
      const paymentDate = latestPayment.createdAt;
      const subscriptionEndDate = new Date(paymentDate);
      subscriptionEndDate.setDate(subscriptionEndDate.getDate() + (packageData.duration || 30));
      
      const now = new Date();
      const isActive = subscriptionEndDate > now;
      
      return {
        package: {
          id: latestPayment.packageId,
          name: packageData.name,
          price: latestPayment.amount,
          duration: packageData.duration,
          features: packageData.features || {},
          jobPostLimit: packageData.jobPostLimit
        },
        startDate: paymentDate.toISOString(),
        endDate: subscriptionEndDate.toISOString(),
        status: isActive ? 'active' : 'expired',
        paymentStatus: 'confirmed'
      };
      
    } catch (error) {
      console.error('Error calculating subscription from payments:', error);
      return null;
    }
  }, [db]);

  const checkSubscription = useCallback(async () => {
    try {
      if (!auth.currentUser?.uid) {
        setSubscriptionStatus({
          hasActiveSubscription: false,
          subscription: null,
          isLoading: false,
          error: 'User not authenticated'
        });
        return false;
      }

      // UPDATED: Calculate subscription from payments instead of subscription node
      const subscription = await calculateSubscriptionFromPayments(auth.currentUser.uid);
      
      // Check if subscription exists, is active, and payment is confirmed
      const hasActiveSubscription = 
        subscription?.status === 'active' && 
        subscription?.paymentStatus === 'confirmed' &&
        (subscription?.endDate ? new Date(subscription.endDate) > new Date() : false);
      
      setSubscriptionStatus({
        hasActiveSubscription,
        subscription,
        isLoading: false
      });
      
      return hasActiveSubscription;
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscriptionStatus({
        hasActiveSubscription: false,
        subscription: null,
        isLoading: false,
        error: error.message
      });
      return false;
    }
  }, [auth.currentUser?.uid, calculateSubscriptionFromPayments]);

  const fetchCandidates = useCallback(async () => {
    try {
      const candidatesRef = ref(db, 'candidates');
      const snapshot = await get(candidatesRef);
      
      if (snapshot.exists()) {
        const candidatesData = Object.entries(snapshot.val())
          .map(([id, data]) => ({
            id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            employmentType: data.employmentType || '',
            parish: data.parish || '',
            profile: data.profile || {},
            isPublic: data.isPublic,
            status: data.status || data.profileStatus,
            ...data
          }))
          .filter(candidate => {
            // Updated filtering criteria to ensure complete profiles only
            // 1. Candidate must have a profile
            // 2. Candidate must have a resume
            // 3. Profile must be public
            // 4. Status must be active
            const hasProfile = !!candidate.profile;
            const hasResume = candidate.profile && candidate.profile.resume && candidate.profile.resume.url;
            const isActive = (candidate.status === 'active') || (candidate.profileStatus === 'active');
            const isPublicProfile = candidate.isPublic === true;
            
            // Console log for debugging
            console.log(`Candidate ${candidate.firstName} ${candidate.lastName}:`, 
              { hasProfile, hasResume, isPublic: isPublicProfile, isActive });
            
            // Return true only if ALL criteria are met
            return hasProfile && hasResume && isActive && isPublicProfile;
          });
        
        console.log('Filtered candidates:', candidatesData.length);
        setCandidates(candidatesData);
      } else {
        console.log('No candidates found in database');
        setCandidates([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Error loading candidates');
      setLoading(false);
    }
  }, [db]);

  const fetchFavorites = useCallback(async () => {
    try {
      const favoritesRef = ref(db, `employers/${auth.currentUser.uid}/favorites`);
      const snapshot = await get(favoritesRef);
      
      if (snapshot.exists()) {
        setFavorites(Object.keys(snapshot.val()));
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  }, [auth.currentUser?.uid, db]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First check subscription status
        const hasActiveSubscription = await checkSubscription();
        
        // Only fetch candidates if the employer has an active subscription
        if (hasActiveSubscription) {
          await Promise.all([fetchCandidates(), fetchFavorites()]);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error loading data');
        setLoading(false);
      }
    };

    if (auth.currentUser?.uid) {
      fetchData();
    } else {
      setLoading(false);
      setSubscriptionStatus({
        hasActiveSubscription: false,
        subscription: null,
        isLoading: false,
        error: 'User not authenticated'
      });
    }
  }, [auth.currentUser?.uid, db, fetchCandidates, fetchFavorites, checkSubscription]);

  const toggleFavorite = async (candidateId) => {
    try {
      if (favorites.includes(candidateId)) {
        await update(ref(db, `employers/${auth.currentUser.uid}/favorites`), {
          [candidateId]: null
        });
        setFavorites(favorites.filter(id => id !== candidateId));
        toast.success('Removed from favorites');
      } else {
        await update(ref(db, `employers/${auth.currentUser.uid}/favorites`), {
          [candidateId]: true
        });
        setFavorites([...favorites, candidateId]);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error updating favorites:', error);
      toast.error('Error updating favorites');
    }
  };

  const filteredCandidates = candidates.filter(candidate => {
    const fullName = `${candidate.firstName} ${candidate.lastName}`.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    
    const matchesSearch = 
      !searchTerm || 
      fullName.includes(searchLower) ||
      candidate.email?.toLowerCase().includes(searchLower) ||
      candidate.profile?.aboutMe?.toLowerCase().includes(searchLower) ||
      candidate.parish?.toLowerCase().includes(searchLower) ||
      candidate.employmentType?.toLowerCase().includes(searchLower);

    const matchesSkills = !filterSkills || 
      candidate.profile?.skills?.some(skill => 
        skill.toLowerCase().includes(filterSkills.toLowerCase())
      );

    return matchesSearch && matchesSkills;
  });

  if (loading || subscriptionStatus.isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  // If no active subscription, show subscription message
  if (!subscriptionStatus.hasActiveSubscription) {
    // Check if subscription exists but has expired
    if (subscriptionStatus.subscription?.endDate && new Date(subscriptionStatus.subscription.endDate) < new Date()) {
      return <ExpiredSubscription 
        navigate={navigate} 
        endDate={subscriptionStatus.subscription.endDate} 
        subscription={subscriptionStatus.subscription} 
      />;
    }
    
    // Otherwise, show generic no subscription message
    return <NoSubscription navigate={navigate} />;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-blue-950 mb-4">All Candidates</h2>
        
        {/* Subscription status banner */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6 flex items-center">
          <FaCrown className="text-yellow-500 mr-3 text-xl" />
          <div>
            {/* <p className="text-blue-800 font-medium">
              Active Subscription: {subscriptionStatus.subscription.package.name}
            </p> */}
            <p className="text-sm text-blue-600">
              Valid until: {new Date(subscriptionStatus.subscription.endDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
          </div>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Filter by skills..."
              value={filterSkills}
              onChange={(e) => setFilterSkills(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCandidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              isFavorite={favorites.includes(candidate.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>

        {filteredCandidates.length === 0 && (
          <div className="text-center py-8">
            <FaSearch className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Candidates Found
            </h3>
            <p className="text-gray-500">
              {searchTerm || filterSkills 
                ? "No candidates match your search criteria. Try adjusting your filters."
                : "No candidates are available at the moment."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidateResumes;