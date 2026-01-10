/**
 * Main Firebase Functions Entry Point
 * @module CloudFunctions
 * @description Handles payment processing, notifications, job management, and user management
 */

import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onValueDeleted } from "firebase-functions/v2/database";
import { onSchedule } from "firebase-functions/v2/scheduler";
import fetch from "node-fetch";
import nodemailer from "nodemailer";

// Import email notification functions
import { sendJobApprovalEmail } from "./emailApprovalJob.js";
import { sendJobApprovalNotificationToEmployer } from "./emailJobApproval.js";
import { sendJobRejectionNotificationToEmployer } from "./emailJobRejection.js";

import { sendPaymentApprovalToAdmin } from "./emailPaymentAdmin.js";
import { sendCandidateApplicationEmail } from "./emailCandidateApplication.js";
import { sendApplicationStatusEmail } from "./emailApplicationStatus.js";
import { sendReviewApprovalToAdmin } from "./emailReviewApproval.js";
import {
  sendProfileExpirationReminder,
  checkAndDeactivateInactiveProfiles,
} from "./emailProfileExpiration.js";
import { sendPackageExpirationEmail } from "./emailPackageExpiration.js";
import { checkAndUpdateExpiredJobs } from "./jobExpirationFunction.js";
import { checkEmployerSubscriptions } from "./checkEmployerSubscriptions.js";
import { testGmailConnection } from "./testGmail.js";
import { sendPaymentConfirmationEmail } from "./emailPaymentConfirmation.js";
import { sendAdminNotification } from "./emailAdminNotification.js";

import express from "express";
import { onRequest } from "firebase-functions/v2/https";
import path from "path";
import { fileURLToPath } from "url";


// Initialize Firebase Admin SDK
const app = initializeApp();
const auth = getAuth(app);

/**
 * System configuration settings
 * @typedef {Object} SystemConfig
 * @property {Object} merchant - Merchant-specific settings
 * @property {Object} frontend - Frontend application settings
 * @property {Object} checkout - Checkout process settings
 */
const CONFIG = {
  merchant: {
    id: "HIREMEJA",
    password: "e49698da38cd05caa7c21d5bc7a512f6",
    name: "HireMeJA",
    apiVersion: "79",
    apiUrl:
      "https://sagicorbank.gateway.mastercard.com/api/rest/version/79/merchant/",
  },
  frontend: {
    url: "https://hireme-d14cb.firebaseapp.com",
    allowedOrigins: [
      "https://hireme-d14cb.firebaseapp.com",
      "https://hireme-d14cb.web.app",
      "https://hiremeja.com",
      "http://localhost:3000",
    ],
  },
  checkout: {
    minimumAmount: 1,
    supportedCurrencies: ["JMD", "USD"],
    timeout: 1800,
  },
};

/**
 * Firebase function configuration
 * @type {Object}
 */
const functionConfig = {
  enforceAppCheck: false,
  cors: CONFIG.frontend.allowedOrigins,
};

/**
 * Validates payment amount
 * @param {number} amount - Amount to validate
 * @return {boolean} Validation result
 */
function validateAmount(amount) {
  return (
    amount &&
                typeof amount === "number" &&
                amount >= CONFIG.checkout.minimumAmount
  );
}

/**
 * Validates currency code
 * @param {string} currency - Currency code to validate
 * @return {boolean} Validation result
 */
function validateCurrency(currency) {
  return CONFIG.checkout.supportedCurrencies.includes(currency);
}

/**
 * Validates order ID format
 * @param {string} orderId - Order ID to validate
 * @return {boolean} Validation result
 */
function validateOrderId(orderId) {
  return orderId &&
               typeof orderId === "string" &&
               orderId.startsWith("ORDER-");
}

/**
 * Creates payment session data object
 * @param {Object} checkoutData - Validated checkout info
 * @return {Object} Formatted session data for gateway
 */
function createSessionData(checkoutData) {
  return {
    apiOperation: "INITIATE_CHECKOUT",
    interaction: {
      operation: "PURCHASE",
      merchant: {
        name: CONFIG.merchant.name,
      },
    },
    order: {
      currency: checkoutData.currency,
      amount: checkoutData.amount.toFixed(2),
      id: checkoutData.orderId,
      description: "Goods and Services",
    },
  };
}

/**
 * Stores session information in database
 * @param {Object} db - Firebase database instance
 * @param {Object} sessionInfo - Session details to store
 * @return {Promise<void>}
 */
async function storeSession(db, sessionInfo) {
  const { orderId, userId, sessionId, amount,
    currency, version, packageDetails } = sessionInfo;
  const sessionRef =
    db.ref(`checkoutSessions/${orderId}`);
  const expiry = new Date(Date.now() +
    CONFIG.checkout.timeout * 1000);

  await sessionRef.set({
    sessionId,
    sessionVersion: version,
    userId,
    orderId,
    amount,
    currency,
    status: "pending",
    createdAt: new Date().toISOString(),
    expiresAt: expiry.toISOString(),
    lastUpdated: new Date().toISOString(),
    checkoutMode: "WEBSITE",
    operation: "PURCHASE",
    packageId: packageDetails?.id || "unknown",
    packageName: packageDetails?.name || "Package",
    package: packageDetails,
    originalPrice: packageDetails?.originalPrice ||
      packageDetails?.price,
    finalPrice: packageDetails?.finalPrice ||
      packageDetails?.price,
    discount: packageDetails?.discount || 0,
    promoCodeApplied: packageDetails?.promoCodeApplied || false,
  });
}

/**
 * Validates checkout request data
 * @param {Object} data - Request data to validate
 * @return {Object} Validated data
 * @throws {HttpsError} Validation error details
 */
function validateRequest(data) {
  if (!validateAmount(data.amount)) {
    throw new HttpsError(
      "invalid-argument",
      `Amount must be greater than ${CONFIG.checkout.minimumAmount}`,
    );
  }

  if (!validateCurrency(data.currency)) {
    const currencies = CONFIG.checkout.supportedCurrencies.join(", ");
    throw new HttpsError(
      "invalid-argument",
      `Currency must be one of: ${currencies}`,
    );
  }

  if (!validateOrderId(data.orderId)) {
    throw new HttpsError(
      "invalid-argument",
      "Valid orderId is required (must start with ORDER-)",
    );
  }

  return {
    amount: data.amount,
    currency: data.currency,
    orderId: data.orderId,
  };
}

