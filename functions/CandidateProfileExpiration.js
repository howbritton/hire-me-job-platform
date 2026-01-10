/**
 * Candidate Profile Expiration Handler
 * @description Handles candidate profile expiration, reactivation, and
 * notifications
 */
import { getDatabase } from "firebase-admin/database";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import nodemailer from "nodemailer";

// Create transporter using same pattern as job expiration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "info@hiremeja.com",
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Constants
const PROFILE_DURATION_MONTHS = 3;
const NOTIFICATION_DAYS_BEFORE = [30, 7, 1]; // Send notifications

/**
 * Main candidate profile expiration processing function
 * @return {Promise<Object>} Processing results with counts and details
 */
async function processCandidateProfileExpirations() {
  const db = getDatabase();
  const results = {
    processedProfiles: 0,
    expiredProfiles: 0,
    reactivatedProfiles: 0,
    notificationsSent: 0,
    errors: [],
  };

  try {
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
      if (!candidateData || typeof candidateData !== "object") continue;

      results.processedProfiles++;

      try {
        // Check if profile needs expiration processing
        const expirationInfo = checkProfileExpiration(candidateData);

        if (expirationInfo.shouldExpire) {
          await expireProfile(candidateId, candidateData,
            expirationInfo);
          results.expiredProfiles++;
        } else if (expirationInfo.needsReactivation) {
          await reactivateProfile(candidateId, candidateData);
          results.reactivatedProfiles++;
        }

        // Send expiration warnings if needed
        const warningInfo = checkExpirationWarnings(candidateData);
        if (warningInfo.shouldSendWarning) {
          await sendExpirationWarning(candidateId, candidateData,
            warningInfo);
          results.notificationsSent++;
        }
      } catch (error) {
        console.error(`Error processing profile ${candidateId}:`, error);
        results.errors.push({
          candidateId,
          error: error.message,
        });
      }
    }

    console.log("Candidate profile expiration check completed:",
      results);
    return results;
  } catch (error) {
    console.error("Error in candidate profile expiration process:",
      error);
    results.errors.push({ error: error.message });
    return results;
  }
}

/**
 * Check if a candidate profile should expire based on activity
 * @param {Object} candidateData - The candidate data object
 * @return {Object} Expiration information
 */
function checkProfileExpiration(candidateData) {
  const now = new Date();
  const result = {
    shouldExpire: false,
    needsReactivation: false,
    reason: "",
    expirationDate: null,
    lastActivity: null,
  };

  // Get the most recent activity date
  const lastActivity = getMostRecentActivity(candidateData);
  result.lastActivity = lastActivity;

  if (!lastActivity) {
    // No activity found, use creation date or set to now
    const createdDate = candidateData.createdAt ?
      new Date(candidateData.createdAt) : now;
    result.lastActivity = createdDate;
  }

  // Calculate expiration date (3 months from last activity)
  const expirationDate = new Date(result.lastActivity);
  expirationDate.setMonth(expirationDate.getMonth() +
  PROFILE_DURATION_MONTHS);
  result.expirationDate = expirationDate;

  // Check if profile should be expired
  if (now > expirationDate && candidateData.profileStatus === "active") {
    result.shouldExpire = true;
    result.reason = "3-month expiration period reached";
  }

  // Check if expired profile should be reactivated
  // (if it has recent activity)
  if (candidateData.profileStatus !== "active" &&
    !candidateData.autoDeactivatedAt) {
    // Profile is inactive but wasn't auto-deactivated,
    // might need reactivation
    if (now <= expirationDate) {
      result.needsReactivation = true;
      result.reason = "Profile has valid expiration date and should be" +
        " active";
    }
  }

  return result;
}

/**
 * Get the most recent activity date for a candidate
 * @param {Object} candidateData - The candidate data object
 * @return {Date|null} Most recent activity date
 */
function getMostRecentActivity(candidateData) {
  const activityDates = [];

  // Profile creation
  if (candidateData.createdAt) {
    activityDates.push(new Date(candidateData.createdAt));
  }

  // Profile updates
  if (candidateData.updatedAt) {
    activityDates.push(new Date(candidateData.updatedAt));
  }

  // Profile section updates
  if (candidateData.profile?.updatedAt) {
    activityDates.push(new Date(candidateData.profile.updatedAt));
  }

  // Expiry date updates (manual profile updates)
  if (candidateData.expiryDate) {
    activityDates.push(new Date(candidateData.expiryDate));
  }

  // Job applications (recent activity)
  if (candidateData.applications) {
    Object.values(candidateData.applications)
      .forEach((application) => {
        if (application.appliedAt) {
          activityDates.push(new Date(application.appliedAt));
        }
      });
  }

  // Return the most recent date
  return activityDates.length > 0 ?
    new Date(Math.max(...activityDates)) : null;
}

