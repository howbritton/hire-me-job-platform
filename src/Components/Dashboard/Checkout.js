import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDatabase, ref, set, update, get } from 'firebase/database';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { FaCreditCard, FaSpinner, FaArrowLeft } from 'react-icons/fa';

const Checkout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const auth = getAuth();
    const [user] = useAuthState(auth);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [promoCodeDetails, setPromoCodeDetails] = useState(null);
    const [error, setError] = useState(null);
    const [orderId, setOrderId] = useState('');
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showTermsError, setShowTermsError] = useState(false);
    const functions = getFunctions();
    const db = getDatabase(app);
    const notifyInvoiceEmail = httpsCallable(functions, 'notifyInvoiceEmail');

    // Function to update promo code usage
    const updatePromoCodeUsage = useCallback(async (promoCodeId) => {
        try {
            console.log('[PromoCode] Updating usage for promo code:', promoCodeId);
            
            const promoCodeRef = ref(db, `promoCodes/${promoCodeId}`);
            const promoCodeSnapshot = await get(promoCodeRef);
            
            if (promoCodeSnapshot.exists()) {
                const promoData = promoCodeSnapshot.val();
                const currentUsage = promoData.usageCount || 0;
                const newUsageCount = currentUsage + 1;
                
                await update(promoCodeRef, {
                    usageCount: newUsageCount,
                    updatedAt: new Date().toISOString()
                });
                
                console.log('[PromoCode] Updated usage count from', currentUsage, 'to', newUsageCount);
                return true;
            } else {
                console.error('[PromoCode] Promo code not found:', promoCodeId);
                return false;
            }
        } catch (error) {
            console.error('[PromoCode] Error updating usage:', error);
            return false;
        }
    }, [db]);

    // UPDATED: Modified notifyAdmin function to accept parameters directly
const notifyAdmin = useCallback(async (notificationParams = null) => {
    // Use passed parameters or fallback to component state
    const {
        orderId: notifOrderId,
        paymentAmount: notifAmount,
        selectedPackage: notifPackage,
        user: notifUser,
        promoCodeDetails: notifPromoDetails
    } = notificationParams || {};
    
    const finalOrderId = notifOrderId || orderId;
    const finalAmount = notifAmount !== undefined ? notifAmount : paymentAmount;
    const finalPackage = notifPackage || selectedPackage;
    const finalUser = notifUser || user;
    const finalPromoDetails = notifPromoDetails || promoCodeDetails;
    
    if (!finalOrderId || finalAmount === undefined || !finalPackage || !finalUser) {
        console.log('[Admin Notification] Missing required data:', {
            hasOrderId: !!finalOrderId,
            hasAmount: finalAmount !== undefined,
            hasPackage: !!finalPackage,
            hasUser: !!finalUser
        });
        console.log('[Admin Notification] Data values:', {
            orderId: finalOrderId,
            amount: finalAmount,
            packageId: finalPackage?.id,
            packageName: finalPackage?.name,
            userEmail: finalUser?.email
        });
        throw new Error('Missing required data for admin notification');
    }
    
    try {
        const notifyAdminPayment = httpsCallable(functions, 'notifyPaymentApprovalAdmin');
        
        const notificationData = {
            paymentId: finalOrderId,
            amount: parseFloat(finalAmount),
            currency: "USD",
            packageId: finalPackage.id,
            packageName: finalPackage.name,
            packageDetails: {
                duration: finalPackage.duration,
                jobPostLimit: finalPackage.jobPostLimit,
                features: finalPackage.features || {}
            },
            employerId: finalUser.uid,
            employerEmail: finalUser.email,
            timestamp: new Date().toISOString(),
            paymentMethod: finalAmount === 0 ? 'promo_code_100_percent' : 'card',
            isProratedPayment: !!finalPackage.proRatedPrice,
            originalPrice: finalPackage.originalPrice || finalPackage.price,
            finalPrice: finalPackage.finalPrice || finalPackage.price,
            promoCodeApplied: finalPromoDetails ? true : false,
            promoCodeDetails: finalPromoDetails || null,
            status: 'pending',
            isFreeSubscription: finalAmount === 0,
            requiresApproval: true
        };
        
        console.log('[Admin Notification] Sending notification with data:', notificationData);
        
        const result = await notifyAdminPayment(notificationData);
        console.log('[Admin Notification] Notification sent successfully:', result);
        
        return result;
    } catch (error) {
        console.error('[Admin Notification] Failed to send notification:', error);
        throw error; // Re-throw so calling code can handle it
    }
}, [functions]); // Remove dependencies on component state

    const sendPaymentConfirmationEmail = useCallback(async (paymentData) => {
        try {
            console.log('[Email] Sending payment confirmation email with data:', paymentData);
            const sendPaymentEmail = httpsCallable(functions, 'sendPaymentConfirmationEmail');
            const result = await sendPaymentEmail(paymentData);
            console.log('[Email] Payment confirmation email sent successfully:', result);
            return result;
        } catch (error) {
            console.error('[Email] Failed to send payment confirmation email:', error);
            throw error;
        }
    }, [functions]);

    // Helper function to create payment record with PENDING status
    const createPaymentRecord = useCallback(async (paymentDetails) => {
        console.log('[Payment] Creating payment record with details:', paymentDetails);
        try {
            const { orderId, userId, amount, packageInfo, resultIndicator, sessionVersion } = paymentDetails;
            const now = new Date();
            
            // Ensure we have a valid payment record path
            if (!userId || !orderId) {
                console.error('[Payment] Missing required userId or orderId for payment record');
                return false;
            }
            
            // Create payment record with PENDING status for admin approval
            const paymentData = {
                packageId: packageInfo.id,
                packageName: packageInfo.name,
                amount: parseFloat(amount),
                status: 'pending',
                createdAt: now.toISOString(),
                employerId: userId,
                employerEmail: user.email,
                paymentMethod: amount === 0 ? 'promo_code_100_percent' : 'card',
                orderId: orderId,
                currency: 'USD',
                packageDetails: packageInfo,
                originalPrice: packageInfo.originalPrice || packageInfo.price,
                finalPrice: packageInfo.finalPrice || packageInfo.price,
                discount: packageInfo.discount || 0,
                promoCodeApplied: packageInfo.promoCodeApplied || false,
                promoCodeDetails: promoCodeDetails || null,
                isFreeSubscription: amount === 0,
                requiresApproval: true,
                sagicorResponse: resultIndicator ? {
                    resultIndicator,
                    sessionVersion,
                    processedAt: now.toISOString()
                } : null
            };
            
            // Save payment record in database
            await set(ref(db, `payments/${userId}/${orderId}`), paymentData);
            console.log('[Payment] Payment record created successfully with pending status');
            
            // Verify payment record was created
            const paymentCheck = await get(ref(db, `payments/${userId}/${orderId}`));
            if (paymentCheck.exists()) {
                console.log('[Payment] Payment record verified');
                return true;
            } else {
                console.error('[Payment] Payment record not found after creation');
                return false;
            }
        } catch (error) {
            console.error('[Payment] Error creating payment record:', error);
            return false;
        }
    }, [db, user, promoCodeDetails]);

    // Helper function to create subscription with PENDING status
    const createSubscription = useCallback(async (subscriptionDetails) => {
        console.log('[Subscription] Creating subscription with details:', subscriptionDetails);
        try {
            const { userId, packageInfo } = subscriptionDetails;
            const now = new Date();
            
            // Ensure we have a valid subscription path
            if (!userId || !packageInfo) {
                console.error('[Subscription] Missing required userId or packageInfo for subscription');
                return false;
            }
            
            // ✅ ENHANCED: Validate and resolve package duration
            let packageDuration = packageInfo.duration;
            
            if (!packageDuration || packageDuration <= 0 || isNaN(packageDuration)) {
                console.warn('[Subscription] Package missing duration, fetching from database...');
                
                try {
                    const packageRef = ref(db, `packages/${packageInfo.id}`);
                    const packageSnapshot = await get(packageRef);
                    
                    if (packageSnapshot.exists()) {
                        const packageData = packageSnapshot.val();
                        packageDuration = packageData.duration;
                        console.log('[Subscription] Retrieved duration from database:', packageDuration);
                    } else {
                        console.error('[Subscription] Package not found in database:', packageInfo.id);
                        packageDuration = 30; // Fallback
                    }
                } catch (fetchError) {
                    console.error('[Subscription] Error fetching package:', fetchError);
                    packageDuration = 30; // Fallback
                }
            }
            
            // Calculate end date based on resolved package duration
            const endDate = new Date(now);
            endDate.setDate(endDate.getDate() + packageDuration);
            
            console.log('[Subscription] Date calculation:', {
                startDate: now.toISOString(),
                durationDays: packageDuration,
                endDate: endDate.toISOString()
            });
            
            // Create subscription record as PENDING until payment is approved
            const subscriptionData = {
                status: 'pending_approval',
                paymentStatus: 'pending_approval',
                startDate: now.toISOString(),
                endDate: endDate.toISOString(),
                package: {
                    ...packageInfo,
                    duration: packageDuration // ✅ ENSURE DURATION IS SET
                },
                packageId: packageInfo.id,
                packageName: packageInfo.name,
                // ✅ SEPARATE DURATION FIELD
                duration: packageDuration,
                updatedAt: now.toISOString(),
                isFreeSubscription: packageInfo.finalPrice === 0 || packageInfo.price === 0,
                obtainedVia: packageInfo.finalPrice === 0 ? 'promo_code_100_percent' : 'payment',
                requiresApproval: true
            };
            
            // Save subscription record in database
            await set(ref(db, `employers/${userId}/subscription`), subscriptionData);
            console.log('[Subscription] Subscription record created (pending approval) with duration:', packageDuration);
            
            // Verify subscription record was created
            const subscriptionCheck = await get(ref(db, `employers/${userId}/subscription`));
            if (subscriptionCheck.exists()) {
                console.log('[Subscription] Subscription record verified');
                return true;
            } else {
                console.error('[Subscription] Subscription record not found after creation');
                return false;
            }
        } catch (error) {
            console.error('[Subscription] Error creating subscription record:', error);
            return false;
        }
    }, [db]);

    // Generate an invoice number based on the payment ID and date
    const generateInvoiceNumber = useCallback((orderId) => {
        // Extract year and month from the current date
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        
        // Extract a portion of the ID to create a unique number
        let uniqueId = '';
        if (orderId) {
            // For ORDER prefixed IDs, use the numeric part
            if (orderId.startsWith('ORDER-') || orderId.startsWith('FREE-')) {
                uniqueId = orderId.substring(orderId.indexOf('-') + 1, orderId.indexOf('-') + 7);
            } 
            // For timestamp IDs, use last 6 digits
            else if (!isNaN(parseInt(orderId))) {
                uniqueId = orderId.toString().slice(-6);
            }
            // For other formats, use first 6 chars
            else {
                uniqueId = orderId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6);
            }
        }
        
        return `INV-${year}${month}-${uniqueId}`;
    }, []);

    // ✅ ENHANCED: Handle 100% discount (free subscription) with duration validation
    const handleFreeSubscription = useCallback(async () => {
        console.log('[FreeSubscription] Processing 100% discount subscription');
        
        if (!user || !selectedPackage) {
            console.error('[FreeSubscription] Missing required data');
            toast.error('Missing required data for free subscription');
            return;
        }
        
        setProcessing(true);
        
        try {
            // ✅ VALIDATE DURATION FOR FREE SUBSCRIPTION
            let packageDuration = selectedPackage.duration;
            
            if (!packageDuration || packageDuration <= 0 || isNaN(packageDuration)) {
                console.warn('[FreeSubscription] Package missing duration, fetching from database...');
                
                try {
                    const packageRef = ref(db, `packages/${selectedPackage.id}`);
                    const packageSnapshot = await get(packageRef);
                    
                    if (packageSnapshot.exists()) {
                        const packageData = packageSnapshot.val();
                        packageDuration = packageData.duration;
                        console.log('[FreeSubscription] Retrieved duration from database:', packageDuration);
                    } else {
                        console.error('[FreeSubscription] Package not found in database:', selectedPackage.id);
                        toast.error('Package not found. Please contact support.');
                        return;
                    }
                } catch (fetchError) {
                    console.error('[FreeSubscription] Error fetching package:', fetchError);
                    toast.error('Error validating package. Please try again.');
                    return;
                }
            }

            const newOrderId = `FREE-${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
            const invoiceNumber = generateInvoiceNumber(newOrderId);
            const now = new Date();
            const endDate = new Date(now);
            endDate.setDate(endDate.getDate() + packageDuration); // ✅ USE VALIDATED DURATION
            
            setOrderId(newOrderId);
            setPaymentAmount(0);
            
            console.log('[FreeSubscription] Creating free subscription:', {
                orderId: newOrderId,
                packageId: selectedPackage.id,
                packageName: selectedPackage.name,
                duration: packageDuration, // ✅ LOG VALIDATED DURATION
                originalPrice: selectedPackage.originalPrice || selectedPackage.price,
                finalPrice: 0,
                discount: selectedPackage.discount,
                promoCode: promoCodeDetails?.code
            });
            
            // 1. Update promo code usage
            if (promoCodeDetails && promoCodeDetails.id) {
                console.log('[FreeSubscription] Updating promo code usage for:', promoCodeDetails.code);
                await updatePromoCodeUsage(promoCodeDetails.id);
            }
            
            // ✅ CREATE ENHANCED PACKAGE WITH VALIDATED DURATION
            const enhancedPackage = {
                ...selectedPackage,
                duration: packageDuration, // ✅ ENSURE DURATION IS SET
                id: selectedPackage.id,
                name: selectedPackage.name,
                price: selectedPackage.price,
                jobPostLimit: selectedPackage.jobPostLimit || 10,
                features: selectedPackage.features || {}
            };
            
            // 2. Create checkout session for record keeping
            const checkoutSessionData = {
                amount: 0,
                checkoutMode: 'WEBSITE',
                createdAt: new Date().toISOString(),
                currency: 'USD',
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                lastUpdated: new Date().toISOString(),
                operation: 'PURCHASE',
                orderId: newOrderId,
                sessionId: null,
                sessionVersion: null,
                status: 'pending',
                userId: user.uid,
                userEmail: user.email,
                // ✅ STORE ENHANCED PACKAGE WITH VALIDATED DURATION
                package: enhancedPackage,
                packageId: enhancedPackage.id,
                packageName: enhancedPackage.name,
                packageDuration: packageDuration, // ✅ SEPARATE DURATION FIELD
                originalPrice: selectedPackage.originalPrice || selectedPackage.price,
                finalPrice: selectedPackage.finalPrice || selectedPackage.price,
                discount: selectedPackage.discount || 0,
                promoCodeApplied: selectedPackage.promoCodeApplied || false,
                promoCodeDetails: promoCodeDetails || null,
                invoiceNumber: invoiceNumber,
                requiresApproval: true
            };
            
            await set(ref(db, `checkoutSessions/${newOrderId}`), checkoutSessionData);
            console.log('[FreeSubscription] Created checkout session with duration:', packageDuration);
            console.log('🔍 [Payment] Verifying checkout session was saved with correct duration...');
const checkoutSessionCheck = await get(ref(db, `checkoutSessions/${newOrderId}`));
if (checkoutSessionCheck.exists()) {
    const savedSession = checkoutSessionCheck.val();
    console.log('✅ [Payment] Checkout session verification:', {
        packageId: savedSession.package?.id,
        packageName: savedSession.package?.name,
        packageDuration: savedSession.package?.duration,
        separateDuration: savedSession.packageDuration,
        fullPackageData: savedSession.package
    });
    
    // ✅ CRITICAL CHECK: Ensure duration is correct
    if (savedSession.package?.duration !== enhancedPackage.duration) {
        console.error('❌ [Payment] Duration mismatch in saved session!', {
            expected: enhancedPackage.duration,
            actual: savedSession.package?.duration
        });
        throw new Error(`Package duration validation failed. Expected: ${enhancedPackage.duration}, Got: ${savedSession.package?.duration}`);
    }
    
    // ✅ CRITICAL CHECK: Ensure package ID is correct
    if (savedSession.package?.id !== enhancedPackage.id) {
        console.error('❌ [Payment] Package ID mismatch in saved session!', {
            expected: enhancedPackage.id,
            actual: savedSession.package?.id
        });
        throw new Error(`Package ID validation failed. Expected: ${enhancedPackage.id}, Got: ${savedSession.package?.id}`);
    }
    
    console.log('✅ [Payment] Checkout session validation passed - duration and package ID are correct');
} else {
    console.error('❌ [Payment] Checkout session not found after creation');
    throw new Error('Failed to save checkout session');
}
            
            // 3. Create payment record (showing $0 payment with promo code) - PENDING status
            const paymentCreated = await createPaymentRecord({
                orderId: newOrderId,
                userId: user.uid,
                amount: 0,
                packageInfo: enhancedPackage, // ✅ USE ENHANCED PACKAGE
                resultIndicator: null,
                sessionVersion: null
            });
            
            if (!paymentCreated) {
                console.error('[FreeSubscription] Failed to create payment record');
            }
            
            // 4. Create subscription with PENDING status
            const subscriptionCreated = await createSubscription({
                userId: user.uid,
                packageInfo: enhancedPackage // ✅ USE ENHANCED PACKAGE
            });
            
            if (!subscriptionCreated) {
                console.error('[FreeSubscription] Failed to create subscription');
            }
            
            // 5. Send admin notification
            try {
                await notifyAdmin({
                    orderId: newOrderId,
                    paymentAmount: 0,
                    selectedPackage: enhancedPackage,
                    user: user,
                    promoCodeDetails: promoCodeDetails
                });
                console.log('[FreeSubscription] Sent admin notification');
            } catch (notificationError) {
                console.error('[FreeSubscription] Admin notification failed:', notificationError);
                await set(ref(db, `notification_errors/${newOrderId}`), {
                    error: notificationError.message,
                    timestamp: now.toISOString(),
                    type: 'admin_notification',
                    userId: user.uid
                });
            }
            
            toast.success('Free subscription request submitted! Pending admin approval.');
            
            navigate('/payment/success', { 
                state: { 
                    paymentSuccess: true,
                    orderId: newOrderId,
                    packageDetails: enhancedPackage, // ✅ USE ENHANCED PACKAGE
                    amount: 0,
                    invoiceNumber: invoiceNumber,
                    promoCodeDetails: promoCodeDetails || null,
                    isFreeSubscription: true,
                    requiresApproval: true
                } 
            });
            
        } catch (error) {
            console.error('[FreeSubscription] Error processing free subscription:', error);
            toast.error('Failed to process free subscription. Please contact support.');
            
            try {
                const errorOrderId = orderId || `error-${Date.now()}`;
                await set(ref(db, `payment_errors/${errorOrderId}`), {
                    error: error.message,
                    errorStack: error.stack,
                    timestamp: new Date().toISOString(),
                    userId: user.uid,
                    packageId: selectedPackage.id,
                    packageName: selectedPackage.name,
                    promoCodeDetails: promoCodeDetails || null,
                    type: 'free_subscription_error'
                });
            } catch (loggingError) {
                console.error('[FreeSubscription] Failed to log error:', loggingError);
            }
        } finally {
            setProcessing(false);
        }
    }, [user, orderId, selectedPackage, promoCodeDetails, db, navigate, updatePromoCodeUsage, generateInvoiceNumber, createPaymentRecord, createSubscription, notifyAdmin]);

    // UPDATED: handlePaymentCompletion with pending status
    const handlePaymentCompletion = useCallback(async (resultIndicator, sessionVersion) => {
        console.log('🔔 [PAYMENT COMPLETION] Sagicor callback received:', { resultIndicator, sessionVersion });
        
        setProcessing(true);
        
        try {
            // ✅ SOLUTION: Get fresh data from Firebase instead of relying on component state
            const currentUser = getAuth().currentUser;
            if (!currentUser) {
                console.error('❌ [PAYMENT COMPLETION] No authenticated user found');
                toast.error('Authentication error during payment completion');
                navigate('/employer-sign-in');
                return;
            }

            // ✅ Get fresh checkout session data (contains all package info)
            const checkoutSessionRef = ref(db, `checkoutSessions/${orderId}`);
            const checkoutSnapshot = await get(checkoutSessionRef);
            
            if (!checkoutSnapshot.exists()) {
                console.error('❌ [PAYMENT COMPLETION] Checkout session not found:', orderId);
                toast.error('Payment session not found');
                navigate('/payment/failure', { 
                    state: { 
                        paymentError: true,
                        errorMessage: 'Payment session not found'
                    } 
                });
                return;
            }

            const checkoutData = checkoutSnapshot.val();
            console.log('💾 [PAYMENT COMPLETION] Retrieved fresh checkout data:', checkoutData);

            // ✅ Extract package info from checkout session (not component state)
            const packageInfo = checkoutData.package;
            const paymentAmount = checkoutData.amount;
            
            if (!packageInfo) {
                console.error('❌ [PAYMENT COMPLETION] Package info missing from checkout session');
                toast.error('Package information not found');
                navigate('/payment/failure', { 
                    state: { 
                        paymentError: true,
                        errorMessage: 'Package information missing'
                    } 
                });
                return;
            }

            console.log('✅ [PAYMENT COMPLETION] Processing with fresh data:', {
                orderId: orderId,
                packageId: packageInfo.id,
                packageName: packageInfo.name,
                amount: paymentAmount,
                userUid: currentUser.uid
            });

            // ✅ Update promo code usage if applicable
            if (checkoutData.promoCodeDetails && checkoutData.promoCodeDetails.id) {
                console.log('[PAYMENT COMPLETION] Updating promo code usage for:', checkoutData.promoCodeDetails.code);
                const promoCodeRef = ref(db, `promoCodes/${checkoutData.promoCodeDetails.id}`);
                const promoSnapshot = await get(promoCodeRef);
                
                if (promoSnapshot.exists()) {
                    const promoData = promoSnapshot.val();
                    const currentUsage = promoData.usageCount || 0;
                    await update(promoCodeRef, {
                        usageCount: currentUsage + 1,
                        updatedAt: new Date().toISOString()
                    });
                    console.log('[PAYMENT COMPLETION] Updated promo code usage');
                }
            }

            // ✅ Update checkout session status to pending
            await update(checkoutSessionRef, {
                status: 'pending',
                lastUpdated: new Date().toISOString(),
                resultIndicator,
                sessionVersion,
                requiresApproval: true
            });
            console.log('✅ [PAYMENT COMPLETION] Updated checkout session status to pending');

            const now = new Date();
            
            // ✅ ENHANCED: Validate package duration before creating subscription
            let packageDuration = packageInfo.duration;
            
            if (!packageDuration || packageDuration <= 0 || isNaN(packageDuration)) {
                console.warn('[PAYMENT COMPLETION] Package missing duration, fetching from database...');
                
                try {
                    const packageRef = ref(db, `packages/${packageInfo.id}`);
                    const packageSnapshot = await get(packageRef);
                    
                    if (packageSnapshot.exists()) {
                        const packageData = packageSnapshot.val();
                        packageDuration = packageData.duration;
                        console.log('[PAYMENT COMPLETION] Retrieved duration from database:', packageDuration);
                    } else {
                        console.error('[PAYMENT COMPLETION] Package not found in database:', packageInfo.id);
                        packageDuration = 30; // Fallback
                    }
                } catch (fetchError) {
                    console.error('[PAYMENT COMPLETION] Error fetching package:', fetchError);
                    packageDuration = 30; // Fallback
                }
            }
            
            const endDate = new Date(now);
            endDate.setDate(endDate.getDate() + packageDuration); // ✅ USE VALIDATED DURATION

            // ✅ CREATE PAYMENT RECORD with PENDING status
            const paymentData = {
                packageId: packageInfo.id,
                packageName: packageInfo.name,
                amount: parseFloat(paymentAmount),
                status: 'pending',
                createdAt: now.toISOString(),
                employerId: currentUser.uid,
                employerEmail: currentUser.email,
                paymentMethod: paymentAmount === 0 ? 'promo_code_100_percent' : 'card',
                orderId: orderId,
                currency: 'USD',
                packageDetails: {
                    ...packageInfo,
                    duration: packageDuration // ✅ ENSURE DURATION IS INCLUDED
                },
                originalPrice: packageInfo.originalPrice || packageInfo.price,
                finalPrice: packageInfo.finalPrice || packageInfo.price,
                discount: packageInfo.discount || 0,
                promoCodeApplied: packageInfo.promoCodeApplied || false,
                promoCodeDetails: checkoutData.promoCodeDetails || null,
                isFreeSubscription: paymentAmount === 0,
                invoiceNumber: checkoutData.invoiceNumber,
                requiresApproval: true,
                sagicorResponse: {
                    resultIndicator,
                    sessionVersion,
                    processedAt: now.toISOString()
                }
            };
            
            // ✅ CRITICAL: Create payment record with fresh data
            const paymentPath = `payments/${currentUser.uid}/${orderId}`;
            console.log('💾 [PAYMENT COMPLETION] Creating payment record at path:', paymentPath);
            
            await set(ref(db, paymentPath), paymentData);
            console.log('✅ [PAYMENT COMPLETION] Payment record created successfully');
            
            // ✅ Verify payment record was created
            const paymentCheck = await get(ref(db, paymentPath));
            if (paymentCheck.exists()) {
                console.log('✅ [PAYMENT COMPLETION] Payment record verified in database');
            } else {
                console.error('❌ [PAYMENT COMPLETION] Payment record verification failed');
            }

            // ✅ Create subscription with PENDING status and validated duration
            const subscriptionData = {
                status: 'pending_approval',
                paymentStatus: 'pending_approval',
                startDate: now.toISOString(),
                endDate: endDate.toISOString(),
                package: {
                    ...packageInfo,
                    duration: packageDuration // ✅ ENSURE DURATION IS SET
                },
                packageId: packageInfo.id,
                packageName: packageInfo.name,
                // ✅ SEPARATE DURATION FIELD
                duration: packageDuration,
                updatedAt: now.toISOString(),
                isFreeSubscription: paymentAmount === 0,
                obtainedVia: paymentAmount === 0 ? 'promo_code_100_percent' : 'payment',
                requiresApproval: true
            };
            
            await set(ref(db, `employers/${currentUser.uid}/subscription`), subscriptionData);
            console.log('✅ [PAYMENT COMPLETION] Subscription created with pending status and duration:', packageDuration);

            // ✅ Send admin notification
            try {
                await notifyAdmin({
                    orderId: orderId,
                    paymentAmount: paymentAmount,
                    selectedPackage: packageInfo, // Use fresh packageInfo from checkout session
                    user: currentUser,
                    promoCodeDetails: checkoutData.promoCodeDetails
                });
                console.log('✅ [PAYMENT COMPLETION] Admin notification sent');
            } catch (notificationError) {
                console.error('⚠️ [PAYMENT COMPLETION] Notification error (non-critical):', notificationError);
                // Don't fail the payment for notification errors
            }

            toast.success('Payment submitted successfully! Your payment is pending admin approval.');
            
            navigate('/payment/success', { 
                state: { 
                    paymentSuccess: true,
                    orderId: orderId,
                    packageDetails: {
                        ...packageInfo,
                        duration: packageDuration // ✅ ENSURE DURATION IS INCLUDED
                    },
                    amount: paymentAmount,
                    invoiceNumber: checkoutData.invoiceNumber,
                    isFreeSubscription: paymentAmount === 0,
                    promoCodeDetails: checkoutData.promoCodeDetails || null,
                    requiresApproval: true
                } 
            });
            
            console.log('🚀 [PAYMENT COMPLETION] Navigation to success page completed');

        } catch (error) {
            console.error('❌ [PAYMENT COMPLETION] Error during payment processing:', error);
            
            // Log error for debugging
            try {
                await set(ref(db, `payment_errors/${orderId || 'unknown'}_${Date.now()}`), {
                    error: error.message,
                    errorStack: error.stack,
                    timestamp: new Date().toISOString(),
                    userId: getAuth().currentUser?.uid,
                    resultIndicator,
                    sessionVersion,
                    type: 'payment_completion_error'
                });
            } catch (loggingError) {
                console.error('Failed to log error:', loggingError);
            }

            toast.error('Payment processing failed. Please contact support with reference: ' + (orderId || 'N/A'));
            
            navigate('/payment/failure', { 
                state: { 
                    paymentError: true,
                    orderId: orderId,
                    errorMessage: error.message
                } 
            });
        } finally {
            setProcessing(false);
            console.log('🔔 [PAYMENT COMPLETION] Processing completed');
        }
    }, [db, navigate, orderId, notifyAdmin]);

    useEffect(() => {
        let scriptElement = null;

        const loadCheckoutScript = () => {
            console.log('[Setup] Starting Sagicor script setup');
        
            window.completeCallback = (resultIndicator, sessionVersion) => {
                console.log('[Sagicor] Complete callback triggered:', { resultIndicator, sessionVersion });
                handlePaymentCompletion(resultIndicator, sessionVersion);
            };
            
            window.errorCallback = (error) => {
                console.log('[Sagicor] Error callback triggered:', error);
                setError(error.message || 'Payment failed');
                toast.error('Payment failed. Please try again.');
                setProcessing(false);
            };
            
            window.cancelCallback = () => {
                console.log('[Sagicor] Cancel callback triggered');
                toast.info('Payment cancelled');
                setProcessing(false);
                navigate('/payment/cancel');
            };
        
            scriptElement = document.createElement('script');
            scriptElement.src = 'https://sagicorbank.gateway.mastercard.com/static/checkout/checkout.min.js';
            scriptElement.async = true;
            scriptElement.dataset.error = 'errorCallback';
            scriptElement.dataset.cancel = 'cancelCallback';
            scriptElement.dataset.complete = 'completeCallback';

            scriptElement.onload = () => {
                console.log('[Setup] Sagicor script loaded successfully');
            };

            scriptElement.onerror = (error) => {
                console.error('[Setup] Error loading Sagicor script:', error);
                setError('Failed to load payment system. Please try again.');
            };
            
            document.head.appendChild(scriptElement);
        };

        if (!user) {
            navigate('/employer-sign-in', { state: { from: location } });
            return;
        }

        if (!location.state?.package) {
            navigate('/pricing');
            return;
        }

        // Extract package and promo code details from location state
        const packageData = location.state.package;
        const promoData = location.state.promoCode;
        
        setSelectedPackage(packageData);
        setPromoCodeDetails(promoData);
        setLoading(false);
        loadCheckoutScript();

        return () => {
            if (scriptElement && document.head.contains(scriptElement)) {
                document.head.removeChild(scriptElement);
            }
            delete window.errorCallback;
            delete window.cancelCallback;
            delete window.completeCallback;
        };
    }, [user, location, navigate, handlePaymentCompletion]);

    // ✅ ENHANCED: Handle payment submission with duration validation
    const handlePaymentSubmission = async () => {
        if (!termsAccepted) {
            setShowTermsError(true);
            return;
        }
        
        try {
            setShowTermsError(false);
            setError(null);
            
            // ✅ CRITICAL: Validate and enhance package data with explicit duration
            if (!selectedPackage || !selectedPackage.id) {
                console.error('[Payment] Invalid package selected:', selectedPackage);
                toast.error('Invalid package selected. Please go back and select a package.');
                return;
            }

            // ✅ ENSURE PACKAGE HAS VALID DURATION
            let packageDuration = selectedPackage.duration;
            
            if (!packageDuration || packageDuration <= 0 || isNaN(packageDuration)) {
                console.warn('[Payment] Package missing duration, fetching from database...');
                
                try {
                    // Fetch package from database to get correct duration
                    const packageRef = ref(db, `packages/${selectedPackage.id}`);
                    const packageSnapshot = await get(packageRef);
                    
                    if (packageSnapshot.exists()) {
                        const packageData = packageSnapshot.val();
                        packageDuration = packageData.duration;
                        console.log('[Payment] Retrieved duration from database:', packageDuration);
                    } else {
                        console.error('[Payment] Package not found in database:', selectedPackage.id);
                        toast.error('Package not found. Please contact support.');
                        return;
                    }
                } catch (fetchError) {
                    console.error('[Payment] Error fetching package:', fetchError);
                    toast.error('Error validating package. Please try again.');
                    return;
                }
            }

            // ✅ Final validation of duration
            if (!packageDuration || packageDuration <= 0 || isNaN(packageDuration)) {
                console.error('[Payment] Still no valid duration after fetch. Using package data:', selectedPackage);
                toast.error('Package duration is invalid. Please contact support.');
                return;
            }

            console.log('[Payment] Validated package duration:', packageDuration);

            // ✅ CREATE ENHANCED PACKAGE OBJECT WITH GUARANTEED DURATION
            const enhancedPackage = {
                ...selectedPackage,
                // ✅ EXPLICITLY SET DURATION FROM VALIDATION
                duration: packageDuration,
                id: selectedPackage.id,
                name: selectedPackage.name,
                price: selectedPackage.price,
                jobPostLimit: selectedPackage.jobPostLimit || 10,
                features: selectedPackage.features || {},
                originalPrice: selectedPackage.originalPrice || selectedPackage.price,
                finalPrice: selectedPackage.finalPrice !== undefined ? selectedPackage.finalPrice : selectedPackage.price,
                discount: selectedPackage.discount || 0,
                promoCodeApplied: selectedPackage.promoCodeApplied || false
            };

            console.log('🔍 [Checkout] Enhanced package data:', {
                id: enhancedPackage.id,
                name: enhancedPackage.name,
                duration: enhancedPackage.duration,
                price: enhancedPackage.price,
                finalPrice: enhancedPackage.finalPrice
            });
            
            // Check if this is a 100% discount (free subscription)
            const finalPrice = enhancedPackage.finalPrice;
            
            if (finalPrice === 0 || finalPrice < 0.01) {
                console.log('[Payment] Detected 100% discount, processing as free subscription');
                // Update selectedPackage with enhanced data for free subscription
                setSelectedPackage(enhancedPackage);
                await handleFreeSubscription();
                return;
            }
            
            // Continue with regular payment flow for non-zero amounts
            setProcessing(true);
            
            const newOrderId = `ORDER-${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
            const amount = finalPrice;
            const invoiceNumber = generateInvoiceNumber(newOrderId);
            
            setOrderId(newOrderId);
            setPaymentAmount(parseFloat(amount));

            console.log('[Payment] Starting regular payment submission:', { 
                orderId: newOrderId, 
                amount,
                originalPrice: enhancedPackage.originalPrice,
                finalPrice: enhancedPackage.finalPrice,
                discount: enhancedPackage.discount,
                packageId: enhancedPackage.id,
                packageName: enhancedPackage.name,
                packageDuration: enhancedPackage.duration, // ✅ LOG VALIDATED DURATION
                invoiceNumber,
                promoCodeApplied: enhancedPackage.promoCodeApplied
            });

            // ✅ CREATE CHECKOUT SESSION WITH ENHANCED PACKAGE DATA
            const checkoutSessionData = {
                amount: parseFloat(amount),
                checkoutMode: 'WEBSITE',
                createdAt: new Date().toISOString(),
                currency: 'USD',
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                lastUpdated: new Date().toISOString(),
                operation: 'PURCHASE',
                orderId: newOrderId,
                sessionId: null,
                sessionVersion: null,
                status: 'pending',
                userId: user.uid,
                userEmail: user.email,
                // ✅ CRITICAL: Store enhanced package with validated duration
                package: enhancedPackage,
                packageId: enhancedPackage.id,
                packageName: enhancedPackage.name,
                // ✅ SEPARATE DURATION FIELD FOR EASY ACCESS
                packageDuration: enhancedPackage.duration,
                originalPrice: enhancedPackage.originalPrice,
                finalPrice: enhancedPackage.finalPrice,
                discount: enhancedPackage.discount,
                promoCodeApplied: enhancedPackage.promoCodeApplied,
                promoCodeDetails: promoCodeDetails || null,
                invoiceNumber: invoiceNumber,
                requiresApproval: true
            };
            
            await set(ref(db, `checkoutSessions/${newOrderId}`), checkoutSessionData);
            console.log('✅ [Payment] Created checkout session with duration:', enhancedPackage.duration);
            
            // ✅ CONTINUE WITH SAGICOR CHECKOUT INITIALIZATION
            const initCheckout = httpsCallable(functions, 'apiInitiateCheckout');
            
            const checkoutData = {
                amount: parseFloat(amount),
                currency: "USD",
                orderId: newOrderId,
                // ✅ SEND ENHANCED PACKAGE DATA WITH VALIDATED DURATION
                packageDetails: enhancedPackage,
                packageId: enhancedPackage.id,
                packageName: enhancedPackage.name,
                originalPrice: enhancedPackage.originalPrice,
                finalPrice: enhancedPackage.finalPrice,
                discount: enhancedPackage.discount,
                promoCodeApplied: enhancedPackage.promoCodeApplied,
                invoiceNumber: invoiceNumber,
                apiOperation: "INITIATE_CHECKOUT",
                interaction: {
                    operation: "PURCHASE",
                    merchant: {
                        name: "HireMeJA"
                    }
                },
                order: {
                    currency: "USD",
                    amount: parseFloat(amount).toFixed(2),
                    id: newOrderId,
                    description: `Package Purchase: ${enhancedPackage.name} (${enhancedPackage.duration} days)${enhancedPackage.promoCodeApplied ? ' (Promo Applied)' : ''}`
                }
            };

            const response = await initCheckout(checkoutData);
            console.log('[Payment] Got checkout session:', response.data);

            if (response.data?.result?.success && response.data.result.sessionId) {
                const sessionId = response.data.result.sessionId;
                
                try {
                    console.log('[Payment] Configuring Checkout with session:', sessionId);
                    window.Checkout.configure({
                        session: {
                            id: sessionId
                        }
                    });
                    
                    window.Checkout.showPaymentPage();
                } catch (checkoutError) {
                    console.error('[Payment] Checkout configuration error:', checkoutError);
                    toast.error('Failed to initialize payment session');
                    setProcessing(false);
                }
            }
        } catch (error) {
            console.error('[Payment] Submission error:', error);
            setError(error.message || 'Failed to process payment');
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const displayPrice = selectedPackage?.finalPrice !== undefined ? selectedPackage.finalPrice : (selectedPackage?.price || 0);
    const originalPrice = selectedPackage?.originalPrice || selectedPackage?.price || 0;
    const hasDiscount = selectedPackage?.discount > 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <button 
                onClick={() => navigate('/pricing')}
                className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
            >
                <FaArrowLeft className="mr-2" />
                <span>Back to Pricing</span>
            </button>

            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Admin Approval Notice */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                <strong>Admin Approval Required:</strong> All payments require admin approval before your subscription becomes active. You will receive an email notification once your payment is reviewed.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                {displayPrice === 0 ? 'Free Package Activation' : 'Credit/Debit Card Payment'}
                            </h2>
                            <p className="text-gray-600">
                                {displayPrice === 0 
                                    ? 'Your promo code provides 100% discount! Click "Submit Free Request" to request activation of your subscription.'
                                    : 'Click the "Submit Payment" button to securely enter your card details. Your payment will be reviewed by our admin team.'
                                }
                            </p>
                        </div>
                    </div>

                    <div className="md:col-span-1">
                        <div className="bg-white rounded-lg shadow-md p-6 sticky top-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-medium text-gray-900">{selectedPackage?.name}</h3>
                                    <p className="text-gray-600">{selectedPackage?.duration} Days</p>
                                </div>
                                <div className="border-t pt-4">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-gray-600">Package Price</span>
                                        <span className="text-gray-900">USD ${originalPrice.toFixed(2)}</span>
                                    </div>
                                    
                                    {hasDiscount && (
                                        <>
                                            <div className="flex justify-between text-green-600 mb-2">
                                                <span>Promo Code Discount</span>
                                                <span>-USD ${selectedPackage.discount.toFixed(2)}</span>
                                            </div>
                                            {promoCodeDetails && (
                                                <div className="text-sm text-green-600 mb-2">
                                                    Code: {promoCodeDetails.code} ({promoCodeDetails.discountPercentage}% off)
                                                </div>
                                            )}
                                        </>
                                    )}
                                    
                                    {selectedPackage?.proRatedPrice && (
                                        <div className="flex justify-between text-blue-600 mb-2">
                                            <span>Pro-rated Adjustment</span>
                                            <span>-USD ${(originalPrice - selectedPackage.proRatedPrice).toFixed(2)}</span>
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t">
                                        <span className="text-gray-900">Total</span>
                                        <span className={`${displayPrice === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                            {displayPrice === 0 ? 'FREE' : `USD ${displayPrice.toFixed(2)}`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 mb-4">
                                <label className="flex items-start cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        onChange={e => setTermsAccepted(e.target.checked)}
                                        checked={termsAccepted}
                                    />
                                    <span className="ml-2 text-sm text-gray-600">
                                        I agree to the <a href="/terms" target="_blank" className="text-blue-600 hover:underline">Terms and Conditions</a> and understand that my payment requires admin approval
                                    </span>
                                </label>
                                {showTermsError && (
                                    <p className="mt-1 text-sm text-red-600">
                                        You must agree to the Terms and Conditions to proceed
                                    </p>
                                )}
                            </div>
                            
                            <button
                                onClick={handlePaymentSubmission}
                                disabled={processing || !termsAccepted}
                                className={`w-full px-4 py-3 rounded-lg text-white font-medium 
                                    flex items-center justify-center space-x-2
                                    ${(processing || !termsAccepted) ? 
                                        'bg-blue-400 cursor-not-allowed' : 
                                        displayPrice === 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {processing ? (
                                    <>
                                        <FaSpinner className="animate-spin" />
                                        <span>Processing...</span>
                                    </>
                                ) : displayPrice === 0 ? (
                                    <>
                                        <span>🎉 Submit Free Request</span>
                                    </>
                                ) : (
                                    <>
                                        <FaCreditCard className="mr-2" />
                                        <span>Submit Payment - USD ${displayPrice.toFixed(2)}</span>
                                    </>
                                )}
                            </button>
                            
                            {/* Additional Information */}
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                                <p className="text-xs text-blue-700">
                                    <strong>Next Steps:</strong>
                                    <br />• Your payment will be processed securely
                                    <br />• Admin will review within 24 hours
                                    <br />• You'll receive email confirmation
                                    <br />• Subscription activates upon approval
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Checkout;