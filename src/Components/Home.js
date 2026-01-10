import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Modal, TextField, Rating as MuiRating } from '@mui/material';
import { FaStar, FaStarHalfAlt, FaBuilding, FaUserTie, FaHandHoldingUsd, FaLayerGroup } from 'react-icons/fa';
import { HiDocumentPlus } from "react-icons/hi2";
import { IoDocumentText } from "react-icons/io5";
import { MdRecycling } from "react-icons/md";
import { getAuth } from 'firebase/auth';
import { 
  getDatabase, 
  ref, 
  push,
  query, 
  orderByChild, 
  equalTo, 
  onValue, 
  get 
} from 'firebase/database';
import { app } from '../firebase';
import { toast } from 'react-toastify';
import homeBanner from '../assets/home-banner.png';
import howHireMeWorks from '../assets/how-hireme-works-image.png';
// import howHireMeWorks1 from '../assets/how-hireme-works-image-1.png';

const steps = [
  {
    id: 1,
    title: 'Creating an Account',
    description:
      'Users, whether employers or job seekers, start by signing up and creating a profile. Employers provide company details, while job seekers complete their profiles with resumes and relevant information.',
    highlight: 'Creating'
  },
  {
    id: 2,
    title: 'Posting and Searching for Jobs',
    description:
      'Employers can post detailed job listings, including job titles, responsibilities, qualifications, and benefits. Job seekers can search for jobs using filters such as job title, location, salary range, and company name to find the best matches.',
    highlight: 'Searching'
  },
  {
    id: 3,
    title: 'Application Process',
    description:
      'Job seekers can apply for jobs directly through the platform by submitting their resumes and cover letters. Employers can manage applications, sort resumes, schedule interviews, and communicate with candidates through the platform.',
    highlight: 'Process'
  },
  {
    id: 4,
    title: 'Resume Database and Search',
    description:
      'Employers can access a searchable database of candidate resumes, using filters to find suitable candidates based on location, experience, education, and skills.',
    highlight: 'Search'
  },
  {
    id: 5,
    title: 'Job Alerts and Notifications',
    description:
      'Job seekers can set up personalized job alerts to receive notifications of new job postings that match their criteria, ensuring they never miss an opportunity.',
    highlight: 'Job Alerts'
  }
];

const whatwedo = [
  {
    icon: MdRecycling,
    description:
      "Choose our time-saving and cost-effective hiring system. You get a more seamless recruiting and hiring process tailored for your Jamaican target market.",
  },
  {
    icon: FaHandHoldingUsd,
    description:
      "Adopt our innovative and easy to use tech. Find ideal employees using our searchable database of hundreds of candidates and shortlist in minutes.",
  },
  {
    icon: HiDocumentPlus,
    description:
      "Enjoy the convenience of a platform designed to level the playing field. We give all applicants a chance to showcase their suitability for available positions.",
  },
  {
    icon: IoDocumentText,
    description:
      "Choose our time-saving and cost-effective hiring system. You get a more seamless recruiting and hiring process tailored for your Jamaican target market.",
  },
  {
    icon: FaLayerGroup,
    description:
      "Adopt our innovative and easy to use tech. Find ideal employees using our searchable database of hundreds of candidates and shortlist in minutes.",
  },
];

const FeatureItem = ({ feature }) => {
  return (
    <div className="rounded-[20px] bg-white relative p-6 pt-12 lg:p-12 ml-6 h-full" 
         style={{ border: '2px solid #cddd3a' }}>
      <div className="w-[74px] h-[74px] bg-white rounded-full text-[32px] inline-flex items-center justify-center mb-6 absolute left-0 top-0 -m-6" 
           style={{ color: "#cddd3a", border: '2px solid #cddd3a' }}>
        <feature.icon />
      </div>
      <p className="opacity-70">{feature.description}</p>
    </div>
  );
};

// Rating Component
const Rating = ({ rating }) => (
  <p>
    <span className="flex justify-center">
      {[...Array(5)].map((_, i) => {
        const index = i + 1;
        if (index <= Math.floor(rating)) {
          return <FaStar key={i} className="text-yellow-500 text-xl" />;
        } else if (rating > i && rating < index + 1) {
          return <FaStarHalfAlt key={i} className="text-yellow-500 text-xl" />;
        }
        return <FaStar key={i} className="text-gray-200 text-xl" />;
      })}
    </span>
  </p>
);

