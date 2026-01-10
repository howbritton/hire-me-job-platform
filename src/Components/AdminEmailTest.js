import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { app } from '../firebase'; 
import { toast } from 'react-toastify';

const AdminEmailTest = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const auth = getAuth();
    const [user] = useAuthState(auth);
    const functions = getFunctions(app);

    // Test data for regular payment
    const testPaymentData = {
        paymentId: `TEST-${Date.now()}`,
        amount: 29.99,
        currency: "USD",
        packageId: "basic_package",
        packageName: "Basic Subscription",
        packageDetails: {
            duration: 30,
            jobPostLimit: 5,
            features: {
                basicSupport: true,
                emailNotifications: true,
                dashboardAccess: true
            }
        },
        employerId: user?.uid || "test_employer_123",
        employerEmail: user?.email || "test.employer@example.com",
        timestamp: new Date().toISOString(),
        paymentMethod: "card",
        isProratedPayment: false,
        originalPrice: 29.99,
        finalPrice: 29.99,
        promoCodeApplied: false,
        promoCodeDetails: null,
        status: "pending",
        isFreeSubscription: false,
        requiresApproval: true
    };

    // Test data for free subscription with promo code
    const testFreeData = {
        paymentId: `FREE-TEST-${Date.now()}`,
        amount: 0,
        currency: "USD",
        packageId: "premium_package",
        packageName: "Premium Subscription",
        packageDetails: {
            duration: 60,
            jobPostLimit: 20,
            features: {
                premiumSupport: true,
                emailNotifications: true,
                dashboardAccess: true,
                advancedAnalytics: true,
                priorityListing: true
            }
        },
        employerId: user?.uid || "test_employer_456",
        employerEmail: user?.email || "test.employer@example.com",
        timestamp: new Date().toISOString(),
        paymentMethod: "promo_code_100_percent",
        isProratedPayment: false,
        originalPrice: 59.99,
        finalPrice: 0,
        promoCodeApplied: true,
        promoCodeDetails: {
            id: "promo_test_123",
            code: "WELCOME100",
            discountPercentage: 100,
            discountType: "percentage"
        },
        status: "pending",
        isFreeSubscription: true,
        requiresApproval: true
    };

    // Test data with discount promo code
    const testDiscountData = {
        paymentId: `DISCOUNT-TEST-${Date.now()}`,
        amount: 14.99,
        currency: "USD",
        packageId: "standard_package",
        packageName: "Standard Subscription",
        packageDetails: {
            duration: 45,
            jobPostLimit: 10,
            features: {
                standardSupport: true,
                emailNotifications: true,
                dashboardAccess: true,
                basicAnalytics: true
            }
        },
        employerId: user?.uid || "test_employer_789",
        employerEmail: user?.email || "test.employer@example.com",
        timestamp: new Date().toISOString(),
        paymentMethod: "card",
        isProratedPayment: false,
        originalPrice: 29.99,
        finalPrice: 14.99,
        promoCodeApplied: true,
        promoCodeDetails: {
            id: "promo_test_456",
            code: "SAVE50",
            discountPercentage: 50,
            discountType: "percentage"
        },
        status: "pending",
        isFreeSubscription: false,
        requiresApproval: true
    };

    const sendTestEmail = async (testData, testType) => {
        if (!user) {
            toast.error('Please sign in to test the email function');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            console.log(`[TEST] Sending ${testType} email with data:`, testData);
            
            // Call the Firebase function
            const notifyPaymentApprovalAdmin = httpsCallable(functions, 'notifyPaymentApprovalAdmin');
            const response = await notifyPaymentApprovalAdmin(testData);
            
            console.log('[TEST] Function response:', response);
            
            setResult({
                type: testType,
                success: true,
                data: response.data,
                timestamp: new Date().toISOString()
            });
            
            toast.success(`${testType} email sent successfully!`);
            
        } catch (error) {
            console.error(`[TEST] Error sending ${testType} email:`, error);
            setError({
                type: testType,
                message: error.message,
                code: error.code,
                timestamp: new Date().toISOString()
            });
            toast.error(`Failed to send ${testType} email: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                Please sign in to test the admin email notification function.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h1 className="text-2xl font-bold text-gray-900">
                        🧪 Admin Email Notification Test
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Test the payment approval notification emails sent to admins
                    </p>
                </div>

                <div className="p-6">
                    {/* Current User Info */}
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-blue-700">
                                    <strong>Testing as:</strong> {user.email} (UID: {user.uid})
                                </p>
                                <p className="text-sm text-blue-700">
                                    <strong>Emails will be sent to:</strong> how.britton@gmail.com, info@hiremeja.com
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Test Buttons */}
                    <div className="grid md:grid-cols-3 gap-4 mb-6">
                        {/* Regular Payment Test */}
                        <div className="bg-gray-50 p-4 rounded-lg border">
                            <h3 className="font-semibold text-gray-900 mb-2">💳 Regular Payment</h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Test notification for a $29.99 basic package payment
                            </p>
                            <button
                                onClick={() => sendTestEmail(testPaymentData, 'Regular Payment')}
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                            >
                                {loading ? 'Sending...' : 'Send Test Email'}
                            </button>
                        </div>

                        {/* Free Subscription Test */}
                        <div className="bg-green-50 p-4 rounded-lg border">
                            <h3 className="font-semibold text-gray-900 mb-2">🆓 Free Subscription</h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Test notification for 100% discount with WELCOME100 promo code
                            </p>
                            <button
                                onClick={() => sendTestEmail(testFreeData, 'Free Subscription')}
                                disabled={loading}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                            >
                                {loading ? 'Sending...' : 'Send Test Email'}
                            </button>
                        </div>

                        {/* Discount Payment Test */}
                        <div className="bg-orange-50 p-4 rounded-lg border">
                            <h3 className="font-semibold text-gray-900 mb-2">🏷️ Discounted Payment</h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Test notification for 50% discount ($14.99 final price)
                            </p>
                            <button
                                onClick={() => sendTestEmail(testDiscountData, 'Discounted Payment')}
                                disabled={loading}
                                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                            >
                                {loading ? 'Sending...' : 'Send Test Email'}
                            </button>
                        </div>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <div className="flex items-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                                <p className="text-blue-700 font-medium">Sending email notification...</p>
                            </div>
                        </div>
                    )}

                    {/* Success Result */}
                    {result && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                            <h3 className="font-semibold text-green-900 mb-2">✅ Email Sent Successfully!</h3>
                            <div className="text-sm text-green-700 space-y-1">
                                <p><strong>Test Type:</strong> {result.type}</p>
                                <p><strong>Timestamp:</strong> {new Date(result.timestamp).toLocaleString()}</p>
                                {result.data?.messageId && <p><strong>Message ID:</strong> {result.data.messageId}</p>}
                                {result.data?.recipients && (
                                    <p><strong>Recipients:</strong> {result.data.recipients.join(', ')}</p>
                                )}
                                {result.data?.paymentId && <p><strong>Payment ID:</strong> {result.data.paymentId}</p>}
                            </div>
                            <div className="mt-3 bg-green-100 rounded p-3">
                                <p className="text-xs text-green-600">
                                    <strong>Response Data:</strong> {JSON.stringify(result.data, null, 2)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Error Result */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <h3 className="font-semibold text-red-900 mb-2">❌ Email Failed to Send</h3>
                            <div className="text-sm text-red-700 space-y-1">
                                <p><strong>Test Type:</strong> {error.type}</p>
                                <p><strong>Error:</strong> {error.message}</p>
                                {error.code && <p><strong>Code:</strong> {error.code}</p>}
                                <p><strong>Timestamp:</strong> {new Date(error.timestamp).toLocaleString()}</p>
                            </div>
                        </div>
                    )}

                    {/* Instructions */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">📋 Testing Instructions</h3>
                        <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                            <li>Click any test button to send a notification email to the admin addresses</li>
                            <li>Check the console (F12) for detailed logs</li>
                            <li>Check how.britton@gmail.com and info@hiremeja.com for the actual emails</li>
                            <li>Each test uses different payment scenarios (regular, free, discounted)</li>
                            <li>Success/error results will display above</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminEmailTest;