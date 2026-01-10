/**
 * Test Profile Expiration Handler
 * @description Quick testing function for profile expiration (15 minutes)
 */

import { getDatabase } from "firebase-admin/database";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import nodemailer from "nodemailer";

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "info@hiremeja.com",
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Test constants - 15 minutes for testing
const TEST_PROFILE_DURATION_MINUTES = 15;
const TEST_NOTIFICATION_MINUTES_BEFORE = [10, 5, 2];

/**
 * Main test profile expiration processing function
 * @return {Promise<Object>} Processing results
 */
async function processTestProfileExpirations() {
  const db = getDatabase();
  const results = {
    processedProfiles: 0,
    expiredProfiles: 0,
    notificationsSent: 0,
    errors: [],
  };

  try {
    console.log("Starting TEST profile expiration check...");

    // Get all candidates
    const candidatesRef = db.ref("candidates");
    const candidatesSnapshot = await candidatesRef.once("value");
    const candidatesData = candidatesSnapshot.val();

    if (!candidatesData) {
      console.log("No candidates found in database");
      return results;
    }

    // Process each candidate profile
    for (const [candidateId, candidateData] of
      Object.entries(candidatesData)) {
      if (!candidateData || typeof candidateData !== "object") {
        continue;
      }

      results.processedProfiles++;

      try {
        // Check if profile needs expiration processing (TEST VERSION)
        const expirationInfo =
          checkTestProfileExpiration(candidateData);

        if (expirationInfo.shouldExpire) {
          await expireTestProfile(candidateId, candidateData,
            expirationInfo);
          results.expiredProfiles++;
          console.log(`TEST: Profile ${candidateId} expired after 15 minutes`);
        }

        // Send expiration warnings if needed (TEST VERSION)
        const warningInfo =
          checkTestExpirationWarnings(candidateData);
        if (warningInfo.shouldSendWarning) {
          await sendTestExpirationWarning(candidateId, candidateData,
            warningInfo);
          results.notificationsSent++;
          console.log(`TEST: Warning sent to ${candidateId} - ${
            warningInfo.minutesUntilExpiration} minutes left`);
        }
      } catch (error) {
        console.error(`Error processing TEST profile ${candidateId}:`,
          error);
        results.errors.push({
          candidateId,
          error: error.message,
        });
      }
    }

    console.log("TEST profile expiration check completed:", results);
    return results;
  } catch (error) {
    console.error("Error in TEST profile expiration process:", error);
    results.errors.push({ error: error.message });
    return results;
  }
}

/**
 * Check if a candidate profile should expire
 * (TEST VERSION - 15 minutes)
 * @param {Object} candidateData - The candidate data object
 * @return {Object} Expiration information
 */
function checkTestProfileExpiration(candidateData) {
  const now = new Date();
  const result = {
    shouldExpire: false,
    reason: "",
    expirationDate: null,
    lastActivity: null,
  };

  // Get the most recent activity date
  const lastActivity = getTestMostRecentActivity(candidateData);
  result.lastActivity = lastActivity;

  if (!lastActivity) {
    return result; // Skip if no activity found
  }

  // Calculate expiration date (15 minutes from last activity)
  const expirationDate = new Date(lastActivity);
  expirationDate.setMinutes(expirationDate.getMinutes() +
    TEST_PROFILE_DURATION_MINUTES);
  result.expirationDate = expirationDate;

  // Check if profile should be expired
  if (now > expirationDate && candidateData.profileStatus === "active") {
    result.shouldExpire = true;
    result.reason = "TEST: 15-minute expiration period reached";
  }

  return result;
}

/**
 * Get the most recent activity date for a candidate
 * (TEST VERSION)
 * @param {Object} candidateData - The candidate data object
 * @return {Date|null} Most recent activity date
 */
function getTestMostRecentActivity(candidateData) {
  const activityDates = [];

  // Profile creation
  if (candidateData.createdAt) {
    activityDates.push(new Date(candidateData.createdAt));
  }

  // Profile updates
  if (candidateData.updatedAt) {
    activityDates.push(new Date(candidateData.updatedAt));
  }

  // Return the most recent date
  return activityDates.length > 0 ?
    new Date(Math.max(...activityDates)) : null;
}

/**
 * Check if profile needs expiration warning notifications
 * (TEST VERSION)
 * @param {Object} candidateData - The candidate data object
 * @return {Object} Warning information
 */