const Home = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [testimonials, setTestimonials] = useState([]);
  const [userType, setUserType] = useState(null);
  const [expandedReviews, setExpandedReviews] = useState(new Set());
  
  const auth = getAuth(app);
  const db = getDatabase(app);

  const checkUserType = React.useCallback(() => {
    const user = auth.currentUser;
    if (user) {
      try {
        const employerRef = ref(db, `employers/${user.uid}`);
        const candidateRef = ref(db, `candidates/${user.uid}`);
        
        onValue(employerRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserType('employer');
          }
        });

        onValue(candidateRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserType('candidate');
          }
        });
      } catch (error) {
        console.error('Error checking user type:', error);
      }
    }
  }, [auth, db]);

  const toggleReviewExpansion = (reviewId) => {
  setExpandedReviews(prev => {
    const newSet = new Set(prev);
    if (newSet.has(reviewId)) {
      newSet.delete(reviewId);
    } else {
      newSet.add(reviewId);
    }
    return newSet;
  });
};

  const fetchApprovedReviews = React.useCallback(() => {
    try {
      const approvedReviewsRef = query(
        ref(db, 'reviews'), 
        orderByChild('status'),
        equalTo('approved')
      );
  
      return onValue(approvedReviewsRef, async (snapshot) => {
        if (!snapshot.exists()) {
          setTestimonials([]);
          return;
        }
  
        try {
          const reviewsData = snapshot.val();
          const reviewsArray = [];
  
          for (const [id, review] of Object.entries(reviewsData)) {
            try {
              const userRef = ref(db, `${review.userType}s/${review.userId}`);
              const userSnap = await get(userRef);
              const userData = userSnap.exists() ? userSnap.val() : null;
  
              reviewsArray.push({
                id,
                ...review,
                firstName: userData?.firstName || userData?.profile?.firstName || 'Anonymous',
                lastName: userData?.lastName || userData?.profile?.lastName || 'User',
                companyName: userData?.profile?.companyName || (review.userType === 'employer' ? 'Company' : null)
              });
            } catch (error) {
              console.error(`Error fetching user data for review:`, error);
              reviewsArray.push({
                id,
                ...review,
                firstName: 'Anonymous',
                lastName: 'User',
                companyName: review.userType === 'employer' ? 'Company' : null
              });
            }
          }
  
          setTestimonials(reviewsArray);
        } catch (error) {
          console.error('Error processing reviews:', error);
          setTestimonials([]);
        }
      });
    } catch (error) {
      console.error('Error setting up reviews listener:', error);
      setTestimonials([]);
      return () => {};
    }
  }, [db]);

  useEffect(() => {
    fetchApprovedReviews();
    checkUserType();
  }, [fetchApprovedReviews, checkUserType]);

  const handleSubmitReview = async () => {
    if (!auth.currentUser) {
      toast.error('Please sign in to submit a review');
      return;
    }

    if (!reviewComment || reviewRating === 0) {
      toast.error('Please provide both a rating and comment');
      return;
    }

    try {
      await push(ref(db, 'reviews'), {
        userId: auth.currentUser.uid,
        userType: userType,
        rating: reviewRating,
        comment: reviewComment,
        status: 'pending',
        createdAt: Date.now()
      });

      toast.success('Review submitted successfully and pending approval');
      setIsModalOpen(false);
      setReviewRating(0);
      setReviewComment('');
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Error submitting review');
    }
  };

  const handleGetHiredClick = () => {
    navigate("/candidate-registration");
  };

  const handleFindTalentClick = () => {
    navigate("/employer-registration");
  };

  const handleTemporaryWorkersClick = () => {
    navigate("/temporary-workers/apply");
  };

  return (
    <div className="p-0 m-0">
      {/* Hero Section */}
      <header
        className="max-w-full text-white bg-center bg-cover bg-fixed relative"
        style={{
          backgroundImage: `url(${homeBanner})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      >
        <div className="py-20 sm:py-32 md:py-48 bg-black bg-opacity-50">
          <div className="container px-4 mx-auto">
            <div className="grid grid-cols-12">
              <div className="col-span-12 text-center">
                <div className="w-full md:w-3/4 mx-auto px-4">
                  <p className="text-2xl sm:text-4xl md:text-5xl text-center font-bold uppercase" 
                     style={{ color: "#cddd3a", lineHeight: "1.2" }}>
                    Hire Faster and grow Smarter with our Powerful and Innovative Online Platform
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 md:mt-10">
                    <button 
                      onClick={handleGetHiredClick}
                      className="uppercase hover:scale-95 transition-all bg-[#cddd3a] px-6 py-3 rounded shadow-sm text-blue-950 font-bold w-full sm:w-auto">
                      Get Hired
                    </button>
                    <button 
                      onClick={handleFindTalentClick}
                      className="uppercase hover:scale-95 transition-all bg-white px-6 py-3 rounded shadow-sm text-blue-950 font-bold w-full sm:w-auto">
                      Find Talent
                    </button>
                    <button
                      onClick={handleTemporaryWorkersClick}
                      className="uppercase hover:scale-95 transition-all bg-blue-600 px-6 py-3 rounded shadow-sm text-white font-bold w-full sm:w-auto"
                    >
                      Temporary Workers
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>


      {/* How It Works Section */}
      <div className="max-w-full mx-auto py-12 sm:py-16 md:py-24 px-4 text-left">
        <Typography variant="h3" align="left" gutterBottom 
                  className="font-extrabold text-2xl sm:text-3xl md:text-4xl mb-6" 
                  style={{ color: "#263571" }}>
          How HireMe Works
        </Typography>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column - Text Content */}
          <Box className="flex-1 space-y-8">
            {steps.map((step, index) => (
              <Box key={step.id} className="flex items-start relative">
                {index !== steps.length - 1 && (
                  <div style={{ borderColor: "#cddd3a" }} 
                       className="absolute left-10 top-10 h-[calc(100%+2rem)] border-l-4 transform -translate-x-1/2 z-0">
                  </div>
                )}
                <Box className="flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center text-white font-extrabold text-3xl relative z-10" 
                     style={{ background: "#263571", color: "#cddd3a" }}>
                  {step.id}
                </Box>
                <Box className="ml-4">
                  <Typography variant="h4" className="font-extrabold text-xl" style={{ color: "#263571" }}>
                    {step.title.split(step.highlight).map((part, i, arr) => (
                      <React.Fragment key={i}>
                        {part}
                        {i < arr.length - 1 && <span style={{ color: "#cddd3a" }}>{step.highlight}</span>}
                      </React.Fragment>
                    ))}
                  </Typography>
                  <Typography className="mt-4 text-blue-900">
                    {step.description}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Right Column - Images */}
          <div className="space-y-6 lg:sticky lg:top-24">
            <img 
              src={howHireMeWorks} 
              alt="How HireMe Works" 
              className="w-full object-cover hover:scale-105 transition-transform duration-300"
            />
            {/* <img 
              src={howHireMeWorks1} 
              alt="How HireMe Works Additional" 
              className="w-full object-cover hover:scale-105 transition-transform duration-300"
            /> */}
          </div>
        </div>
      </div>

      {/* What We Do Section */}
      <section className="py-14 md:py-24 bg-blue-50 text-black">
        <div className="container px-4 mx-auto">
          <div className="grid grid-cols-12 mb-12">
            <div className="col-span-12 lg:col-span-5">
              <h2 style={{ color: "#263571" }} className="text-[25px] md:text-[45px] leading-none font-bold mb-6">
                What We Do
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-y-12 md:gap-x-6">
            {whatwedo.map((feature, i) => (
              <div className="col-span-12 md:col-span-4" key={i}>
                <FeatureItem feature={feature} />
              </div>
            ))}
          </div>
        </div>
        </section>

{/* Testimonials Section */}
<section style={{ background: "#fdffb3" }} className="py-12 sm:py-16 md:py-24">
  <div className="container px-4 mx-auto">
    <div className="text-center mb-12">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-900">
        Reviews
      </h2>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 md:gap-8 pt-10">
      {testimonials.map((testimonial, i) => (
        <div key={i} className="relative pt-10">
          <div className="bg-blue-950 shadow-lg rounded-xl h-full p-6 transition-transform hover:scale-105 duration-300">
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 w-20 h-20 
                          bg-blue-950 border rounded-full flex items-center justify-center">
              {testimonial.userType === 'employer' ? (
                <FaBuilding className="text-[#cddd3a] w-10 h-10" />
              ) : (
                <FaUserTie className="text-[#cddd3a] w-10 h-10" />
              )}
            </div>
            <div className="pt-8 text-center">
  <h4 className="text-xl font-bold text-white mt-4">
    {testimonial.firstName} {testimonial.lastName}
  </h4>
  {testimonial.companyName && testimonial.userType === 'employer' && (
    <p className="text-lg font-bold text-[#cddd3a] mt-2">
      {testimonial.companyName}
    </p>
  )}
  <p className="text-sm text-gray-300 mt-1">
    {testimonial.userType === 'employer' ? 'Employer' : 'Job Seeker'}
  </p>
  <div className="mt-4">
    <p className={`text-base font-medium text-white italic ${
      !expandedReviews.has(testimonial.id) ? 'line-clamp-3' : ''
    }`}>
      {testimonial.comment}
    </p>
    {testimonial.comment && testimonial.comment.length > 150 && (
      <button
        onClick={() => toggleReviewExpansion(testimonial.id)}
        className="text-[#cddd3a] text-sm mt-2 hover:underline transition-colors"
      >
        {expandedReviews.has(testimonial.id) ? 'Show Less' : 'Read More'}
      </button>
    )}
  </div>
  <div className="mt-4">
    <Rating rating={testimonial.rating} />
  </div>
</div>
          </div>
        </div>
      ))}
    </div>
  
    <div className="w-full flex flex-col sm:flex-row justify-center gap-4 mt-12">
      <Button
        variant="contained"
        onClick={() => setIsModalOpen(true)}
        className="w-full sm:w-auto bg-blue-950 hover:bg-blue-900 text-white"
      >
        Submit a review
      </Button>
    </div>
  </div>
</section>

{/* Review Modal */}
<Modal
  open={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  aria-labelledby="review-modal-title"
>
  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
              w-11/12 max-w-md bg-white rounded-lg shadow-xl p-6">
    <h2 className="text-2xl font-bold text-blue-950 mb-6" id="review-modal-title">
      Submit Your Review
    </h2>
    
    {!auth.currentUser ? (
      <div className="text-center">
        <p className="text-gray-600 mb-4">Please sign in to submit a review</p>
        <Button
          onClick={() => setIsModalOpen(false)}
          variant="contained"
          className="bg-blue-950 hover:bg-blue-900 text-white"
        >
          Got it
        </Button>
      </div>
    ) : !userType ? (
      <div className="text-center">
        <p className="text-gray-600 mb-4">Please complete your profile to submit a review</p>
        <Button
          onClick={() => setIsModalOpen(false)}
          variant="contained"
          className="bg-blue-950 hover:bg-blue-900 text-white"
        >
          Got it
        </Button>
      </div>
    ) : (
      <>
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">Submitting as: {userType === 'employer' ? 'Employer' : 'Job Seeker'}</p>
          <label className="block text-gray-700 mb-2">Your Rating</label>
          <MuiRating
            value={reviewRating}
            onChange={(_, newValue) => setReviewRating(newValue)}
            size="large"
            className="text-blue-950"
          />
        </div>
        
        <div className="mb-6">
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Your Review"
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Share your experience..."
            className="bg-white"
          />
        </div>
        
        <div className="flex justify-end space-x-4">
          <Button
            onClick={() => setIsModalOpen(false)}
            variant="outlined"
            className="text-blue-950 border-blue-950 hover:border-blue-900"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmitReview}
            variant="contained"
            className="bg-blue-950 hover:bg-blue-900 text-white"
            disabled={!reviewComment || reviewRating === 0}
          >
            Submit Review
          </Button>
        </div>
      </>
    )}
  </div>
</Modal>
</div>
);
};

export default Home;  