// Exported Cloud Functions

/**
 * Initializes checkout session with payment gateway
 * @type {CloudFunction<unknown>}
 */
export const apiInitiateCheckout = onCall(
  {
    cors: true,
    maxInstances: 10,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }

    try {
      const db = getDatabase();
      const validatedData = validateRequest(request.data);

      const sessionData = createSessionData(validatedData);

      const authStr = Buffer.from(
        `merchant.${CONFIG.merchant.id}:${CONFIG.merchant.password}`,
      ).toString("base64");

      const apiUrl = `${CONFIG.merchant.apiUrl}${CONFIG.merchant.id}/session`;

      // Use node-fetch for the request
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authStr}`,
        },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Payment gateway error:", errorData);
        throw new HttpsError(
          "internal",
          errorData.error?.explanation || "Failed to create checkout session",
        );
      }

      const responseData = await response.json();

      if (!responseData.session?.id) {
        throw new HttpsError(
          "internal",
          "Invalid response: Session ID not received",
        );
      }

      // Store session in database
      await storeSession(db, {
        orderId: validatedData.orderId,
        userId: request.auth.uid,
        sessionId: responseData.session.id,
        amount: validatedData.amount,
        currency: validatedData.currency,
        version: responseData.session.version,
        packageDetails: request.data.packageDetails ||
          request.data,
      });

      // Return success response
      return {
        result: {
          success: true,
          sessionId: responseData.session.id,
          successIndicator: responseData.successIndicator,
        },
      };
    } catch (error) {
      console.error("Checkout session creation error:", error);
      throw new HttpsError(
        "internal",
        `Checkout session creation failed: ${error.message}`,
      );
    }
  },
);


// Test function to verify gateway connection
export const testGatewayConnection = onCall(
  {
    cors: true,
    maxInstances: 1,
  },
  async (request) => {
    try {
      const testData = {
        amount: 10.00,
        currency: "USD",
        orderId: `ORDER-${Date.now()}`,
      };

      const validatedData = validateRequest(testData);
      const sessionData = createSessionData(validatedData);

      const authStr = Buffer.from(
        `merchant.${CONFIG.merchant.id}:${CONFIG.merchant.password}`,
      ).toString("base64");

      const apiUrl = `${CONFIG.merchant.apiUrl}${CONFIG.merchant.id}/session`;

      console.log("Attempting to connect to gateway...");
      console.log("URL:", apiUrl);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authStr}`,
        },
        body: JSON.stringify(sessionData),
      });

      const responseData = await response.json();
      console.log("Gateway Response:", responseData);

      return {
        success: response.ok,
        status: response.status,
        data: responseData,
      };
    } catch (error) {
      console.error("Gateway test failed:", error);
      throw new HttpsError(
        "internal",
        `Gateway connection test failed: ${error.message}`,
      );
    }
  },
);

// Email Notification Functions

/**
 * Sends notifications for new
 * job submissions
 */
export const notifyJobSubmission = onCall(
  functionConfig,
  async (request) => {
    return await sendJobApprovalEmail(request.data, request);
  });

/**
 * Sends notification to employer when their job is approved
 */
export const notifyJobApproval = onCall(
  functionConfig,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }
    return await
    sendJobApprovalNotificationToEmployer(request.data, request);
  },
);

/**
 * Sends notification to employer when their job is rejected
 */
export const notifyJobRejection = onCall(
  functionConfig,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }
    return await sendJobRejectionNotificationToEmployer(
      request.data, request);
  },
);

/**
 * Sends notification for payment approval to admin
 */
export const notifyPaymentApprovalAdmin = onCall(
  functionConfig,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }
    return await sendPaymentApprovalToAdmin(request.data, request);
  },
);

/**
 * Sends notification for new candidate application
 */
export const notifyCandidateApplication = onCall(
  functionConfig,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }
    return await sendCandidateApplicationEmail(request.data, request);
  },
);

/**
 * Sends notification for application status update
 */
export const notifyApplicationStatus = onCall(
  functionConfig,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }
    return await sendApplicationStatusEmail(request.data, request);
  },
);

/**
 * Sends notification for new review approval request
 */
export const notifyReviewApproval = onCall(
  functionConfig,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }
    return await sendReviewApprovalToAdmin(request.data, request);
  },
);

/**
 * Sends notification for profile expiration
 */
export const notifyProfileExpiration = onCall(
  {
    enforceAppCheck: false,
    cors: [
      "https://hiremeja.com",
      "http://localhost:3000",
    ],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }

    // Extract data needed for our new function
    const { userId, userRole, email } = request.data;

    // Call our new function with the extracted data
    return await sendProfileExpirationReminder({
      userId, userRole, email }, request);
  },
);

/**
 * Sends notification for package expiration
 */
export const notifyPackageExpiration = onCall(
  functionConfig,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }
    return await sendPackageExpirationEmail(request.data, request);
  },
);

/**
 * Scheduled function that runs daily to check for and deactivate inactive profiles
 * Profiles that haven't been updated in 30+ days will be set to private/inactive
 */
export const scheduledProfileDeactivation = onSchedule({
  schedule: "every day 00:00",
  timeZone: "America/Jamaica",
  retryCount: 3,
  maxInstances: 1,
}, async (event) => {
  console.log("Running scheduled profile deactivation check...");
  try {
    const result = await checkAndDeactivateInactiveProfiles();
    console.log("Profile deactivation completed:", result);
    return result;
  } catch (error) {
    console.error("Error in scheduled profile deactivation:", error);
    throw error;
  }
});

/**
 * Manually trigger profile deactivation check
 * For admin use or testing
 */
export const manualProfileDeactivationCheck = onCall(
  functionConfig,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }

    // Verify the user is an admin
    const db = getDatabase();
    const adminRef = db.ref(`admins/${request.auth.uid}`);
    const snapshot = await adminRef.once("value");

    if (!snapshot.exists()) {
      throw new HttpsError(
        "permission-denied",
        "Only administrators can manually trigger profile deactivation checks",
      );
    }

    try {
      console.log("Running manual profile deactivation check...");
      const result = await checkAndDeactivateInactiveProfiles();
      console.log("Manual profile deactivation completed:", result);
      return result;
    } catch (error) {
      console.error("Error in manual profile deactivation:", error);
      throw new HttpsError("internal", error.message);
    }
  },
);

// User Management Functions

/**
 * Firebase function that deletes a user from Firebase Authentication
 * when they are deleted from the Realtime Database.
 *
 * Triggers on delete events for both 'employers' and 'candidates' paths.
 */
export const deleteAuthUser = onValueDeleted("/{userType}/{userId}", async (event, context) => {
  const { userType, userId } = context.params;

  // Only process for valid user types
  if (userType !== "employers" && userType !== "candidates") {
    console.log(`Ignoring delete for non-user collection: ${userType}`);
    return null;
  }

  try {
    console.log(`User deleted from database: ${userType}/${userId}`);

    // Check if the user exists in Authentication
    try {
      // Get the user from Authentication
      await auth.getUser(userId);

      // If user exists, delete them
      await auth.deleteUser(userId);
      console.log(`Successfully deleted auth user: ${userId}`);

      return { success: true, message: `User ${userId} deleted from authentication` };
    } catch (authError) {
      // If error is "user not found", that's okay
      if (authError.code === "auth/user-not-found") {
        console.log(`Auth user ${userId} does not exist or was already deleted`);
        return { success: true, message: `Auth user ${userId} does not exist or was already deleted` };
      }

      // Otherwise, log the error but don't fail the function
      console.error(`Error getting/deleting auth user ${userId}:`, authError);
      return { success: false, error: authError.message };
    }
  } catch (error) {
    console.error(`Error in deleteAuthUser function:`, error);
    return { success: false, error: error.message };
  }
});

export const testGmail = onCall(
  {
    enforceAppCheck: false,
    cors: CONFIG.frontend.allowedOrigins,
  },
  async (request) => {
    // No authentication required for testing
    return await testGmailConnection(request.data, request);
  },
);

/**
 * HTTP endpoint that can be called manually to delete a user
 * Both from the database and authentication
 */
export const deleteUser = onCall(functionConfig, async (request) => {
  // Check if the caller is authenticated
  if (!request.auth) {
    throw new HttpsError(
      "permission-denied",
      "User must be authenticated to delete users.",
    );
  }

  const { userId, userType } = request.data;

  if (!userId || !userType) {
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with userId and userType arguments.",
    );
  }

  // Validate userType
  if (userType !== "employer" && userType !== "candidate") {
    throw new HttpsError(
      "invalid-argument",
      "userType must be either \"employer\" or \"candidate\".",
    );
  }

  try {
    const db = getDatabase();

    // Delete from database first
    const userRef = db.ref(`${userType}s/${userId}`);

    // Check if user exists
    const snapshot = await userRef.once("value");
    if (!snapshot.exists()) {
      throw new HttpsError(
        "not-found",
        `User ${userId} not found in ${userType}s collection.`,
      );
    }

    // Delete user from database
    await userRef.remove();

    // Delete from authentication
    try {
      await auth.deleteUser(userId);
      console.log(`Successfully deleted user ${userId} from auth and database`);
    } catch (authError) {
      // If user not found in auth, that's okay
      if (authError.code === "auth/user-not-found") {
        console.log(`Auth user ${userId} not found, but database record was deleted`);
      } else {
        console.error(`Error deleting auth user ${userId}:`, authError);
        return {
          success: true,
          databaseDeleted: true,
          authDeleted: false,
          message: `User deleted from database, but auth deletion failed: ${authError.message}`,
        };
      }
    }

    return {
      success: true,
      databaseDeleted: true,
      authDeleted: true,
      message: `User ${userId} successfully deleted from both database and authentication`,
    };
  } catch (error) {
    console.error(`Error in deleteUser function:`, error);
    throw new HttpsError("internal", error.message);
  }
});

export { checkEmployerSubscriptions };

export { checkAndUpdateExpiredJobs };

export const notifyInvoiceEmail = onCall(
  functionConfig,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }

    try {
      const {
        employerId,
        employerEmail,
        paymentId,
        invoiceNumber,
        packageName,
        amount,
        packageDetails,
        paymentDate,
        status,
      } = request.data;

      console.log("📧 [INVOICE EMAIL] Starting invoice email for:", {
        employerEmail,
        paymentId,
        invoiceNumber,
        amount,
      });

      if (!employerEmail || !paymentId || !invoiceNumber) {
        throw new HttpsError(
          "invalid-argument",
          "Missing required fields: employerEmail, paymentId, and invoiceNumber",
        );
      }

      const db = getDatabase();

      // Get employer details
      const employerRef = db.ref(`employers/${employerId}`);
      const employerSnapshot = await employerRef.once("value");
      const employerData = employerSnapshot.val() || {};
      const employerName = employerData.firstName &&
        employerData.lastName ?
        `${employerData.firstName} ${employerData.lastName}` :
        "Valued Customer";

      const profile = employerData.profile || {};
      const companyName = profile.companyName || employerName;
      const invoiceDate = new Date(paymentDate);

      console.log("📧 [INVOICE EMAIL] Sending HTML invoice email...");

      // Send HTML invoice email (no PDF)
      const transporter = nodemailer.createTransporter({
        service: "gmail",
        auth: {
          user: "info@hiremeja.com",
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      const subject = `📄 Invoice ${invoiceNumber} - HireMeJA Payment Confirmation`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 48px; font-weight: bold;">INVOICE</h1>
            <h2 style="margin: 10px 0 0 0; font-size: 20px; opacity: 0.9;">${invoiceNumber}</h2>
          </div>
          
          <!-- Content -->
          <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            
            <!-- Company Details -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
              <div style="flex: 1; margin-right: 20px;">
                <h3 style="color: #1e3a8a; margin-bottom: 15px; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">From:</h3>
                <p style="margin: 5px 0; font-size: 14px;"><strong>HireMeJA</strong></p>
                <p style="margin: 5px 0; font-size: 14px;">Digital Recruitment Platform</p>
                <p style="margin: 5px 0; font-size: 14px;">Kingston, Jamaica</p>
                <p style="margin: 5px 0; font-size: 14px;">📧 info@hiremeja.com</p>
                <p style="margin: 5px 0; font-size: 14px;">🌐 www.hiremeja.com</p>
              </div>
              <div style="flex: 1;">
                <h3 style="color: #1e3a8a; margin-bottom: 15px; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">To:</h3>
                <p style="margin: 5px 0; font-size: 14px;"><strong>${companyName}</strong></p>
                <p style="margin: 5px 0; font-size: 14px;">${employerName}</p>
                <p style="margin: 5px 0; font-size: 14px;">📧 ${employerEmail}</p>
                ${profile.phone ? `<p style="margin: 5px 0; font-size: 14px;">📞 ${profile.phone}</p>` : ""}
                ${profile.address ? `<p style="margin: 5px 0; font-size: 14px;">📍 ${profile.address}</p>` : ""}
              </div>
            </div>
            
            <!-- Invoice Meta -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e5e7eb;">
              <div>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Invoice Date:</strong> ${invoiceDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Payment ID:</strong> ${paymentId}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Invoice #:</strong> ${invoiceNumber}</p>
              </div>
              <div style="text-align: right;">
                <p style="margin: 5px 0; font-size: 14px;"><strong>Payment Status:</strong></p>
                <div style="background: #22c55e; color: white; padding: 6px 15px; border-radius: 20px; font-size: 14px; font-weight: bold; display: inline-block;">
                  ${(status || "PAID").toUpperCase()}
                </div>
              </div>
            </div>
            
            <!-- Invoice Table -->
            <div style="margin: 30px 0; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
              <div style="background: #1e3a8a; color: white; padding: 18px; display: flex;">
                <div style="width: 40%; font-size: 14px; font-weight: bold;">Description</div>
                <div style="width: 20%; font-size: 14px; font-weight: bold; text-align: center;">Duration</div>
                <div style="width: 20%; font-size: 14px; font-weight: bold; text-align: center;">Job Posts</div>
                <div style="width: 20%; font-size: 14px; font-weight: bold; text-align: right;">Amount</div>
              </div>
              <div style="padding: 18px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center;">
                <div style="width: 40%;">
                  <p style="margin: 0; font-size: 14px; font-weight: bold;">${packageName}</p>
                  <p style="margin: 2px 0 0 0; font-size: 12px; color: #666;">HireMeJA Recruitment Package</p>
                </div>
                <div style="width: 20%; font-size: 14px; text-align: center;">${packageDetails?.duration || 30} days</div>
                <div style="width: 20%; font-size: 14px; text-align: center;">${packageDetails?.jobPostLimit || 10} jobs</div>
                <div style="width: 20%; font-size: 14px; text-align: right;">$${parseFloat(amount).toFixed(2)}</div>
              </div>
              <div style="padding: 18px; background: #f8f9fa; border-top: 2px solid #1e3a8a; font-weight: bold; font-size: 16px; display: flex;">
                <div style="width: 80%; text-align: right;">Total Amount:</div>
                <div style="width: 20%; text-align: right;">$${parseFloat(amount).toFixed(2)}</div>
              </div>
            </div>
            
            <!-- Payment Confirmed -->
            <div style="margin: 40px 0; padding: 25px; background: #dcfce7; border-left: 5px solid #22c55e; border-radius: 8px;">
              <h3 style="color: #15803d; margin: 0 0 10px 0; font-size: 20px;">✅ Payment Confirmed</h3>
              <p style="color: #166534; margin: 0; font-size: 16px;">
                Thank you for your payment! Your subscription is now active and you can start posting jobs immediately.
                We appreciate your business and look forward to helping you find the right talent.
              </p>
            </div>
            
            <!-- Payment Security -->
            <div style="text-align: center; margin: 40px 0; padding: 30px; border-top: 3px solid #e5e7eb; background: #f8f9fa;">
              <h3 style="color: #1e3a8a; margin: 0 0 20px 0; font-size: 20px;">🔒 Secure Payment Processing</h3>
              <div style="margin: 20px 0;">
                <span style="display: inline-block; background: #1e3a8a; color: white; padding: 8px 16px; margin: 5px; border-radius: 5px; font-weight: bold;">💳 VISA</span>
                <span style="display: inline-block; background: #eb001b; color: white; padding: 8px 16px; margin: 5px; border-radius: 5px; font-weight: bold;">💳 MasterCard</span>
                <span style="display: inline-block; background: #28a745; color: white; padding: 8px 16px; margin: 5px; border-radius: 5px; font-weight: bold;">🛡️ ID-CHECK</span>
              </div>
              <p style="font-size: 12px; color: #666; margin: 15px 0 0 0;">
                Your payment is secured with industry-standard encryption and fraud protection
              </p>
            </div>
            
            <!-- Call to Action -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://hiremeja.com/employer/dashboard" 
                 style="background: #1e3a8a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Start Posting Jobs Now →
              </a>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://hiremeja.com/employer/payments" 
                style="background: #1e3a8a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Access your Invoice here →
              </a>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; font-size: 12px; color: #666; margin-top: 40px; padding: 20px; background: #f8f9fa; border-top: 1px solid #e5e7eb;">
              <p style="margin: 5px 0; font-weight: bold;">© ${new Date().getFullYear()} HireMeJA. All rights reserved.</p>
              <p style="margin: 5px 0;">
                This is an automated invoice generated on ${new Date().toLocaleDateString()}.
                Please do not reply to this email.
              </p>
              <p style="margin: 5px 0;">For support, contact us at info@hiremeja.com</p>
            </div>
          </div>
        </div>
      `;

      const mailOptions = {
        from: "info@hiremeja.com",
        to: employerEmail,
        subject: subject,
        html: emailHtml,
      };

      await transporter.sendMail(mailOptions);

      console.log("✅ [INVOICE EMAIL] HTML invoice email sent successfully to:", employerEmail);
      return {
        success: true,
        message: "Invoice email sent successfully",
        invoiceNumber: invoiceNumber,
        method: "HTML",
      };
    } catch (error) {
      console.error("❌ [INVOICE EMAIL] Error sending invoice email:", error);
      throw new HttpsError("internal", `Failed to send invoice email: ${error.message}`);
    }
  },
);

/**
 * Sends notification when admin approves a payment
 */
export const sendPaymentApprovalEmail = onCall(
  functionConfig,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }

    try {
      const {
        employerId,
        employerEmail,
        paymentId,
        packageName,
        amount,
      } = request.data;

      if (!employerEmail || !paymentId) {
        throw new HttpsError(
          "invalid-argument",
          "Missing required fields: employerEmail and paymentId",
        );
      }

      const db = getDatabase();

      // Get employer details
      const employerRef = db.ref(`employers/${employerId}`);
      const employerSnapshot = await employerRef.once("value");
      const employerData = employerSnapshot.val() || {};
      const employerName = employerData.firstName &&
        employerData.lastName ?
        `${employerData.firstName} ${employerData.lastName}` :
        "Valued Employer";

      const subject = "🎉 Payment Approved - Your Subscription is Now Active!";

      // Use string concatenation instead of template literals for complex HTML
      const emailBody = [
        "<html>",
        "  <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333;\">",
        "    <div style=\"max-width: 600px; margin: 0 auto; padding: 20px;\">",
        "      <div style=\"background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px;\">",
        "        <h1 style=\"margin: 0; font-size: 28px;\">Payment Approved!</h1>",
        "        <p style=\"margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;\">Your subscription is now active</p>",
        "      </div>",
        "      <div style=\"background: #f8f9fa; padding: 30px; margin: 20px 0; border-radius: 10px; border-left: 5px solid #28a745;\">",
        "        <h2 style=\"color: #28a745; margin-top: 0;\">Great News, " + employerName + "!</h2>",
        "        <p>Your payment has been approved and your subscription is now active. You can start posting jobs immediately!</p>",
        "        <div style=\"background: white; padding: 20px; border-radius: 8px; margin: 20px 0;\">",
        "          <h3 style=\"margin-top: 0; color: #333;\">Payment Details:</h3>",
        "          <table style=\"width: 100%; border-collapse: collapse;\">",
        "            <tr style=\"border-bottom: 1px solid #eee;\">",
        "              <td style=\"padding: 8px 0; font-weight: bold;\">Payment ID:</td>",
        "              <td style=\"padding: 8px 0;\">" + paymentId + "</td>",
        "            </tr>",
        "            <tr style=\"border-bottom: 1px solid #eee;\">",
        "              <td style=\"padding: 8px 0; font-weight: bold;\">Package:</td>",
        "              <td style=\"padding: 8px 0;\">" + packageName + "</td>",
        "            </tr>",
        "            <tr style=\"border-bottom: 1px solid #eee;\">",
        "              <td style=\"padding: 8px 0; font-weight: bold;\">Amount:</td>",
        "              <td style=\"padding: 8px 0;\">$" + amount + "</td>",
        "            </tr>",
        "            <tr>",
        "              <td style=\"padding: 8px 0; font-weight: bold;\">Status:</td>",
        "              <td style=\"padding: 8px 0; color: #28a745; font-weight: bold;\">APPROVED</td>",
        "            </tr>",
        "          </table>",
        "        </div>",
        "        <div style=\"text-align: center; margin: 30px 0;\">",
        "          <a href=\"https://hiremeja.com/employer/dashboard\"",
        "             style=\"background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;\">",
        "            Start Posting Jobs Now",
        "          </a>",
        "        </div>",
        "        <div style=\"text-align: center; margin: 30px 0;\">",
        "           <a href=\"https://hiremeja.com/employer/payments\"",
        "              style=\"background: #1e3a8a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;\">",
        "            Access your Invoice here →",
        "           </a>",
        "        </div>",
        "        <p style=\"margin-bottom: 0; color: #666; font-size: 14px;\">",
        "          If you have any questions, please contact our support team.",
        "        </p>",
        "      </div>",
        "      <div style=\"text-align: center; color: #666; font-size: 12px; margin-top: 30px;\">",
        "        <p>© 2025 HireMeJA. All rights reserved.</p>",
        "      </div>",
        "    </div>",
        "  </body>",
        "</html>",
      ].join("\n");

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "info@hiremeja.com",
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      const mailOptions = {
        from: "info@hiremeja.com",
        to: employerEmail,
        subject: subject,
        html: emailBody,
      };

      await transporter.sendMail(mailOptions);

      console.log(`Payment approval email sent to ${employerEmail} for payment ${paymentId}`);
      return { success: true, message: "Approval email sent successfully" };
    } catch (error) {
      console.error("Error sending payment approval email:", error);
      throw new HttpsError("internal", "Failed to send approval email");
    }
  },
);

/**
 * Sends notification when admin declines a payment
 */
export const sendPaymentDeclineEmail = onCall(
  functionConfig,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }

    try {
      const {
        employerId,
        employerEmail,
        paymentId,
        packageName,
        amount,
        declineReason,
      } = request.data;

      if (!employerEmail || !paymentId || !declineReason) {
        throw new HttpsError(
          "invalid-argument",
          "Missing required fields: employerEmail, paymentId, and declineReason",
        );
      }

      const db = getDatabase();

      // Get employer details
      const employerRef = db.ref(`employers/${employerId}`);
      const employerSnapshot = await employerRef.once("value");
      const employerData = employerSnapshot.val() || {};
      const employerName = employerData.firstName &&
        employerData.lastName ?
        `${employerData.firstName} ${employerData.lastName}` :
        "Valued Employer";

      const subject = "❌ Payment Declined - Action Required";

      // Use string concatenation instead of template literals for complex HTML
      const emailBody = [
        "<html>",
        "  <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333;\">",
        "    <div style=\"max-width: 600px; margin: 0 auto; padding: 20px;\">",
        "      <div style=\"background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px;\">",
        "        <h1 style=\"margin: 0; font-size: 28px;\">Payment Declined</h1>",
        "        <p style=\"margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;\">Please review the details below</p>",
        "      </div>",
        "      <div style=\"background: #f8f9fa; padding: 30px; margin: 20px 0; border-radius: 10px; border-left: 5px solid #dc3545;\">",
        "        <h2 style=\"color: #dc3545; margin-top: 0;\">Payment Update for " + employerName + "</h2>",
        "        <p>Unfortunately, your recent payment has been declined. Please review the reason below and contact us if you need assistance.</p>",
        "        <div style=\"background: white; padding: 20px; border-radius: 8px; margin: 20px 0;\">",
        "          <h3 style=\"margin-top: 0; color: #333;\">Payment Details:</h3>",
        "          <table style=\"width: 100%; border-collapse: collapse;\">",
        "            <tr style=\"border-bottom: 1px solid #eee;\">",
        "              <td style=\"padding: 8px 0; font-weight: bold;\">Payment ID:</td>",
        "              <td style=\"padding: 8px 0;\">" + paymentId + "</td>",
        "            </tr>",
        "            <tr style=\"border-bottom: 1px solid #eee;\">",
        "              <td style=\"padding: 8px 0; font-weight: bold;\">Package:</td>",
        "              <td style=\"padding: 8px 0;\">" + packageName + "</td>",
        "            </tr>",
        "            <tr style=\"border-bottom: 1px solid #eee;\">",
        "              <td style=\"padding: 8px 0; font-weight: bold;\">Amount:</td>",
        "              <td style=\"padding: 8px 0;\">$" + amount + "</td>",
        "            </tr>",
        "            <tr style=\"border-bottom: 1px solid #eee;\">",
        "              <td style=\"padding: 8px 0; font-weight: bold;\">Status:</td>",
        "              <td style=\"padding: 8px 0; color: #dc3545; font-weight: bold;\">DECLINED</td>",
        "            </tr>",
        "            <tr>",
        "              <td style=\"padding: 8px 0; font-weight: bold; vertical-align: top;\">Reason:</td>",
        "              <td style=\"padding: 8px 0; color: #dc3545;\">" + declineReason + "</td>",
        "            </tr>",
        "          </table>",
        "        </div>",
        "        <div style=\"background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;\">",
        "          <h4 style=\"margin-top: 0; color: #856404;\">What's Next?</h4>",
        "          <ul style=\"margin-bottom: 0; color: #856404;\">",
        "            <li>Contact our support team for clarification</li>",
        "            <li>Review and correct any payment information if needed</li>",
        "            <li>Submit a new payment once issues are resolved</li>",
        "          </ul>",
        "        </div>",
        "        <div style=\"text-align: center; margin: 30px 0;\">",
        "          <a href=\"https://hiremeja.com/contact\"",
        "             style=\"background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;\">",
        "            Contact Support",
        "          </a>",
        "          <a href=\"https://hiremeja.com/pricing\"",
        "             style=\"background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;\">",
        "            Try Again",
        "          </a>",
        "        </div>",
        "        <p style=\"margin-bottom: 0; color: #666; font-size: 14px;\">",
        "          We're here to help! Please don't hesitate to reach out if you have any questions.",
        "        </p>",
        "      </div>",
        "      <div style=\"text-align: center; color: #666; font-size: 12px; margin-top: 30px;\">",
        "        <p>© 2025 HireMeJA. All rights reserved.</p>",
        "      </div>",
        "    </div>",
        "  </body>",
        "</html>",
      ].join("\n");

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "info@hiremeja.com",
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      const mailOptions = {
        from: "info@hiremeja.com",
        to: employerEmail,
        subject: subject,
        html: emailBody,
      };

      await transporter.sendMail(mailOptions);

      console.log(`Payment decline email sent to ${employerEmail} for payment ${paymentId}`);
      return { success: true, message: "Decline email sent successfully" };
    } catch (error) {
      console.error("Error sending payment decline email:", error);
      throw new HttpsError("internal", "Failed to send decline email");
    }
  },
);

// ✅ ADD THE NEW FUNCTION HERE - RIGHT AFTER notifyInvoiceEmail

export { scheduledJobExpiration, manualJobExpiration } from "./jobExpiration.js";

export { testJobExpirationEmail } from "./testJobExpirationEmail.js";

export { onContactMessageSubmitted } from "./contactNotification.js";

export {
  scheduledProfileExpiration,
  manualProfileExpiration,
  bulkProfileReactivation,
} from "./CandidateProfileExpiration.js";

export const handlePaymentCompletion = onCall(
  functionConfig,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }

    try {
      const {
        orderId,
        resultIndicator,
        sessionVersion,
        packageDetails,
        amount,
        promoCodeDetails,
        userDetails,
      } = request.data;

      console.log("🔔 [PAYMENT COMPLETION] Processing payment:", {
        orderId,
        amount,
        packageId: packageDetails?.id,
        packageName: packageDetails?.name,
        providedDuration: packageDetails?.duration, // ✅ LOG PROVIDED DURATION
      });

      if (!orderId || !packageDetails || amount === undefined) {
        throw new HttpsError(
          "invalid-argument",
          "Missing required payment data: orderId, packageDetails, and amount are required",
        );
      }

      const db = getDatabase();
      const now = new Date();
      const userId = request.auth.uid;

      // ✅ ENHANCED DURATION RESOLUTION WITH MULTIPLE FALLBACKS
      let packageDuration = packageDetails.duration;

      console.log("🔍 [DURATION] Initial duration from packageDetails:", packageDuration);

      // If duration is missing or invalid, fetch from packages collection
      if (!packageDuration || packageDuration <= 0 ||
        isNaN(packageDuration)) {
        console.log("⚠️ [DURATION] Invalid duration, fetching from packages collection...");

        try {
          const packageRef = db.ref(`packages/${packageDetails.id}`);
          const packageSnapshot = await packageRef.once("value");

          if (packageSnapshot.exists()) {
            const packageData = packageSnapshot.val();
            packageDuration = packageData.duration;
            console.log("✅ [DURATION] Retrieved duration from packages collection:", packageDuration);

            // Update packageDetails with correct duration
            packageDetails.duration = packageDuration;
          } else {
            console.error("❌ [DURATION] Package not found in database:", packageDetails.id);
          }
        } catch (fetchError) {
          console.error("❌ [DURATION] Error fetching package from database:", fetchError);
        }
      }

      // Final fallback validation
      if (!packageDuration ||
        packageDuration <= 0 ||
        isNaN(packageDuration)) {
        console.warn("⚠️ [DURATION] No valid duration found, using 30-day fallback");
        packageDuration = 30; // Only use 30 as absolute last resort
      }

      console.log("🎯 [DURATION] Final resolved duration:", packageDuration, "days");

      // 1. Generate invoice number
      const generateInvoiceNumber = (orderId) => {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, "0");

        let uniqueId = "";
        if (orderId.startsWith("ORDER-") || orderId.startsWith("FREE-")) {
          uniqueId = orderId.substring(
            orderId.indexOf("-") + 1,
            orderId.indexOf("-") + 7,
          );
        } else if (!isNaN(parseInt(orderId))) {
          uniqueId = orderId.toString().slice(-6);
        } else {
          uniqueId = orderId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 6);
        }

        return `INV-${year}${month}-${uniqueId}`;
      };

      const invoiceNumber = generateInvoiceNumber(orderId);

      // 2. Update checkout session to pending
      console.log("🔔 [PAYMENT COMPLETION] Updating checkout session...");
      await db.ref(`checkoutSessions/${orderId}`).update({
        status: "pending",
        lastUpdated: now.toISOString(),
        resultIndicator,
        sessionVersion,
        packageId: packageDetails.id,
        packageName: packageDetails.name,
        // ✅ STORE RESOLVED DURATION IN CHECKOUT SESSION
        packageDuration: packageDuration,
        requiresApproval: true,
      });

      // 3. CREATE PAYMENT RECORD with PENDING status
      console.log("💾 [PAYMENT COMPLETION] Creating payment record...");
      const paymentData = {
        packageId: packageDetails.id,
        packageName: packageDetails.name,
        amount: parseFloat(amount),
        originalPrice: packageDetails.originalPrice ||
          packageDetails.price,
        finalPrice: packageDetails.finalPrice || packageDetails.price,
        discount: packageDetails.discount || 0,
        promoCodeApplied: packageDetails.promoCodeApplied || false,
        promoCodeDetails: promoCodeDetails || null,
        status: "pending",
        createdAt: now.toISOString(),
        employerId: userId,
        employerEmail: userDetails?.email || request.auth.token.email,
        paymentMethod: amount === 0 ? "promo_code_100_percent" : "card",
        orderId: orderId,
        invoiceNumber: invoiceNumber,
        currency: "USD",
        // ✅ STORE PACKAGE DETAILS WITH RESOLVED DURATION
        packageDetails: {
          ...packageDetails,
          duration: packageDuration, // Ensure duration is included
        },
        // ✅ SEPARATE DURATION FIELD FOR EASY ACCESS
        packageDuration: packageDuration,
        isFreeSubscription: amount === 0,
        requiresApproval: true,
        sagicorResponse: resultIndicator ? {
          resultIndicator,
          sessionVersion,
          processedAt: now.toISOString(),
        } : null,
      };

      // Save payment record
      await db.ref(`payments/${userId}/${orderId}`).set(paymentData);
      console.log("✅ [PAYMENT COMPLETION] Payment record created with duration:", packageDuration);

      // 4. CREATE SUBSCRIPTION with RESOLVED DURATION
      console.log("📝 [PAYMENT COMPLETION] Creating subscription with duration:", packageDuration);
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + packageDuration); // ✅ USE RESOLVED DURATION

      console.log("📅 [SUBSCRIPTION] Date calculation:", {
        startDate: now.toISOString(),
        durationDays: packageDuration,
        endDate: endDate.toISOString(),
      });

      const subscriptionData = {
        status: "pending_approval",
        paymentStatus: "pending_approval",
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        // ✅ INCLUDE DURATION IN PACKAGE OBJECT
        package: {
          ...packageDetails,
          duration: packageDuration,
        },
        packageId: packageDetails.id,
        packageName: packageDetails.name,
        // ✅ SEPARATE DURATION FIELD
        duration: packageDuration,
        updatedAt: now.toISOString(),
        isFreeSubscription: amount === 0,
        obtainedVia: amount === 0 ? "promo_code_100_percent" : "payment",
        requiresApproval: true,
      };

      await db.ref(`employers/${userId}/subscription`).set(subscriptionData);
      console.log("✅ [PAYMENT COMPLETION] Subscription created with duration:", packageDuration, "days");

      // 5. Send payment confirmation email
      try {
        console.log("📧 [PAYMENT COMPLETION] Sending payment confirmation email...");

        const profileSnapshot = await db.ref(`employers/${userId}/profile`).once("value");
        const profile = profileSnapshot.exists() ?
          profileSnapshot.val() : {};

        const emailData = {
          orderId: orderId,
          paymentDate: now.toISOString(),
          currency: "USD",
          originalPrice: packageDetails.originalPrice ||
            packageDetails.price,
          finalPrice: packageDetails.finalPrice ||
            packageDetails.price,
          discount: packageDetails.discount || 0,
          promoCodeApplied: packageDetails.promoCodeApplied || false,
          promoCodeDetails: promoCodeDetails || null,
          isFreeSubscription: amount === 0,
          packageDetails: {
            name: packageDetails.name,
            id: packageDetails.id,
            duration: packageDuration, // ✅ USE RESOLVED DURATION
            jobPostLimit: packageDetails.jobPostLimit,
            features: packageDetails.features || {},
          },
          employerDetails: {
            id: userId,
            email: userDetails?.email || request.auth.token.email,
            firstName: profile.firstName || "",
            lastName: profile.lastName || "",
            companyName: profile.companyName || "",
            phone: profile.phone || "",
          },
        };

        await sendPaymentConfirmationEmail(emailData, request);
        console.log("✅ [PAYMENT COMPLETION] Payment confirmation email sent");
      } catch (emailError) {
        console.error("❌ [PAYMENT COMPLETION] Confirmation email failed:", emailError);
        await db.ref(`notification_errors/${orderId}_confirmation`).set({
          error: emailError.message,
          timestamp: now.toISOString(),
          type: "payment_confirmation_email",
          userId: userId,
        });
      }

      // 6. Send admin notification about pending payment
      // 6. Send admin notification about pending payment
      try {
        console.log("📬 [PAYMENT COMPLETION] Sending admin notification...");

        const adminNotificationData = {
          paymentId: orderId,
          amount: parseFloat(amount),
          packageName: packageDetails.name,
          employerEmail: userDetails?.email ||
           request.auth.token.email,
          timestamp: now.toISOString(),
        };

        await sendAdminNotification(adminNotificationData, request);
        console.log("✅ [PAYMENT COMPLETION] Admin notification sent");
      } catch (notificationError) {
        console.error("❌ [PAYMENT COMPLETION] Admin notification failed:", notificationError);
        await db.ref(`notification_errors/${orderId}_admin`).set({
          error: notificationError.message,
          timestamp: now.toISOString(),
          type: "admin_notification",
          userId: userId,
        });
      }

      console.log("🚀 [PAYMENT COMPLETION] Payment submitted for admin approval with duration:", packageDuration);

      return {
        success: true,
        orderId: orderId,
        invoiceNumber: invoiceNumber,
        amount: amount,
        packageDetails: {
          ...packageDetails,
          duration: packageDuration, // ✅ RETURN RESOLVED DURATION
        },
        resolvedDuration: packageDuration, // ✅ EXPLICIT DURATION FIELD
        isFreeSubscription: amount === 0,
        requiresApproval: true,
        message: `Payment submitted successfully - pending admin approval (${packageDuration} days)`,
      };
    } catch (error) {
      console.error("❌ [PAYMENT COMPLETION] Error:", error);

      // Log error to database
      try {
        const db = getDatabase();
        await db.ref(`payment_errors/${request.data.orderId || "unknown"}`).set({
          error: error.message,
          errorStack: error.stack,
          timestamp: new Date().toISOString(),
          userId: request.auth.uid,
          functionName: "handlePaymentCompletion",
          requestData: request.data,
        });
      } catch (loggingError) {
        console.error("Failed to log error:", loggingError);
      }

      throw new HttpsError(
        "internal",
        `Payment processing failed: ${error.message}`,
      );
    }
  },
);

/**
 * UPDATED: Payment admin notification to include pending payments
 */
export const notifyPaymentAdmin = onCall(
  functionConfig,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }

    const notificationData = {
      ...request.data,
      requiresApproval: request.data.status === "pending" ||
        request.data.requiresApproval || false,
    };

    return await sendPaymentApprovalToAdmin(notificationData,
      request);
  },
);

/**
 * Utility function to clean up orphaned auth users
 * Can be scheduled or manually triggered
 */
export const
  cleanupOrphanedAuthUsers =
    onCall(functionConfig, async (request) => {
      // Check if the caller is authenticated
      if (!request.auth) {
        throw new HttpsError(
          "permission-denied",
          "User must be authenticated to run cleanup operations.",
        );
      }

      try {
        console.log("Starting cleanup of orphaned auth users");

        // Get all auth users
        const listAllUsers = async (nextPageToken) => {
          const listUsersResult =
            await auth.listUsers(1000, nextPageToken);
          return {
            users: listUsersResult.users,
            pageToken: listUsersResult.pageToken,
          };
        };

        let authUsers = [];
        let pageToken = undefined;

        do {
          const result = await listAllUsers(pageToken);
          authUsers = [...authUsers, ...result.users];
          pageToken = result.pageToken;
        } while (pageToken);

        console.log(`Found ${authUsers.length} auth users`);

        // Get all database users
        const db = getDatabase();
        const employersSnapshot = await db.ref("employers").once("value");
        const candidatesSnapshot = await db.ref("candidates").once("value");

        const employersIds =
          employersSnapshot.exists() ?
            Object.keys(employersSnapshot.val()) : [];
        const candidatesIds =
          candidatesSnapshot.exists() ?
            Object.keys(candidatesSnapshot.val()) : [];

        const databaseUserIds = [...employersIds, ...candidatesIds];
        console.log(`Found ${databaseUserIds.length} database users`);

        // Find orphaned auth users (exist in auth but not in database)
        const orphanedUsers =
          authUsers.filter((user) =>
            !databaseUserIds.includes(user.uid));
        console.log(`Found ${orphanedUsers.length} orphaned auth users`);

        // Delete orphaned auth users
        const deletePromises = orphanedUsers.map(async (user) => {
          try {
            await auth.deleteUser(user.uid);
            return { success: true,
              uid: user.uid, email: user.email };
          } catch (error) {
            console.error(`Error deleting orphaned user ${user.uid}:`, error);
            return { success: false,
              uid: user.uid, email: user.email,
              error: error.message };
          }
        });

        const results = await Promise.all(deletePromises);

        const successCount = results.filter((r) => r.success).length;
        console.log(`Successfully deleted ${successCount} orphaned auth users`);

        return {
          success: true,
          totalAuthUsers: authUsers.length,
          totalDatabaseUsers: databaseUserIds.length,
          orphanedUsersFound: orphanedUsers.length,
          orphanedUsersDeleted: successCount,
          results,
        };
      } catch (error) {
        console.error(`Error in cleanupOrphanedAuthUsers function:`, error);
        throw new HttpsError("internal", error.message);
      }
    });

// ===== EXPRESS SERVER FOR REACT APP =====

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const expressApp = express(); // Using different variable name

// Security headers middleware
expressApp.use((req, res, next) => {
  // Set security headers
  res.set("X-Frame-Options", "DENY");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Set CSP header
  res.set("Content-Security-Policy",
    "default-src 'self' blob: https://*.firebasestorage.googleapis.com; " +
    "media-src 'self' blob: https://*.firebasestorage.googleapis.com; " +
    "frame-src 'self' https://*.firebaseio.com https://*.mastercard.com https://*.gateway.mastercard.com https://www.youtube.com https://youtube.com https://youtu.be; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.mastercard.com https://*.gateway.mastercard.com https://cdnjs.cloudflare.com https://*.firebaseio.com https://*.firebase.com https://*.googleapis.com https://www.googletagmanager.com; " +
    "img-src 'self' data: blob: https://*.mastercard.com https://*.gateway.mastercard.com https://*.firebasestorage.googleapis.com https://*.googleapis.com; " +
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://*.mastercard.com https://*.gateway.mastercard.com; " +
    "connect-src 'self' https://api.hiremeja.com https://*.mastercard.com https://*.gateway.mastercard.com wss://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://*.firebase.com https://*.cloudfunctions.net https://*.firebasestorage.googleapis.com https://firestore.googleapis.com https://www.google-analytics.com; " +
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "object-src 'none'; base-uri 'self'; " +
    "form-action 'self' https://*.mastercard.com https://*.gateway.mastercard.com; " +
    "worker-src 'none'; manifest-src 'self'; upgrade-insecure-requests;",
  );

  next();
});

// Serve static files with proper MIME types
expressApp.use("/static", express.static(path.join(__dirname, "../build/static"), {
  setHeaders: (res, path) => {
    if (path.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript");
    } else if (path.endsWith(".css")) {
      res.setHeader("Content-Type", "text/css");
    }
  },
}));

// Serve other static files
expressApp.use(express.static(path.join(__dirname, "../build")));

// Handle React routing
expressApp.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build/index.html"));
});

// Export the Express app as a Firebase Function
export const hosting = onRequest(expressApp);


