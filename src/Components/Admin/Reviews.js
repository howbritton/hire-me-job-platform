import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, remove, update } from 'firebase/database';
import { app } from '../../firebase';
import { toast } from 'react-toastify';

const EMAIL_SERVICE_URL = 'http://34.228.74.248:3001';

const Reviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [userData, setUserData] = useState({});
  const db = getDatabase(app);

  const fetchUsers = useCallback(async () => {
    try {
      const [employersSnap, candidatesSnap] = await Promise.all([
        get(ref(db, 'employers')),
        get(ref(db, 'candidates'))
      ]);

      const users = {};
      
      if (employersSnap.exists()) {
        Object.entries(employersSnap.val()).forEach(([id, data]) => {
          const name = data.profile?.companyName || data.profile?.name || 'Unknown Employer';
          users[id] = { 
            name,
            type: 'employer',
            profile: data.profile || {}
          };
        });
      }
      
      if (candidatesSnap.exists()) {
        Object.entries(candidatesSnap.val()).forEach(([id, data]) => {
          const firstName = data.profile?.firstName || '';
          const lastName = data.profile?.lastName || '';
          const fullName = data.profile?.name || `${firstName} ${lastName}`.trim();
          const name = fullName || 'Unknown Candidate';
          
          users[id] = { 
            name,
            type: 'candidate',
            profile: data.profile || {}
          };
        });
      }
      
      setUserData(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error loading user data');
    }
  }, [db]);

  const fetchReviews = useCallback(async () => {
    try {
      const reviewsSnap = await get(ref(db, 'reviews'));
      if (reviewsSnap.exists()) {
        const reviewsData = Object.entries(reviewsSnap.val()).map(([id, data]) => ({
          id,
          ...data,
          createdAt: new Date(data.createdAt)
        }));
        setReviews(reviewsData.sort((a, b) => b.createdAt - a.createdAt));
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast.error('Error loading reviews');
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    fetchReviews();
    fetchUsers();
  }, [fetchReviews, fetchUsers]);

  const handleStatusChange = async (reviewId, newStatus) => {
    try {
      const reviewSnapshot = await get(ref(db, `reviews/${reviewId}`));
      const reviewData = reviewSnapshot.val();
      
      // Update review status in database
      await update(ref(db, `reviews/${reviewId}`), { 
        status: newStatus,
        updatedAt: Date.now() 
      });

      // Send email notification
      try {
        await fetch(`${EMAIL_SERVICE_URL}/notify-review-request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reviewData: {
              reviewId,
              status: newStatus,
              rating: reviewData.rating,
              comment: reviewData.comment,
              createdAt: reviewData.createdAt,
              updatedAt: Date.now()
            }
          }),
        });
      } catch (error) {
        console.error('Error sending review notification:', error);
      }

      toast.success('Review status updated successfully');
      fetchReviews();
    } catch (error) {
      console.error('Error updating review status:', error);
      toast.error('Error updating review status');
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (window.confirm('Are you sure you want to delete this review?')) {
      try {
        await remove(ref(db, `reviews/${reviewId}`));
        toast.success('Review deleted successfully');
        fetchReviews();
      } catch (error) {
        console.error('Error deleting review:', error);
        toast.error('Error deleting review');
      }
    }
  };

  const getUserDisplayInfo = (userId) => {
    const user = userData[userId];
    if (!user) {
      return {
        name: 'Unknown User',
        type: 'Unknown Type',
        typeLabel: 'User'
      };
    }

    let typeLabel = user.type === 'employer' ? 'Employer' : 'Candidate';
    
    if (user.type === 'employer' && user.profile?.companyName) {
      return {
        name: user.profile.companyName,
        type: user.type,
        typeLabel
      };
    }

    return {
      name: user.name,
      type: user.type,
      typeLabel
    };
  };

  const getFilteredReviews = () => {
    return reviews.filter(review => {
      const matchesStatus = filterStatus === 'all' || review.status === filterStatus;
      const userInfo = getUserDisplayInfo(review.userId);
      const matchesSearch = userInfo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.comment?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  const filteredReviews = getFilteredReviews();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-blue-950 mb-6">Reviews</h2>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search reviews..."
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="space-y-4">
        {filteredReviews.map((review) => {
          const userInfo = getUserDisplayInfo(review.userId);
          
          return (
            <div key={review.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-medium text-gray-900">
                    {userInfo.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {userInfo.typeLabel}
                  </div>
                  <div className="text-sm text-gray-500">
                    Posted on: {review.createdAt.toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <select
                    className={`text-sm rounded-full px-3 py-1 font-semibold ${
                      review.status === 'approved' 
                        ? 'bg-green-100 text-green-800'
                        : review.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                    value={review.status}
                    onChange={(e) => handleStatusChange(review.id, e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <button
                    onClick={() => handleDeleteReview(review.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="flex items-center mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className={`w-5 h-5 ${
                      star <= review.rating ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <p className="text-gray-700 whitespace-pre-wrap">{review.comment}</p>
            </div>
          );
        })}

        {filteredReviews.length === 0 && (
          <div className="text-center py-4">
            <p className="text-gray-500">No reviews found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reviews;