/**
 * Check if profile needs expiration warning notifications
 * @param {Object} candidateData - The candidate data object
 * @return {Object} Warning information
 */
function checkExpirationWarnings(candidateData) {
  const now = new Date();
  const result = {
    shouldSendWarning: false,
    daysUntilExpiration: 0,
    warningType: "",
  };

  // Only send warnings for active profiles
  if (candidateData.profileStatus !== "active") {
    return result;
  }

  // Skip if notification already sent recently
  if (candidateData.expirationNotificationSent &&
    candidateData.expirationNotificationSentAt) {
    const lastNotification =
      new Date(candidateData.expirationNotificationSentAt);
    const daysSinceNotification =
      Math.floor((now - lastNotification) / (1000 * 60 * 60 * 24));
    if (daysSinceNotification < 7) {
      return result; // Don't spam notifications
    }
  }

  const lastActivity = getMostRecentActivity(candidateData);
  if (!lastActivity) return result;

  const expirationDate = new Date(lastActivity);
  expirationDate.setMonth(expirationDate.getMonth() +
    PROFILE_DURATION_MONTHS);

  const daysUntilExpiration =
    Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
  result.daysUntilExpiration = daysUntilExpiration;

  // Check if we should send a warning
  if (NOTIFICATION_DAYS_BEFORE.includes(daysUntilExpiration) &&
    daysUntilExpiration > 0) {
    result.shouldSendWarning = true;
    result.warningType = `${daysUntilExpiration}-day-warning`;
  }

  return result;
}

/**
 * Expire a candidate profile
 * @param {string} candidateId - The candidate ID
 * @param {Object} candidateData - The candidate data
 * @param {Object} expirationInfo - Expiration information
 * @return {Promise<void>}
 */
async function expireProfile(candidateId, candidateData,
  expirationInfo) {
  const db = getDatabase();
  const now = new Date();

  const updates = {
    profileStatus: "expired",
    autoDeactivatedAt: now.toISOString(),
    expirationReason: expirationInfo.reason,
    originalExpirationDate:
    expirationInfo.expirationDate.toISOString(),
    updatedAt: now.toISOString(),
    isPublic: false, // Hide from employers
  };

  await db.ref(`candidates/${candidateId}`).update(updates);

  // Send expiration notification
  await sendProfileExpirationNotification(candidateData, "expired");

  console.log(`Profile ${candidateId} expired: ${expirationInfo.reason}`);
}

/**
 * Reactivate a candidate profile
 * @param {string} candidateId - The candidate ID
 * @param {Object} candidateData - The candidate data
 * @return {Promise<void>}
 */
async function reactivateProfile(candidateId, candidateData) {
  const db = getDatabase();
  const now = new Date();

  // Calculate new expiration date (3 months from now)
  const newExpirationDate = new Date();
  newExpirationDate.setMonth(newExpirationDate.getMonth() +
    PROFILE_DURATION_MONTHS);

  const updates = {
    profileStatus: "active",
    isPublic: true, // Make visible to employers
    autoDeactivatedAt: null,
    expirationReason: null,
    expirationDate: newExpirationDate.toISOString(),
    expirationNotificationSent: false,
    expirationNotificationSentAt: null,
    updatedAt: now.toISOString(),
  };

  await db.ref(`candidates/${candidateId}`).update(updates);

  console.log(`Profile ${candidateId} reactivated with expiration: ${
    newExpirationDate.toISOString()}`);
}

/**
 * Send expiration warning notification
 * @param {string} candidateId - The candidate ID
 * @param {Object} candidateData - The candidate data
 * @param {Object} warningInfo - Warning information
 * @return {Promise<void>}
 */
