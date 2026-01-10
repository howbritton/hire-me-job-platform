import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDatabase, ref, set, get } from 'firebase/database';
import { app } from '../../firebase';
import { FaCheckCircle, FaArrowRight, FaFileInvoice, FaExclamationTriangle } from 'react-icons/fa';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const [user] = useAuthState(auth);
  const [emailStatus, setEmailStatus] = useState('preparing');
  const [paymentRecorded, setPaymentRecorded] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});
  
  const functions = getFunctions();
  const db = getDatabase(app);
  
  // 🔍 INITIAL DEBUG: Log everything when component loads
  useEffect(() => {
    console.log('🎯 [DEBUG] PaymentSuccess loaded with URL:', window.location.href);
    console.log('🎯 [DEBUG] React Router location:', location);
    console.log('🎯 [DEBUG] Location pathname:', location.pathname);
    console.log('🎯 [DEBUG] Location state exists:', !!location.state);
    console.log('🎯 [DEBUG] Location state content:', JSON.stringify(location.state, null, 2));
    console.log('🎯 [DEBUG] User authenticated:', !!user);
    console.log('🎯 [DEBUG] User email:', user?.email);
    
    const debug = {
      pathname: location.pathname,
      hasState: !!location.state,
      stateKeys: location.state ? Object.keys(location.state) : [],
      fullState: location.state,
      userLoaded: !!user,
      userEmail: user?.email
    };
    
    setDebugInfo(debug);
  }, [location, user]);

  const {
    paymentSuccess,
    orderId,
    packageDetails,
    amount,
    invoiceNumber,
    isFreeSubscription,
    promoCodeDetails
  } = location.state || {};

  // 🔍 DEBUG: Log extracted values
  console.log('🎯 [PaymentSuccess DEBUG] Extracted values:', {
    paymentSuccess,
    hasOrderId: !!orderId,
    orderIdValue: orderId,
    hasPackageDetails: !!packageDetails,
    packageDetailsKeys: packageDetails ? Object.keys(packageDetails) : [],
    packageDetailsValue: packageDetails,
    amount,
    amountDefined: amount !== undefined,
    invoiceNumber,
    isFreeSubscription,
    hasPromoCodeDetails: !!promoCodeDetails,
    promoCodeDetailsValue: promoCodeDetails
  });

  // Create payment record and send invoice email
  useEffect(() => {
    const processPaymentSuccess = async () => {
      // ✅ DETAILED DEBUG LOGGING
      console.log('🔍 [INVOICE DEBUG] Starting invoice processing...');
      console.log('🔍 [INVOICE DEBUG] Raw location.state:', JSON.stringify(location.state, null, 2));
      
      // Check each required field individually
      const debugChecks = {
        user: !!user,
        userEmail: user?.email,
        orderId: !!orderId,
        orderIdValue: orderId,
        packageDetails: !!packageDetails,
        packageDetailsKeys: packageDetails ? Object.keys(packageDetails) : [],
        packageDetailsValue: packageDetails,
        amount: amount !== undefined,
        amountValue: amount,
        invoiceNumber: !!invoiceNumber,
        invoiceNumberValue: invoiceNumber,
        isFreeSubscription: isFreeSubscription,
        promoCodeDetails: !!promoCodeDetails,
        promoCodeDetailsValue: promoCodeDetails
      };
      
      console.log('🔍 [INVOICE DEBUG] Field by field check:', debugChecks);

      if (!user) {
        console.log('❌ [INVOICE DEBUG] Missing: user');
        setEmailStatus('failed');
        return;
      }

      if (!orderId && !packageDetails) {
        console.log('❌ [INVOICE DEBUG] Missing: both orderId AND packageDetails');
        setEmailStatus('failed');
        return;
      }

      try {
        console.log('💾 Recording payment in database...');
        
        // 1. Get user profile for complete records
        const profileRef = ref(db, `employers/${user.uid}/profile`);
        const profileSnapshot = await get(profileRef);
        const profile = profileSnapshot.exists() ? profileSnapshot.val() : {};
        console.log('🔍 [INVOICE DEBUG] User profile:', profile);

        // 2. Create payment record (with fallback values)
        const now = new Date();
        const paymentRecord = {
          amount: parseFloat(amount || 0),
          approvedAt: now.toISOString(),
          createdAt: now.toISOString(),
          currency: 'USD',
          employerEmail: user.email,
          employerId: user.uid,
          orderId: orderId || `RECOVERY-${Date.now()}`,
          packageDetails: packageDetails || { name: 'Unknown Package', duration: 30 },
          packageId: packageDetails?.id || 'unknown',
          packageName: packageDetails?.name || 'Unknown Package',
          paymentMethod: isFreeSubscription ? 'promo_code_100_percent' : 'card',
          status: 'completed'
        };

        // Add free subscription specific fields
        if (isFreeSubscription) {
          paymentRecord.discount = packageDetails?.originalPrice || packageDetails?.price || 0;
          paymentRecord.finalPrice = packageDetails?.finalPrice || 0;
          paymentRecord.isFreeSubscription = true;
          paymentRecord.originalPrice = packageDetails?.originalPrice || packageDetails?.price || 0;
          paymentRecord.promoCodeApplied = true;
          paymentRecord.promoCodeDetails = promoCodeDetails;
        }

        // Add invoice number if available
        if (invoiceNumber) {
          paymentRecord.invoiceNumber = invoiceNumber;
        }

        console.log('💾 Saving payment record:', paymentRecord);

        // Save payment record to database
        const recordId = orderId || `RECOVERY-${Date.now()}`;
        await set(ref(db, `payments/${user.uid}/${recordId}`), paymentRecord);
        
        console.log('✅ Payment recorded successfully');
        setPaymentRecorded(true);

        // 3. Send invoice email with detailed debugging
        console.log('🔍 [INVOICE DEBUG] Building invoice data...');
        
        // Build invoice data with extensive logging
        const invoiceData = {
          invoiceNumber: invoiceNumber || `INV-DEBUG-${Date.now()}`,
          orderId: orderId || recordId,
          paymentDate: now.toISOString(),
          currency: 'USD',
          amount: amount || 0,
          originalAmount: packageDetails?.originalPrice || packageDetails?.price || 0,
          discount: packageDetails?.discount || 0,
          promoCodeApplied: !!promoCodeDetails,
          promoCodeDetails: promoCodeDetails || null,
          packageName: packageDetails?.name || 'Unknown Package',
          packageDuration: packageDetails?.duration || 30,
          packageFeatures: packageDetails?.features || {},
          jobPostLimit: packageDetails?.jobPostLimit || 5,
          isFreeSubscription: isFreeSubscription || false,
          employerDetails: {
            id: user.uid,
            email: user.email,
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
            companyName: profile.companyName || '',
            phone: profile.phone || ''
          }
        };
        
        console.log('🔍 [INVOICE DEBUG] Complete invoice data built:', JSON.stringify(invoiceData, null, 2));
        
        // Check for any missing critical fields
        const criticalFields = {
          'invoiceData.employerDetails.email': invoiceData.employerDetails.email,
          'invoiceData.packageName': invoiceData.packageName,
          'invoiceData.amount': invoiceData.amount !== undefined,
          'invoiceData.orderId': invoiceData.orderId,
          'invoiceData.invoiceNumber': invoiceData.invoiceNumber
        };
        
        console.log('🔍 [INVOICE DEBUG] Critical fields check:', criticalFields);
        
        // Find missing critical fields
        const missingFields = Object.entries(criticalFields)
          .filter(([key, value]) => !value)
          .map(([key]) => key);
          
        if (missingFields.length > 0) {
          console.log('❌ [INVOICE DEBUG] Missing critical fields:', missingFields);
          setEmailStatus('failed');
          return;
        }
        
        console.log('✅ [INVOICE DEBUG] All critical fields present, calling invoice function...');
        console.log('📧 Preparing invoice email...');
        setEmailStatus('sending');

        console.log('🚀 [INVOICE DEBUG] Calling notifyInvoiceEmail with:', JSON.stringify(invoiceData, null, 2));

        // Call the invoice email function
        const notifyInvoiceEmail = httpsCallable(functions, 'notifyInvoiceEmail');
        const result = await notifyInvoiceEmail(invoiceData);

        console.log('✅ [INVOICE DEBUG] Invoice function returned:', result);
        console.log('✅ Invoice email sent successfully:', result);
        setEmailStatus('sent');

      } catch (error) {
        console.error('❌ [INVOICE DEBUG] Error in invoice processing:', error);
        console.error('❌ [INVOICE DEBUG] Error stack:', error.stack);
        console.error('❌ [INVOICE DEBUG] Error details:', {
          message: error.message,
          code: error.code,
          details: error.details
        });
        
        setEmailStatus('failed');
        
        // Record the error in the database
        try {
          const errorId = orderId || `ERROR-${Date.now()}`;
          await set(ref(db, `notification_errors/${errorId}_invoice`), {
            error: "internal",
            timestamp: new Date().toISOString(),
            type: "invoice_email",
            userId: user.uid,
            details: error.message,
            debugInfo: debugInfo,
            fullError: {
              message: error.message,
              code: error.code,
              stack: error.stack
            }
          });
        } catch (dbError) {
          console.error('Failed to record error:', dbError);
        }
      }
    };

    if (user) {
      processPaymentSuccess();
    }
  }, [user, orderId, packageDetails, invoiceNumber, amount, isFreeSubscription, promoCodeDetails, functions, db, debugInfo, location.state]);

  // ✅ UPDATED: Much more lenient validation - only redirect if really no useful data
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ✅ UPDATED: Only show "no data" if we have absolutely nothing useful
  if (!orderId && !packageDetails && !paymentSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-lg w-full">
          <FaExclamationTriangle className="text-yellow-500 mx-auto mb-4 text-6xl" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Session Expired</h2>
          <p className="text-gray-600 mb-4">
            Your payment session has expired or the data was lost during navigation.
          </p>
          
          {/* Debug Information Panel */}
          <div className="bg-gray-50 p-3 rounded mb-4 text-left">
            <details>
              <summary className="cursor-pointer font-medium text-sm mb-2">🔍 Debug Information (Click to expand)</summary>
              <div className="text-xs bg-white p-2 rounded border max-h-40 overflow-auto">
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
            </details>
          </div>
          
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => navigate('/employer/payments')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              Check Payment History
            </button>
            <button
              onClick={() => navigate('/employer/profile')}
              className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ CONTINUE: Show success page even with partial data
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md w-full">
        <FaCheckCircle className="text-green-500 mx-auto mb-4 text-6xl" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isFreeSubscription ? 'Free Subscription Activated!' : 'Payment Successful!'}
        </h2>
        <p className="text-gray-600 mb-6">
          {isFreeSubscription 
            ? 'Your free subscription is now active. You can start posting jobs immediately!'
            : 'Your payment has been processed and your subscription is now active.'
          }
        </p>

        {/* Payment Status */}
        <div className="bg-green-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-center mb-2">
            <FaCheckCircle className="text-green-600 mr-2" />
            <span className="text-green-900 font-medium">Payment Processed</span>
          </div>
          <div className="text-green-700 text-sm">
            {paymentRecorded ? '✅ Payment recorded in database' : '⏳ Recording payment...'}
          </div>
        </div>

        {/* Order Summary - Only show if we have package details */}
        {packageDetails && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Order Summary</h3>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Package:</span>
              <span className="text-gray-900 font-medium">{packageDetails.name}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Duration:</span>
              <span className="text-gray-900 font-medium">{packageDetails.duration} Days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Amount Paid:</span>
              <span className="text-gray-900 font-medium">
                {isFreeSubscription ? 'FREE' : `USD $${parseFloat(amount || 0).toFixed(2)}`}
              </span>
            </div>
            {orderId && (
              <div className="flex justify-between mt-2 pt-2 border-t border-gray-200">
                <span className="text-gray-600">Order ID:</span>
                <span className="text-gray-900 font-medium text-xs">{orderId}</span>
              </div>
            )}
            {invoiceNumber && (
              <div className="flex justify-between mt-2">
                <span className="text-gray-600">Invoice:</span>
                <span className="text-gray-900 font-medium">{invoiceNumber}</span>
              </div>
            )}
          </div>
        )}

        {/* Invoice Email Status - Only show if successful */}
        {emailStatus === 'sent' && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center mb-2">
              <FaFileInvoice className="text-blue-600 mr-2" />
              <span className="text-blue-900 font-medium">Invoice Email</span>
            </div>
            <div className="text-green-700">
              ✅ Invoice sent successfully to {user?.email}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3">
          <button
            onClick={() => navigate('/employer/jobs')}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center"
          >
            <span>Post a Job</span>
            <FaArrowRight className="ml-2" />
          </button>

          <button
            onClick={() => navigate('/employer/profile')}
            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 flex items-center justify-center"
          >
            <span>Go to Dashboard</span>
          </button>

          <button
            onClick={() => navigate('/employer/payments')}
            className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 flex items-center justify-center"
          >
            <FaFileInvoice className="mr-2" />
            <span>View Payment History & Invoices</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;