function checkTestExpirationWarnings(candidateData) {
  const now = new Date();
  const result = {
    shouldSendWarning: false,
    minutesUntilExpiration: 0,
    warningType: "",
  };

  // Only send warnings for active profiles
  if (candidateData.profileStatus !== "active") {
    return result;
  }

  // Skip if notification already sent recently (within 2 minutes)
  if (candidateData.testExpirationNotificationSent &&
    candidateData.testExpirationNotificationSentAt) {
    const lastNotification =
      new Date(candidateData.testExpirationNotificationSentAt);
    const minutesSinceNotification =
      Math.floor((now - lastNotification) / (1000 * 60));
    if (minutesSinceNotification < 2) {
      return result; // Don't spam notifications
    }
  }

  const lastActivity = getTestMostRecentActivity(candidateData);
  if (!lastActivity) return result;

  const expirationDate = new Date(lastActivity);
  expirationDate.setMinutes(expirationDate.getMinutes() +
    TEST_PROFILE_DURATION_MINUTES);

  const minutesUntilExpiration =
    Math.ceil((expirationDate - now) / (1000 * 60));
  result.minutesUntilExpiration = minutesUntilExpiration;

  // Check if we should send a warning
  if (TEST_NOTIFICATION_MINUTES_BEFORE.includes(
    minutesUntilExpiration) && minutesUntilExpiration > 0) {
    result.shouldSendWarning = true;
    result.warningType =
      `TEST-${minutesUntilExpiration}-minute-warning`;
  }

  return result;
}

/**
 * Expire a candidate profile (TEST VERSION)
 * @param {string} candidateId - The candidate ID
 * @param {Object} candidateData - The candidate data
 * @param {Object} expirationInfo - Expiration information
 * @return {Promise<void>}
 */
async function expireTestProfile(candidateId, candidateData,
  expirationInfo) {
  const db = getDatabase();
  const now = new Date();

  const updates = {
    profileStatus: "expired",
    autoDeactivatedAt: now.toISOString(),
    expirationReason: expirationInfo.reason,
    testExpiration: true, // Mark as test expiration
    originalExpirationDate:
    expirationInfo.expirationDate.toISOString(),
    updatedAt: now.toISOString(),
    isPublic: false, // Hide from employers
  };

  await db.ref(`candidates/${candidateId}`).update(updates);

  // Send expiration notification
  await sendTestProfileExpirationNotification(candidateData, "expired");

  console.log(`TEST: Profile ${candidateId} expired: ${
    expirationInfo.reason}`);
}

/**
 * Send expiration warning notification (TEST VERSION)
 * @param {string} candidateId - The candidate ID
 * @param {Object} candidateData - The candidate data
 * @param {Object} warningInfo - Warning information
 * @return {Promise<void>}
 */
async function sendTestExpirationWarning(candidateId, candidateData,
  warningInfo) {
  const db = getDatabase();

  try {
    await sendTestProfileExpirationNotification(candidateData, "warning",
      warningInfo.minutesUntilExpiration);

    // Mark notification as sent
    const updates = {
      testExpirationNotificationSent: true,
      testExpirationNotificationSentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.ref(`candidates/${candidateId}`).update(updates);

    console.log(`TEST: Warning sent to candidate ${candidateId} (${
      warningInfo.minutesUntilExpiration} minutes)`);
  } catch (error) {
    console.error(`Error sending TEST warning to candidate ${
      candidateId}:`, error);
    throw error;
  }
}

/**
 * Send profile expiration notification email (TEST VERSION)
 * @param {Object} candidateData - The candidate data
 * @param {string} type - Type of notification ("warning" or "expired")
 * @param {number} minutesUntilExpiration - Minutes until expiration
 * @return {Promise<void>}
 */
async function sendTestProfileExpirationNotification(candidateData,
  type, minutesUntilExpiration = null) {
  if (!candidateData.email) {
    console.log("No email found for candidate, skipping TEST notification");
    return;
  }

  const candidateName = `${candidateData.firstName || ""} ${
    candidateData.lastName || ""}`.trim() || "Dear Candidate";

  let subject; let htmlContent; let textContent;

  if (type === "warning") {
    subject = `TEST: Your HireMeJA Profile Expires in ${
      minutesUntilExpiration} Minute${
      minutesUntilExpiration > 1 ? "s" : ""}`;
    htmlContent = createTestWarningEmailHTML(candidateName,
      minutesUntilExpiration);
    textContent = createTestWarningEmailText(candidateName,
      minutesUntilExpiration);
  } else if (type === "expired") {
    subject = "TEST: Your HireMeJA Profile Has Expired";
    htmlContent = createTestExpiredEmailHTML(candidateName);
    textContent = createTestExpiredEmailText(candidateName);
  }

  try {
    await transporter.sendMail({
      from: "HireMeJA <info@hiremeja.com>",
      to: candidateData.email,
      subject: subject,
      text: textContent,
      html: htmlContent,
    });

    console.log(`TEST ${type} notification sent to: ${candidateData.email}`);
  } catch (error) {
    console.error(`Failed to send TEST ${type} notification to ${
      candidateData.email}:`, error);
    throw error;
  }
}

/**
 * Create test warning email HTML content
 * @param {string} candidateName - The candidate's name
 * @param {number} minutesUntilExpiration - Minutes until expiration
 * @return {string} HTML email content
 */
function createTestWarningEmailHTML(candidateName,
  minutesUntilExpiration) {
  return `
    <h2>TEST: Profile Expiration Reminder</h2>
    <p>Hello ${candidateName},</p>
    <p><strong>THIS IS A TEST EMAIL</strong></p>
    <p>Your HireMeJA profile will expire in <strong>${
  minutesUntilExpiration} minute${
  minutesUntilExpiration > 1 ? "s" : ""}</strong>.</p>
    <p>This is a test of the 15-minute expiration system.</p>
    <p><a href="https://hiremeja.com/candidate/profile">Update My Profile</a></p>
    <p>Best regards,<br>The HireMeJA Test System</p>
  `;
}

/**
 * Create test warning email text content
 * @param {string} candidateName - The candidate's name
 * @param {number} minutesUntilExpiration - Minutes until expiration
 * @return {string} Plain text email content
 */
function createTestWarningEmailText(candidateName,
  minutesUntilExpiration) {
  return `TEST: Profile Expiration Reminder

Hello ${candidateName},

THIS IS A TEST EMAIL

Your HireMeJA profile will expire in ${minutesUntilExpiration} minute${
  minutesUntilExpiration > 1 ? "s" : ""}.

This is a test of the 15-minute expiration system.

Update your profile: https://hiremeja.com/candidate/profile

Best regards,
The HireMeJA Test System`;
}

/**
 * Create test expired email HTML content
 * @param {string} candidateName - The candidate's name
 * @return {string} HTML email content
 */
function createTestExpiredEmailHTML(candidateName) {
  return `
    <h2>TEST: Profile Expired</h2>
    <p>Hello ${candidateName},</p>
    <p><strong>THIS IS A TEST EMAIL</strong></p>
    <p>Your HireMeJA profile has expired after 15 minutes (test mode).</p>
    <p>This is a test of the expiration system.</p>
    <p><a href="https://hiremeja.com/candidate/profile">Reactivate My Profile</a></p>
    <p>Best regards,<br>The HireMeJA Test System</p>
  `;
}

/**
 * Create test expired email text content
 * @param {string} candidateName - The candidate's name
 * @return {string} Plain text email content
 */
function createTestExpiredEmailText(candidateName) {
  return `TEST: Profile Expired

Hello ${candidateName},

THIS IS A TEST EMAIL

Your HireMeJA profile has expired after 15 minutes (test mode).

This is a test of the expiration system.

Reactivate your profile: https://hiremeja.com/candidate/profile

Best regards,
The HireMeJA Test System`;
}

// Export test functions
export const testScheduledProfileExpiration = onSchedule({
  schedule: "*/2 * * * *", // Every 2 minutes for testing
  timeZone: "America/Jamaica",
  retryCount: 1,
  maxInstances: 1,
}, async (event) => {
  console.log("Starting TEST scheduled profile expiration check...");
  const results = await processTestProfileExpirations();
  console.log("TEST scheduled profile expiration completed:", results);
  return results;
});

export const testManualProfileExpiration = onCall({
  enforceAppCheck: false,
}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  console.log("Starting TEST manual profile expiration check...");
  const results = await processTestProfileExpirations();
  console.log("TEST manual profile expiration completed:", results);
  return results;
});

/**
 * Function to set up a candidate profile for immediate testing
 * Creates a profile that will expire in 15 minutes
 * @param {Object} request - Request object
 * @return {Promise<Object>} Setup result
 */
export const setupTestProfile = onCall({
  enforceAppCheck: false,
}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { candidateId } = request.data;
  if (!candidateId) {
    throw new HttpsError("invalid-argument", "candidateId is required");
  }

  const db = getDatabase();
  const now = new Date();

  try {
    // Set the candidate's last activity to now, so they expire in 15 minutes
    const updates = {
      updatedAt: now.toISOString(),
      profileStatus: "active",
      isPublic: true,
      testExpirationNotificationSent: false,
      testExpirationNotificationSentAt: null,
      testExpiration: false,
    };

    await db.ref(`candidates/${candidateId}`).update(updates);

    console.log(`TEST: Profile ${candidateId} 
        set up for 15-minute expiration test`);
    return {
      success: true,
      message: `Profile ${candidateId} will expire in 15 minutes`,
      expirationTime: new Date(now.getTime() +
      (15 * 60 * 1000)).toISOString(),
    };
  } catch (error) {
    console.error(`Error setting up test profile ${candidateId}:`, error);
    throw new HttpsError("internal", "Failed to setup test profile");
  }
});