async function sendExpirationWarning(candidateId, candidateData,
  warningInfo) {
  const db = getDatabase();

  try {
    await sendProfileExpirationNotification(candidateData, "warning",
      warningInfo.daysUntilExpiration);

    // Mark notification as sent
    const updates = {
      expirationNotificationSent: true,
      expirationNotificationSentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.ref(`candidates/${candidateId}`).update(updates);

    console.log(`Expiration warning sent to candidate ${candidateId} (${
      warningInfo.daysUntilExpiration} days)`);
  } catch (error) {
    console.error(`Error sending warning to candidate ${candidateId}:`,
      error);
    throw error;
  }
}

/**
 * Send profile expiration notification email
 * @param {Object} candidateData - The candidate data
 * @param {string} type - Type of notification ("warning" or "expired")
 * @param {number} daysUntilExpiration - Days until expiration (for warnings)
 * @return {Promise<void>}
 */
async function sendProfileExpirationNotification(candidateData, type,
  daysUntilExpiration = null) {
  if (!candidateData.email) {
    console.log("No email found for candidate, skipping notification");
    return;
  }

  const candidateName = `${candidateData.firstName || ""} ${
    candidateData.lastName || ""}`.trim() || "Dear Candidate";

  let subject; let htmlContent; let textContent;

  if (type === "warning") {
    subject = `Your HireMeJA Profile Expires in ${daysUntilExpiration} Day${
      daysUntilExpiration > 1 ? "s" : ""}`;
    htmlContent = createWarningEmailHTML(candidateName,
      daysUntilExpiration);
    textContent = createWarningEmailText(candidateName,
      daysUntilExpiration);
  } else if (type === "expired") {
    subject = "Your HireMeJA Profile Has Expired";
    htmlContent = createExpiredEmailHTML(candidateName);
    textContent = createExpiredEmailText(candidateName);
  }

  try {
    await transporter.sendMail({
      from: "\"HireMeJA\" <info@hiremeja.com>",
      to: candidateData.email,
      subject: subject,
      text: textContent,
      html: htmlContent,
    });

    console.log(`${type} notification sent to: ${candidateData.email}`);
  } catch (error) {
    console.error(`Failed to send ${type} notification to ${
      candidateData.email}:`, error);
    throw error;
  }
}

/**
 * Create warning email HTML content
 * @param {string} candidateName - The candidate's name
 * @param {number} daysUntilExpiration - Days until expiration
 * @return {string} HTML email content
 */
function createWarningEmailHTML(candidateName, daysUntilExpiration) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; 
                margin: 0 auto; padding: 20px;">
      <h2 style="color: #2c3e50;">Profile Expiration Reminder</h2>
      <p>Hello ${candidateName},</p>
      <p>Your HireMeJA profile will expire in <strong>${
  daysUntilExpiration} day${daysUntilExpiration > 1 ? "s" : ""}</strong>.</p>
      <p>To keep your profile active and continue receiving job 
         opportunities, please log in and update your profile 
         information.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://hiremeja.com/login" 
           style="background-color: #1e3a8a; color: white; 
                  padding: 12px 24px; text-decoration: none; 
                  border-radius: 5px; font-weight: bold;">
          Update My Profile
        </a>
      </div>
      <p><strong>What happens if my profile expires?</strong></p>
      <ul>
        <li>Your profile will be hidden from employers</li>
        <li>You won't receive new job alerts</li>
        <li>Employers won't be able to contact you</li>
      </ul>
      <p>Keep your profile active by updating any section of your 
         profile information.</p>
      <p>Best regards,<br>The HireMeJA Team</p>
    </div>
  `;
}

/**
 * Create warning email text content
 * @param {string} candidateName - The candidate's name
 * @param {number} daysUntilExpiration - Days until expiration
 * @return {string} Plain text email content
 */
function createWarningEmailText(candidateName, daysUntilExpiration) {
  return `Profile Expiration Reminder

Hello ${candidateName},

Your HireMeJA profile will expire in ${daysUntilExpiration} day${
  daysUntilExpiration > 1 ? "s" : ""}.

To keep your profile active and continue receiving job opportunities, 
please log in and update your profile information.

Update your profile: https://hiremeja.com/login

What happens if my profile expires?
- Your profile will be hidden from employers
- You won't receive new job alerts  
- Employers won't be able to contact you

Keep your profile active by updating any section of your profile 
information.

Best regards,
The HireMeJA Team`;
}

/**
 * Create expired email HTML content
 * @param {string} candidateName - The candidate's name
 * @return {string} HTML email content
 */
function createExpiredEmailHTML(candidateName) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; 
                margin: 0 auto; padding: 20px;">
      <h2 style="color: #dc2626;">Profile Expired</h2>
      <p>Hello ${candidateName},</p>
      <p>Your HireMeJA profile has expired and is no longer visible to 
         employers.</p>
      <p>To reactivate your profile and continue receiving job 
         opportunities, please log in and update your profile 
         information.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://hiremeja.com/login" 
           style="background-color: #dc2626; color: white; 
                  padding: 12px 24px; text-decoration: none; 
                  border-radius: 5px; font-weight: bold;">
          Reactivate My Profile
        </a>
      </div>
      <p>Once you update any section of your profile, it will be 
         automatically reactivated and visible to employers for 
         another 3 months.</p>
      <p>Don't miss out on job opportunities - reactivate your profile 
         today!</p>
      <p>Best regards,<br>The HireMeJA Team</p>
    </div>
  `;
}

/**
 * Create expired email text content
 * @param {string} candidateName - The candidate's name
 * @return {string} Plain text email content
 */
function createExpiredEmailText(candidateName) {
  return `Profile Expired

Hello ${candidateName},

Your HireMeJA profile has expired and is no longer visible to 
employers.

To reactivate your profile and continue receiving job opportunities, 
please log in and update your profile information.

Reactivate your profile: https://hiremeja.com/login

Once you update any section of your profile, it will be automatically 
reactivated and visible to employers for another 3 months.

Don't miss out on job opportunities - reactivate your profile today!

Best regards,
The HireMeJA Team`;
}

/**
 * One-time function to reactivate all existing profiles for soft launch
 * @return {Promise<Object>} Processing results
 */
async function bulkReactivateProfiles() {
  const db = getDatabase();
  const results = {
    processedProfiles: 0,
    reactivatedProfiles: 0,
    errors: [],
  };

  try {
    const candidatesRef = db.ref("candidates");
    const candidatesSnapshot = await candidatesRef.once("value");
    const candidatesData = candidatesSnapshot.val();

    if (!candidatesData) {
      console.log("No candidates found for bulk reactivation");
      return results;
    }

    const now = new Date();
    const newExpirationDate = new Date();
    newExpirationDate.setMonth(newExpirationDate.getMonth() +
    PROFILE_DURATION_MONTHS);

    for (const [candidateId, candidateData] of
      Object.entries(candidatesData)) {
      if (!candidateData || typeof candidateData !== "object") continue;

      results.processedProfiles++;

      try {
        // Reactivate all profiles regardless of current status
        const updates = {
          profileStatus: "active",
          isPublic: true,
          autoDeactivatedAt: null,
          expirationReason: null,
          expirationDate: newExpirationDate.toISOString(),
          expirationNotificationSent: false,
          expirationNotificationSentAt: null,
          updatedAt: now.toISOString(),
        };

        await db.ref(`candidates/${candidateId}`).update(updates);
        results.reactivatedProfiles++;

        console.log(`Profile ${candidateId} bulk reactivated`);
      } catch (error) {
        console.error(`Error bulk reactivating profile ${candidateId}:`, error);
        results.errors.push({
          candidateId,
          error: error.message,
        });
      }
    }

    console.log("Bulk profile reactivation completed:", results);
    return results;
  } catch (error) {
    console.error("Error in bulk profile reactivation:", error);
    results.errors.push({ error: error.message });
    return results;
  }
}

// Export functions for Firebase Functions
export const scheduledProfileExpiration = onSchedule({
  schedule: "0 6 * * *", // Daily at 6 AM Jamaica time
  timeZone: "America/Jamaica",
  retryCount: 3,
  maxInstances: 1,
}, async (event) => {
  console.log("Starting scheduled candidate profile expiration check...");
  const results = await processCandidateProfileExpirations();
  console.log("Scheduled candidate profile expiration completed:", results);
  return results;
});

export const manualProfileExpiration = onCall({
  enforceAppCheck: false,
}, async (request) => {
  // Simple admin check
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  console.log("Starting manual candidate profile expiration check...");
  const results = await processCandidateProfileExpirations();
  console.log("Manual candidate profile expiration completed:", results);
  return results;
});

export const bulkProfileReactivation = onCall({
  enforceAppCheck: false,
}, async (request) => {
  // Admin check - enhance this based on your admin verification
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  console.log("Starting bulk profile reactivation for soft launch...");
  const results = await bulkReactivateProfiles();
  console.log("Bulk profile reactivation completed:", results);
  return results;
});
