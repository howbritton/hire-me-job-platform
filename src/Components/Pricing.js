import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, get, onValue, update } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';
import { toast, ToastContainer } from 'react-toastify';
import "react-toastify/dist/ReactToastify.css";
import pricingBanner from '../assets/pricing-banner.png';

const Pricing = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [promoCodes, setPromoCodes] = useState({});
  const [promoCodeValidation, setPromoCodeValidation] = useState({});
  const [validPromoCodeDetails, setValidPromoCodeDetails] = useState({});
  const [declinedPayments, setDeclinedPayments] = useState([]);
  const [notifiedDeclinedPayments, setNotifiedDeclinedPayments] = useState(new Set());
  const navigate = useNavigate();
  const db = getDatabase(app);
  const auth = getAuth(app);

  // Add the formatDate function exactly like EmployerProfile.js
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const fetchCandidateCount = useCallback(async () => {
    try {
      // Get all candidates from the database
      const candidatesRef = ref(db, 'candidates');
      const candidatesSnapshot = await get(candidatesRef);
      
      if (candidatesSnapshot.exists()) {
        // Filter to only count candidates with completed profiles
        const candidatesData = candidatesSnapshot.val();
        const completedProfilesCount = Object.values(candidatesData).filter(candidate => {
          // Check if the candidate has a profile with required fields completed
          return (
            candidate.profileStatus === 'active' && 
            candidate.isPublic === true &&
            candidate.profile && 
            candidate.profile.resume && 
            candidate.profile.resume.url
          );
        }).length;
        
        console.log('Counted complete candidate profiles:', completedProfilesCount);
        setCandidateCount(completedProfilesCount);
      } else {
        setCandidateCount(0);
      }
    } catch (error) {
      console.error('Error counting candidates:', error);
    }
  }, [db]);

  // 🔥 NEW: Function to send admin notifications for pending payments
  const checkAndNotifyPendingPayments = useCallback(async (userId) => {
    try {
      console.log('[Admin Notification Check] Checking for pending payments that need notification');
      
      const functions = getFunctions();
      const notifyAdminPayment = httpsCallable(functions, 'notifyPaymentApprovalAdmin');
      let totalNotificationsSent = 0;
      
      // ✅ CHECK PAYMENTS NODE
      const paymentsRef = ref(db, `payments/${userId}`);
      const paymentsSnapshot = await get(paymentsRef);
      
      if (paymentsSnapshot.exists()) {
        const payments = paymentsSnapshot.val();
        
        // Find pending payments that haven't been notified yet
        const pendingPayments = Object.entries(payments)
          .filter(([id, payment]) => 
            payment.status === 'pending' && 
            !payment.adminNotificationSent
          )
          .map(([id, payment]) => ({ id, source: 'payments', ...payment }));
        
        console.log('[Admin Notification Check] Found pending payments in payments node:', pendingPayments.length);
        
        // Send notification for each pending payment
        for (const payment of pendingPayments) {
          try {
            console.log('[Admin Notification] Sending notification for payment:', payment.id);
            
            const notificationData = {
              paymentId: payment.id,
              amount: parseFloat(payment.amount),
              currency: payment.currency || "USD",
              packageId: payment.packageId,
              packageName: payment.packageName,
              packageDetails: payment.packageDetails || {
                duration: payment.packageDuration || 30,
                jobPostLimit: payment.jobPostLimit || 10,
                features: payment.features || {}
              },
              employerId: payment.employerId,
              employerEmail: payment.employerEmail,
              timestamp: payment.createdAt || new Date().toISOString(),
              paymentMethod: payment.paymentMethod || 'card',
              isProratedPayment: payment.isProratedPayment || false,
              originalPrice: payment.originalPrice || payment.amount,
              finalPrice: payment.finalPrice || payment.amount,
              promoCodeApplied: payment.promoCodeApplied || false,
              promoCodeDetails: payment.promoCodeDetails || null,
              status: 'pending',
              isFreeSubscription: payment.amount === 0,
              requiresApproval: true
            };
            
            const result = await notifyAdminPayment(notificationData);
            console.log('[Admin Notification] Notification sent successfully for payment:', payment.id);
            
            // Mark payment as notified
            await update(ref(db, `payments/${userId}/${payment.id}`), {
              adminNotificationSent: true,
              adminNotificationSentAt: new Date().toISOString()
            });
            
            totalNotificationsSent++;
            
          } catch (notificationError) {
            console.error('[Admin Notification] Failed to send notification for payment:', payment.id, notificationError);
            toast.error(`Failed to send admin notification for payment ${payment.id.substring(0, 8)}...`);
          }
        }
      }
      
      // ✅ CHECK CHECKOUT SESSIONS NODE
      const checkoutSessionsRef = ref(db, 'checkoutSessions');
      const checkoutSessionsSnapshot = await get(checkoutSessionsRef);
      
      if (checkoutSessionsSnapshot.exists()) {
        const checkoutSessions = checkoutSessionsSnapshot.val();
        
        // Find checkout sessions for this user that are pending and haven't been notified
        const pendingCheckoutSessions = Object.entries(checkoutSessions)
          .filter(([sessionId, session]) => 
            session.userId === userId && 
            session.status === 'pending' &&
            !session.adminNotificationSent
          )
          .map(([sessionId, session]) => ({ 
            id: sessionId, 
            source: 'checkoutSessions',
            ...session 
          }));
        
        console.log('[Admin Notification Check] Found pending checkout sessions:', pendingCheckoutSessions.length);
        
        // Send notification for each pending checkout session
        for (const session of pendingCheckoutSessions) {
          try {
            console.log('[Admin Notification] Sending notification for checkout session:', session.id);
            
            // Get employer email from the current user or try to fetch from employers collection
            let employerEmail = session.userEmail || 'Unknown';
            
            // If we don't have email in session, try to get it from the current user (if this is their session)
            if ((!employerEmail || employerEmail === 'Unknown') && currentUser && currentUser.uid === session.userId) {
              employerEmail = currentUser.email || 'Unknown';
            }
            
            // If still no email, try to fetch from employers collection
            if ((!employerEmail || employerEmail === 'Unknown')) {
              try {
                const employerRef = ref(db, `employers/${session.userId}`);
                const employerSnapshot = await get(employerRef);
                if (employerSnapshot.exists()) {
                  const employerData = employerSnapshot.val();
                  employerEmail = employerData.email || employerData.profile?.email || 'Unknown';
                }
              } catch (fetchError) {
                console.error('[Admin Notification] Failed to fetch employer email:', fetchError);
              }
            }
            
            const notificationData = {
              paymentId: session.id,
              amount: parseFloat(session.amount),
              currency: session.currency || "USD",
              packageId: session.packageId,
              packageName: session.packageName || 'Package',
              packageDetails: session.package || {
                duration: session.packageDuration || 30,
                jobPostLimit: 10,
                features: {}
              },
              employerId: session.userId,
              employerEmail: employerEmail,
              timestamp: session.createdAt || session.lastUpdated || new Date().toISOString(),
              paymentMethod: session.paymentMethod || (session.amount === 0 ? 'promo_code_100_percent' : 'card'),
              isProratedPayment: false,
              originalPrice: session.originalPrice || session.amount,
              finalPrice: session.finalPrice || session.amount,
              promoCodeApplied: session.promoCodeApplied || false,
              promoCodeDetails: session.promoCodeDetails || null,
              status: 'pending',
              isFreeSubscription: session.amount === 0,
              requiresApproval: true
            };
            
            console.log('[Admin Notification] Notification data for session:', session.id, 'Email:', employerEmail);
            
            const result = await notifyAdminPayment(notificationData);
            console.log('[Admin Notification] Notification sent successfully for checkout session:', session.id);
            
            // Mark checkout session as notified
            await update(ref(db, `checkoutSessions/${session.id}`), {
              adminNotificationSent: true,
              adminNotificationSentAt: new Date().toISOString()
            });
            
            totalNotificationsSent++;
            
          } catch (notificationError) {
            console.error('[Admin Notification] Failed to send notification for checkout session:', session.id, notificationError);
            toast.error(`Failed to send admin notification for session ${session.id.substring(0, 8)}...`);
          }
        }
      }
      
      // Show summary toast
      if (totalNotificationsSent > 0) {
        console.log(`[Admin Notification Check] Successfully sent ${totalNotificationsSent} admin notification${totalNotificationsSent > 1 ? 's' : ''}`);
      } else {
        console.log('[Admin Notification Check] No pending payments found that need notification');
      }
      
    } catch (error) {
      console.error('[Admin Notification Check] Error checking pending payments:', error);
      toast.error('Error checking for pending payments');
    }
  }, [db, currentUser]);

  // Add the calculateSubscriptionFromPayments function from EmployerProfile
  const calculateSubscriptionFromPayments = useCallback(async (userId) => {
    try {
      // Get the user's payment history
      const paymentsRef = ref(db, `payments/${userId}`);
      const paymentsSnapshot = await get(paymentsRef);
      
      if (!paymentsSnapshot.exists()) {
        return null;
      }

      const payments = paymentsSnapshot.val();
      
      // Get the most recent APPROVED payment (not just completed)
      const approvedPayments = Object.entries(payments)
        .filter(([id, payment]) => payment.status === 'approved' || payment.status === 'completed')
        .map(([id, payment]) => ({
          id,
          ...payment,
          createdAt: new Date(payment.createdAt)
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
      
      if (approvedPayments.length === 0) {
        return null;
      }

      const latestPayment = approvedPayments[0];
      
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
          paymentStatus: 'approved',
          paymentId: latestPayment.id,
          paymentDate: paymentDate.toISOString()
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
        paymentStatus: 'approved',
        paymentId: latestPayment.id,
        paymentDate: paymentDate.toISOString()
      };
      
    } catch (error) {
      console.error('Error calculating subscription from payments:', error);
      return null;
    }
  }, [db]);

  // 🔥 COMPREHENSIVE FIX: Function to get pending payments
const getPendingPayments = useCallback(async (userId) => {
  const [paymentsSnapshot, checkoutSessionsSnapshot] = await Promise.all([
    get(ref(db, `payments/${userId}`)),
    get(ref(db, 'checkoutSessions'))
  ]);
  
  let allPendingPayments = [];
  let declinedPaymentIds = new Set();
  let approvedPaymentIds = new Set();
  
  // First, collect all declined and approved payment IDs
  if (paymentsSnapshot.exists()) {
    const payments = paymentsSnapshot.val();
    
    Object.entries(payments).forEach(([id, payment]) => {
      if (payment.status === 'declined') {
        declinedPaymentIds.add(payment.orderId || id);
        declinedPaymentIds.add(id);
      } else if (payment.status === 'approved' || payment.status === 'completed') {
        approvedPaymentIds.add(payment.orderId || id);
        approvedPaymentIds.add(id);
      }
    });
    
    // Only include truly pending payments (not declined or approved)
    const pendingPaymentsList = Object.entries(payments)
      .filter(([id, payment]) => payment.status === 'pending')
      .map(([id, payment]) => ({
        id,
        source: 'payments',
        ...payment,
        createdAt: new Date(payment.createdAt)
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
    
    allPendingPayments = [...allPendingPayments, ...pendingPaymentsList];
  }
  
  // Check checkout sessions - EXCLUDE if corresponding payment is declined/approved
  if (checkoutSessionsSnapshot.exists()) {
    const checkoutSessions = checkoutSessionsSnapshot.val();
    
    const pendingCheckoutSessions = Object.entries(checkoutSessions)
      .filter(([sessionId, session]) => {
        // Must be for this user
        if (session.userId !== userId) return false;
        
        // Must be pending status
        if (session.status !== 'pending') return false;
        
        // ❌ EXCLUDE if there's a declined payment for this session
        if (declinedPaymentIds.has(sessionId)) {
          console.log(`🔴 Excluding checkout session ${sessionId} - payment was declined`);
          return false;
        }
        
        // ❌ EXCLUDE if there's an approved payment for this session  
        if (approvedPaymentIds.has(sessionId)) {
          console.log(`✅ Excluding checkout session ${sessionId} - payment was approved`);
          return false;
        }
        
        // ❌ EXCLUDE if already migrated to payments
        if (allPendingPayments.some(payment => 
          payment.id === sessionId || payment.orderId === sessionId
        )) {
          console.log(`🔄 Excluding checkout session ${sessionId} - already in payments`);
          return false;
        }
        
        return true;
      })
      .map(([sessionId, session]) => ({
        id: sessionId,
        source: 'checkoutSessions',
        packageId: session.packageId,
        packageName: session.packageName || 'Package',
        amount: session.amount,
        status: 'awaiting_approval',
        createdAt: new Date(session.createdAt || session.lastUpdated || Date.now()),
        orderId: sessionId,
        paymentMethod: session.paymentMethod || (session.amount === 0 ? 'promo_code_100_percent' : 'card'),
        originalPrice: session.originalPrice || session.amount,
        finalPrice: session.finalPrice || session.amount,
        discount: session.discount || 0,
        promoCodeApplied: session.promoCodeApplied || false,
        isFreeSubscription: session.amount === 0
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
    
    allPendingPayments = [...allPendingPayments, ...pendingCheckoutSessions];
  }
  
  console.log(`📊 Final pending payments count: ${allPendingPayments.length}`);
  console.log(`🔴 Declined payment IDs:`, Array.from(declinedPaymentIds));
  console.log(`✅ Approved payment IDs:`, Array.from(approvedPaymentIds));
  
  return allPendingPayments;
}, [db]);

  // 🔥 NEW: Function to refresh payment state after decline
  const refreshPaymentState = useCallback(async () => {
    if (currentUser && userType === 'employer') {
      const [subscription, pendingPayments] = await Promise.all([
        calculateSubscriptionFromPayments(currentUser.uid),
        getPendingPayments(currentUser.uid)
      ]);
      
      setActiveSubscription(subscription);
      setPendingPayments(pendingPayments);
    }
  }, [currentUser, userType, calculateSubscriptionFromPayments, getPendingPayments]);

  // 🔥 NEW: Function to handle payment decline notifications
  const handlePaymentDecline = useCallback((declinedPayment) => {
  // Check if we've already notified about this payment
  if (notifiedDeclinedPayments.has(declinedPayment.id)) {
    console.log(`🔕 Skipping duplicate toast for payment ${declinedPayment.id}`);
    return;
  }

  // Mark this payment as notified
  setNotifiedDeclinedPayments(prev => new Set([...prev, declinedPayment.id]));

  // Reset any promo codes that were applied
  setPromoCodes(prev => ({
    ...prev,
    [declinedPayment.packageId]: ''
  }));
  
  setPromoCodeValidation(prev => ({
    ...prev,
    [declinedPayment.packageId]: null
  }));
  
  setValidPromoCodeDetails(prev => ({
    ...prev,
    [declinedPayment.packageId]: null
  }));
  
  // Show user-friendly message (only once per payment)
  // toast.error(
  //   `Your payment for ${declinedPayment.packageName} was declined. ` +
  //   `Reason: ${declinedPayment.declineReason || 'Please contact support for details.'} ` +
  //   `You can try purchasing again.`,
  //   {
  //     autoClose: 8000, // Show longer for declined payments
  //     toastId: `decline-${declinedPayment.id}` // Prevent duplicate toasts
  //   }
  // );
}, [notifiedDeclinedPayments]);

  // Function to handle promo code input change
  const handlePromoCodeChange = (e, packageId) => {
    const { value } = e.target;
    setPromoCodes(prev => ({
      ...prev,
      [packageId]: value
    }));
    // Reset validation state when input changes
    setPromoCodeValidation(prev => ({
      ...prev,
      [packageId]: null
    }));
    // Reset valid promo code details
    setValidPromoCodeDetails(prev => ({
      ...prev,
      [packageId]: null
    }));
  };

  // Function to validate promo code
  const validatePromoCode = async (packageId) => {
    const promoCode = promoCodes[packageId];
    
    if (!promoCode) {
      setPromoCodeValidation(prev => ({
        ...prev,
        [packageId]: { valid: false, message: 'Please enter a promo code' }
      }));
      return;
    }

    try {
      // Check if the promo code exists
      const promoCodesRef = ref(db, 'promoCodes');
      const promoCodesSnapshot = await get(promoCodesRef);
      
      if (promoCodesSnapshot.exists()) {
        const allPromoCodes = promoCodesSnapshot.val();
        
        // Find the promo code (case insensitive)
        const promoEntry = Object.entries(allPromoCodes).find(([id, data]) => 
          data.code && data.code.toLowerCase() === promoCode.toLowerCase()
        );
        
        if (promoEntry) {
          const [id, promoData] = promoEntry;
          
          // Check if the promo code is active
          if (promoData.status !== 'active') {
            setPromoCodeValidation(prev => ({
              ...prev,
              [packageId]: { valid: false, message: 'This promo code is not active' }
            }));
            return;
          }
          
          // Check if the promo code is for this package
          if (promoData.packageId !== packageId) {
            setPromoCodeValidation(prev => ({
              ...prev,
              [packageId]: { valid: false, message: 'This promo code is not valid for this package' }
            }));
            return;
          }
          
          // Check if the promo code has reached its maximum uses
          if (promoData.maxUses && promoData.usageCount >= promoData.maxUses) {
            setPromoCodeValidation(prev => ({
              ...prev,
              [packageId]: { valid: false, message: 'This promo code has reached its usage limit' }
            }));
            return;
          }
          
          // Promo code is valid!
          setPromoCodeValidation(prev => ({
            ...prev,
            [packageId]: { valid: true, message: 'Valid promo code!' }
          }));
          
          // Store the promo code details
          setValidPromoCodeDetails(prev => ({
            ...prev,
            [packageId]: {
              id,
              ...promoData
            }
          }));
        } else {
          setPromoCodeValidation(prev => ({
            ...prev,
            [packageId]: { valid: false, message: 'Invalid promo code' }
          }));
        }
      } else {
        setPromoCodeValidation(prev => ({
          ...prev,
          [packageId]: { valid: false, message: 'No promo codes available' }
        }));
      }
    } catch (error) {
      console.error('Error validating promo code:', error);
      setPromoCodeValidation(prev => ({
        ...prev,
        [packageId]: { valid: false, message: 'Error validating promo code' }
      }));
    }
  };

  // 🔥 ENHANCED: Real-time listener for payment status changes
useEffect(() => {
  if (currentUser && userType === 'employer') {
    // Listen for changes to user's payments
    const paymentsRef = ref(db, `payments/${currentUser.uid}`);
    const unsubscribePayments = onValue(paymentsRef, async (snapshot) => {
      if (snapshot.exists()) {
        const payments = snapshot.val();
        
        // Find newly declined payments
        const newDeclinedPayments = Object.entries(payments)
          .filter(([id, payment]) => 
            payment.status === 'declined' && 
            !declinedPayments.some(dp => dp.id === id)
          )
          .map(([id, payment]) => ({ id, ...payment }));
        
        // If we find newly declined payments, handle them
        if (newDeclinedPayments.length > 0) {
          console.log('🔴 Found newly declined payments:', newDeclinedPayments);
          
          setDeclinedPayments(prev => [...prev, ...newDeclinedPayments]);
          
          // Handle each declined payment
          newDeclinedPayments.forEach(payment => {
            handlePaymentDecline(payment);
          });
          
          // 🔥 CRITICAL: Immediately refresh payment state to remove from pending
          console.log('🔄 Refreshing payment state after decline detection...');
          setTimeout(async () => {
            const [newSubscription, newPendingPayments] = await Promise.all([
              calculateSubscriptionFromPayments(currentUser.uid),
              getPendingPayments(currentUser.uid)
            ]);
            
            console.log('📊 Updated pending payments:', newPendingPayments);
            setActiveSubscription(newSubscription);
            setPendingPayments(newPendingPayments);
          }, 500); // Small delay to ensure database consistency
        }
        
        // Also check for approved payments to refresh subscription
        const newApprovedPayments = Object.entries(payments)
          .filter(([id, payment]) => payment.status === 'approved')
          .map(([id, payment]) => ({ id, ...payment }));
          
        if (newApprovedPayments.length > 0) {
          console.log('✅ Found approved payments, refreshing subscription...');
          setTimeout(async () => {
            await refreshPaymentState();
          }, 500);
        }
      }
    });

    return () => unsubscribePayments();
  }
}, [currentUser, userType, db, handlePaymentDecline, declinedPayments, calculateSubscriptionFromPayments, getPendingPayments]);

  // 🔥 NEW: Auto-check for pending payments when user loads the page
  useEffect(() => {
    // Auto-check for pending payments when user is loaded and is an employer
    if (currentUser && userType === 'employer') {
      // Delay the check to allow other data to load first
      const timeoutId = setTimeout(() => {
        checkAndNotifyPendingPayments(currentUser.uid);
      }, 3000); // 3 second delay
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentUser, userType, checkAndNotifyPendingPayments]);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // Check if user is an employer or candidate
        const userRef = ref(db, `employers/${user.uid}`);
        
        onValue(userRef, async (snapshot) => {
          if (snapshot.exists()) {
            setUserType('employer');
            
            // UPDATED: Use calculateSubscriptionFromPayments instead of reading from employer subscription field
            const currentSubscription = await calculateSubscriptionFromPayments(user.uid);
            
            if (currentSubscription) {
              // User has an active subscription calculated from payments
              setActiveSubscription(currentSubscription);
              setPendingPayments([]); // Clear pending payments if active subscription exists
            } else {
              // No active subscription, check both payments and checkout sessions for pending
              const allPendingPayments = await getPendingPayments(user.uid);
              setPendingPayments(allPendingPayments);
              setActiveSubscription(null);
            }
          } else {
            // Check if the user is a candidate
            const candidateRef = ref(db, `candidates/${user.uid}`);
            onValue(candidateRef, (snapshot) => {
              if (snapshot.exists()) {
                setUserType('candidate');
                setActiveSubscription(null);
                setPendingPayments([]);
              } else {
                // Check if the user is an admin
                const adminRef = ref(db, `admins/${user.uid}`);
                onValue(adminRef, (snapshot) => {
                  if (snapshot.exists()) {
                    setUserType('admin');
                    setActiveSubscription(null);
                    setPendingPayments([]);
                  }
                });
              }
            });
          }
        });
      } else {
        setUserType(null);
        setActiveSubscription(null);
        setPendingPayments([]);
      }
    });

    // Fetch packages
    const fetchPackages = async () => {
      try {
        const packagesSnapshot = await get(ref(db, 'packages'));
        
        if (packagesSnapshot.exists()) {
          const packagesData = Object.entries(packagesSnapshot.val())
            .map(([id, data]) => ({ id, ...data }))
            .filter(pkg => pkg.status === 'active')
            .sort((a, b) => a.price - b.price);
          
          setPackages(packagesData);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching packages:', error);
        toast.error('Error loading packages. Please try again later.');
        setLoading(false);
      }
    };

    // Fetch candidate count and packages
    fetchCandidateCount();
    fetchPackages();

    // Cleanup subscription
    return () => {
      unsubscribeAuth();
    };
  }, [db, auth, fetchCandidateCount, navigate, calculateSubscriptionFromPayments, getPendingPayments]);

  const handleSelectPackage = async (pkg) => {
    if (!currentUser) {
      toast.info('Please sign in as an employer to purchase a package');
      navigate('/employer-sign-in', { state: { from: '/pricing' } });
      return;
    }

    if (userType !== 'employer') {
      toast.info('Only employers can purchase packages');
      return;
    }

    // Check if a valid promo code was applied
    const promoCodeDetail = validPromoCodeDetails[pkg.id];
    let discount = 0;
    let finalPrice = pkg.price;
    
    if (promoCodeDetail) {
      discount = (pkg.price * promoCodeDetail.discountPercentage) / 100;
      finalPrice = pkg.price - discount;
      
      if (finalPrice < 0) finalPrice = 0; // Ensure price doesn't go negative

      // Just show success message - usage tracking happens in checkout
      toast.success(`Promo code "${promoCodeDetail.code}" applied successfully!`);
    }

    // Navigate to checkout with the package data and promo code details
    navigate('/checkout', { 
      state: { 
        package: {
          ...pkg,
          finalPrice: finalPrice,
          originalPrice: pkg.price,
          discount: discount,
          promoCodeApplied: promoCodeDetail ? true : false
        },
        promoCode: promoCodeDetail,
        originalPrice: pkg.price,
        discount: discount,
        finalPrice: finalPrice
      } 
    });
  };

  const getCurrencySymbol = (price) => {
    return `USD$${price}`;
  };

  const formatFeature = (feature, available) => {
    return (
      <div className="flex items-center mb-2">
        {available ? (
          <span className="text-blue-600 mr-2">✓</span>
        ) : (
          <span className="text-red-400 mr-2">✗</span>
        )}
        <span className={available ? "text-gray-800" : "text-gray-500"}>{feature}</span>
      </div>
    );
  };

  // Check if a package is the currently active one
  const isActivePackage = (pkg) => {
    if (!activeSubscription || !activeSubscription.package) return false;
    
    // Check if the package ID matches
    if (pkg.id === activeSubscription.package.id) return true;
    
    // Fallback: check if name and price match (in case ID isn't available)
    return (
      pkg.name === activeSubscription.package.name && 
      pkg.price === activeSubscription.package.price
    );
  };

  // Check if a package has pending payments (including checkout sessions)
  const hasPendingPayments = (pkg) => {
    return pendingPayments.some(payment => payment.packageId === pkg.id);
  };

  // Get the status of a pending payment for a package
  const getPendingPaymentStatus = (pkg) => {
    const pendingPayment = pendingPayments.find(payment => payment.packageId === pkg.id);
    if (!pendingPayment) return null;
    
    if (pendingPayment.source === 'checkoutSessions') {
      return 'awaiting_admin_review';
    } else {
      return 'pending_approval';
    }
  };

  // 🔥 ENHANCED: Check if package is available for purchase
  const isPackageAvailable = (pkg) => {
    const isActive = isActivePackage(pkg) && activeSubscription?.status === 'active';
    const isPending = hasPendingPayments(pkg);
    
    // Package is available if:
    // - Not currently active
    // - No pending payments
    return !isActive && !isPending;
  };

  // Calculate discounted price
  const calculateDiscountedPrice = (packageId, originalPrice) => {
    const promoDetail = validPromoCodeDetails[packageId];
    if (!promoDetail) return null;
    
    const discount = (originalPrice * promoDetail.discountPercentage) / 100;
    const finalPrice = originalPrice - discount;
    
    return {
      originalPrice,
      discountAmount: discount,
      finalPrice: finalPrice < 0 ? 0 : finalPrice,
      discountPercentage: promoDetail.discountPercentage
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
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
        limit={3}
      />
      {/* Hero Section */}
      <div className="relative bg-cover" style={{ 
  backgroundImage: `url(${pricingBanner})`,
  backgroundPosition: 'center 30%' // Adjusts vertical position (0% = top, 100% = bottom)
}}>
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <div className="container mx-auto text-center py-32 relative z-10">
          <h1 className="text-4xl md:text-5xl font-bold text-yellow-300 mb-4">
            REMOVING CHALLENGES
          </h1>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            SO EMPLOYERS CAN RECRUIT
          </h2>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            CANDIDATES WHO FIT THEIR COMPANY 
          </h2>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            CULTURE
          </h2>
        </div>
      </div>

      {/* Current Subscription Notice - Only shown if user has an active subscription */}
      {activeSubscription && (
        <div className="bg-blue-50 py-4 border-b border-blue-100">
          <div className="container mx-auto text-center">
            <h3 className="text-xl font-semibold text-blue-800">
              You have an {activeSubscription.status === 'expired' ? 'expired' : 'active'} <span className="text-blue-600 font-bold">{activeSubscription.package?.name}</span> subscription
            </h3>
            <p className="text-blue-700">
              Valid until: {formatDate(activeSubscription.endDate)}
            </p>
            
            {/* Show message for expired subscriptions */}
            {activeSubscription.status === 'expired' && (
              <p className="text-orange-600 mt-2">
                Purchase a new package below to reactivate your account
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pending Payments Notice */}
      {pendingPayments.length > 0 && (
        <div className="bg-yellow-50 py-4 border-b border-yellow-100">
          <div className="container mx-auto text-center">
            <h3 className="text-xl font-semibold text-yellow-800">
              You have {pendingPayments.length} payment{pendingPayments.length > 1 ? 's' : ''} awaiting admin approval
            </h3>
            <p className="text-yellow-700">
              Your subscription will be activated once approved by our admin team
            </p>
          </div>
        </div>
      )}

      {/* Declined Payments Notice */}
      {/* {declinedPayments.length > 0 && (
        <div className="bg-red-50 py-4 border-b border-red-100">
          <div className="container mx-auto text-center">
            <h3 className="text-xl font-semibold text-red-800">
              {declinedPayments.length} payment{declinedPayments.length > 1 ? 's have' : ' has'} been declined
            </h3>
            <p className="text-red-700">
              You can try purchasing again. Check your notifications for decline reasons.
            </p>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDeclinedPayments([]);
              }}
              className="text-red-600 hover:text-red-500 text-sm font-medium mt-2 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )} */}

      {/* Candidate Count Banner */}
      <div className="bg-white py-10 border-b">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center text-blue-900">
            Total of <span className="text-yellow-500">{candidateCount}</span> completed candidate profiles listed
          </h2>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="container mx-auto py-16 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {packages.map((pkg) => {
            const isActive = isActivePackage(pkg) && activeSubscription?.status === 'active';
            const isPending = hasPendingPayments(pkg);
            const pendingStatus = getPendingPaymentStatus(pkg);
            const discountInfo = calculateDiscountedPrice(pkg.id, pkg.price);
            const packageAvailable = isPackageAvailable(pkg);
            
            return (
              <div key={pkg.id} className={`rounded-lg overflow-hidden ${
                isActive 
                  ? 'bg-blue-50 border-2 border-blue-500' 
                  : isPending 
                    ? 'bg-yellow-50 border-2 border-yellow-500'
                    : 'bg-green-50'
              }`}>
                <div className="p-8">
                  {isActive && (
                    <div className="bg-blue-500 text-white py-1 px-3 rounded-full text-sm font-bold inline-block mb-4">
                      CURRENT PLAN
                    </div>
                  )}
                  
                  {isPending && (
                    <div className="bg-yellow-500 text-white py-1 px-3 rounded-full text-sm font-bold inline-block mb-4">
                      {pendingStatus === 'awaiting_admin_review' ? 'AWAITING REVIEW' : 'PENDING APPROVAL'}
                    </div>
                  )}
                  
                  <h3 className="text-3xl font-bold text-blue-700 mb-4">{pkg.name}</h3>
                  <p className="text-3xl font-bold text-blue-700 mb-2">
                    {discountInfo ? (
                      <>
                        <span className="line-through text-gray-500 text-xl mr-2">
                          {getCurrencySymbol(pkg.price)}
                        </span>
                        {getCurrencySymbol(discountInfo.finalPrice.toFixed(2))}
                      </>
                    ) : (
                      getCurrencySymbol(pkg.price)
                    )}
                  </p>
                  {discountInfo && (
                    <p className="text-green-600 font-semibold mb-2">
                      {discountInfo.discountPercentage}% discount applied!
                    </p>
                  )}
                  <p className="text-xl font-bold text-gray-800 mb-6">
                    Duration: {pkg.duration === 1 ? '1 Day' : `${pkg.duration} Days`}
                  </p>
                  
                  <div className="bg-blue-100 p-4 rounded-lg text-center mb-6">
                    <span className="inline-block text-blue-700">
                      <i className="fas fa-briefcase mr-2"></i> 
                      {pkg.jobPostLimit === 1 
                        ? '1 Job Post' 
                        : `${pkg.jobPostLimit} Job Posts`}
                    </span>
                  </div>

                  <p className="text-gray-700 mb-6">
                    {pkg.jobPostLimit === 1
                      ? 'Perfect for single job posting needs'
                      : `Ideal for posting up to ${pkg.jobPostLimit} jobs during the subscription period`}
                  </p>

                  <div className="mb-8">
                    {formatFeature(pkg.jobPostLimit === 1 ? '1 Job Post' : `${pkg.jobPostLimit} Job Posts`, true)}
                    {formatFeature('Access Candidate List', pkg.features.accessCandidateList)}
                    {formatFeature('Allow Job Posting', pkg.features.allowJobPosting)}
                    {formatFeature('Email Blast', pkg.features.emailBlast)}
                    {formatFeature('Social Media Post', pkg.features.socialMediaBlast)}
                    {formatFeature('Pre-Screening Questions', pkg.features.addPreScreeningQuestions)}
                  </div>

                  {/* Promo Code Input Field - Only show if package is available */}
                  {packageAvailable && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Promo Code
                      </label>
                      <div className="flex">
                        <input
                          type="text"
                          className={`flex-grow px-3 py-2 border rounded-l-md focus:outline-none focus:ring-2 ${
                            promoCodeValidation[pkg.id]?.valid 
                              ? 'focus:ring-green-500 border-green-500' 
                              : promoCodeValidation[pkg.id]?.valid === false 
                                ? 'focus:ring-red-500 border-red-500' 
                                : 'focus:ring-blue-500 border-gray-300'
                          }`}
                          placeholder="Enter promo code"
                          value={promoCodes[pkg.id] || ''}
                          onChange={(e) => handlePromoCodeChange(e, pkg.id)}
                        />
                        <button
                          type="button"
                          onClick={() => validatePromoCode(pkg.id)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700"
                        >
                          Apply
                        </button>
                      </div>
                      {promoCodeValidation[pkg.id] && (
                        <p className={`text-sm mt-1 ${promoCodeValidation[pkg.id].valid ? 'text-green-600' : 'text-red-600'}`}>
                          {promoCodeValidation[pkg.id].message}
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => packageAvailable && handleSelectPackage(pkg)}
                    className={`w-full py-3 rounded-md font-medium transition-colors duration-300 ${
                      isActive 
                        ? 'bg-gray-300 text-gray-700 cursor-not-allowed' 
                        : isPending
                          ? 'bg-yellow-300 text-yellow-700 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    disabled={!packageAvailable}
                  >
                    {isActive 
                      ? 'Current Plan' 
                      : isPending 
                        ? (pendingStatus === 'awaiting_admin_review' ? 'Awaiting Review' : 'Pending Approval')
                        : 'Get Started'
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {packages.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-500 text-xl">No packages are currently available. Please check back later.</p>
          </div>
        )}
      </div>

      {/* FAQ Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-10">Frequently Asked Questions</h2>
          
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">How long does it take for payments to be approved?</h3>
              <p className="text-gray-600">Payment approvals are typically processed within 24-48 hours during business days. You'll receive an email notification once your payment is approved and your subscription is activated.</p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">How long are the packages valid?</h3>
              <p className="text-gray-600">Each package has its own duration as indicated. Most packages are valid for either 7 days, 14 days, or 30 days from the date of approval (not purchase).</p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Can I upgrade my package?</h3>
              <p className="text-gray-600">Yes, you can upgrade your package at any time. The remaining value of your current package will be prorated and applied to your new package.</p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">What happens when my package expires?</h3>
              <p className="text-gray-600">When your package expires, your job postings will no longer be visible to candidates. However, you'll still be able to access your account and view past applications. To reactivate your job postings, you'll need to purchase a new package.</p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Are there any refunds if I don't use all my job postings?</h3>
              <p className="text-gray-600">We do not offer refunds for unused job postings or partially used packages. We recommend choosing a package that aligns with your hiring needs.</p>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">How do promo codes work?</h3>
              <p className="text-gray-600">Promo codes provide a percentage discount on your selected package. Simply enter the promo code in the field provided and click "Apply" to validate it. If valid, the discount will be applied to your purchase. Promo code usage is tracked when payment is completed.</p>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">What happens if my payment is declined?</h3>
              <p className="text-gray-600">If your payment is declined by our admin team, you'll receive an email with the reason for decline. You can then address any issues and resubmit your payment or contact our support team for assistance. Your package selection will be reset so you can try again.</p>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">What's the difference between "Awaiting Review" and "Pending Approval"?</h3>
              <p className="text-gray-600">"Awaiting Review" means your payment has been submitted and is waiting for initial admin review. "Pending Approval" means your payment has been processed and is awaiting final approval to activate your subscription.</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Still have questions?</h2>
          <p className="text-xl text-blue-100 mb-8">Our team is here to help you find the perfect hiring solution for your business.</p>
          <button 
            onClick={() => navigate('/contact')}
            className="bg-white text-blue-600 px-8 py-3 rounded-md font-medium hover:bg-blue-50 transition-colors duration-300"
          >
            Contact Us
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;