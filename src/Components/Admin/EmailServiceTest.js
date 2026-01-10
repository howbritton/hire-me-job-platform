// Save this as Components/Admin/EmailServiceTest.jsx
import React, { useState } from 'react';

const EmailServiceTest = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Base URL for your email service
  const API_URL = 'http://34.228.74.248:3001';
  
  // Sample payment data for testing with real email addresses
  const samplePaymentData = {
    employerName: "Howard Britton",
    employerEmail: "howard.britton@unicoreonline",
    packageName: "Premium Package",
    amount: 199.99,
    packageDetails: {
      duration: 30,
      jobPostLimit: 10
    }
  };

  const handleRequest = async (endpoint, data = null) => {
    setLoading(true);
    setResult(null);
    
    try {
      const options = {
        method: data ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: data ? JSON.stringify({ paymentData: data }) : undefined
      };
      
      const response = await fetch(`${API_URL}${endpoint}`, options);
      const result = await response.json();
      
      setResult({
        success: response.ok,
        message: response.ok ? 'Request successful!' : 'Request failed',
        details: result
      });
    } catch (error) {
      setResult({
        success: false,
        message: 'Request failed',
        details: { error: error.message }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Email Service Test Panel</h1>
        </div>
        
        <div className="space-y-4">
          {/* Configuration Display */}
          <div className="p-4 border rounded-lg bg-blue-50">
            <h2 className="font-semibold mb-2">Current Configuration</h2>
            <div className="text-sm space-y-1">
              <p><span className="font-medium">Server:</span> {API_URL}</p>
              <p><span className="font-medium">Test Email:</span> {samplePaymentData.employerEmail}</p>
              <p><span className="font-medium">Admin Email:</span> info@hiremeja.com</p>
            </div>
          </div>

          {/* Test Connection */}
          <div className="p-4 border rounded-lg bg-gray-50">
            <h2 className="font-semibold mb-3">Basic Tests</h2>
            <div className="space-x-3">
              <button
                onClick={() => handleRequest('/test')}
                disabled={loading}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                Test Connection
              </button>
              <button
                onClick={() => handleRequest('/test-email')}
                disabled={loading}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                Send Test Email
              </button>
            </div>
          </div>

          {/* Email Notifications */}
          <div className="p-4 border rounded-lg bg-gray-50">
            <h2 className="font-semibold mb-3">Payment Email Tests</h2>
            <div className="space-x-3">
              <button
                onClick={() => handleRequest('/send-approval', samplePaymentData)}
                disabled={loading}
                className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50 transition-colors"
              >
                Test Approval Email
              </button>
              <button
                onClick={() => handleRequest('/send-rejection', samplePaymentData)}
                disabled={loading}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                Test Rejection Email
              </button>
              <button
                onClick={() => handleRequest('/notify-admin', samplePaymentData)}
                disabled={loading}
                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                Test Admin Notification
              </button>
            </div>
          </div>

          {/* Status Display */}
          {loading && (
            <div className="flex items-center justify-center p-4">
              <svg className="animate-spin h-5 w-5 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Processing request...</span>
            </div>
          )}
          
          {result && (
            <div className={`rounded-lg p-4 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-start">
                <div className={`flex-shrink-0 h-5 w-5 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                  {result.success ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3 w-full">
                  <h3 className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.message}
                  </h3>
                  <div className="mt-2 text-sm">
                    <pre className="whitespace-pre-wrap bg-white p-2 rounded border">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailServiceTest;