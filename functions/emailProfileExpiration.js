import { HttpsError } from "firebase-functions/v2/https";
import { getDatabase } from "firebase-admin/database";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "info@hiremeja.com",
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendProfileExpirationReminder =
  async (data, context) => {
    if (!context.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }

    try {
      const { userId, userRole, email } = data;

      if (!userId || !userRole || !email) {
        throw new HttpsError(
          "invalid-argument",
          "Missing required parameters (userId, userRole, email)",
        );
      }

      const db = getDatabase();
      const userRef = db.ref(`${userRole}s/${userId}`);
      const userSnapshot = await userRef.once("value");
      const userData = userSnapshot.val();

      if (!userData) {
        throw new HttpsError(
          "not-found",
          `User not found: ${userId}`,
        );
      }

      // Add email to userData if not present
      userData.email = email;

      // Set userType based on userRole if not present
      if (!userData.userType) {
        userData.userType = userRole;
      }

      // Check for lastUpdated timestamp, fall back to updatedAt, then to createdAt
      const lastUpdatedDate = userData.lastUpdated ||
      userData.updatedAt || userData.createdAt;

      if (!lastUpdatedDate) {
        throw new HttpsError(
          "failed-precondition",
          "User does not have any timestamp to calculate from",
        );
      }

      // Calculate days since last update
      const daysSinceUpdate = calculateDaysSinceDate(lastUpdatedDate);

      // Check if profile should be automatically set to inactive
      // If it's been more than 30 days since update and is currently active/public
      const shouldDeactivateProfile = daysSinceUpdate >= 30 &&
      userData.isPublic !== false;

      // Create appropriate notification based on days since update
      const { subject, text, html } = createEmailContent(userData,
        daysSinceUpdate, shouldDeactivateProfile);

      // Send email
      await transporter.sendMail({
        from: "\"HireMeJA\" <info@hiremeja.com>",
        to: email,
        subject,
        text,
        html,
      });

      console.log(`Profile update reminder sent to: ${email}`);

      // Update the user record to indicate that a notification was sent
      // If the profile should be deactivated, also set isPublic to false
      const updates = {
        updateNotificationSent: true,
        updateNotificationSentAt: new Date().toISOString(),
      };

      // If profile should be deactivated, add those changes to the updates
      if (shouldDeactivateProfile) {
        updates.isPublic = false;
        updates.autoDeactivatedAt = new Date().toISOString();

        // If the user is an employer, also deactivate their jobs
        if (userRole === "employer") {
          const jobsRef = db.ref(`jobs/${userId}`);
          const jobsSnapshot = await jobsRef.once("value");

          if (jobsSnapshot.exists()) {
            const jobUpdates = {};
            // Get all jobs for this employer and set them to inactive
            jobsSnapshot.forEach((jobSnap) => {
              const jobId = jobSnap.key;
              jobUpdates[`jobs/${userId}/${jobId}/status`] = "inactive";
            });

            // Apply all job status updates at once
            if (Object.keys(jobUpdates).length > 0) {
              await db.ref().update(jobUpdates);
              console.log(`Auto-deactivated ${Object.keys(jobUpdates).length} jobs for employer ${userId}`);
            }
          }
        }

        console.log(`Auto-deactivated profile for ${userRole} ${userId} due to inactivity`);
      }

      // Apply user profile updates
      await userRef.update(updates);

      return {
        success: true,
        message: `Update reminder sent to ${email}${shouldDeactivateProfile ? " and profile deactivated" : ""}`,
        deactivated: shouldDeactivateProfile,
      };
    } catch (error) {
      console.error("Error sending profile update notification:", error);
      throw new HttpsError(
        "internal",
        `Failed to send profile update notification: ${error.message}`,
      );
    }
  };

// New function to automatically check and deactivate profiles that haven't been updated in 30+ days
export const checkAndDeactivateInactiveProfiles = async (context) => {
  try {
    const db = getDatabase();
    const employersRef = db.ref("employers");
    const candidatesRef = db.ref("candidates");

    // Get the cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffTimestamp = cutoffDate.toISOString();

    // Process employers
    const deactivatedProfiles = {
      employers: 0,
      candidates: 0,
      jobs: 0,
    };

    // Function to process a batch of users
    const processUsers = async (usersRef, userType) => {
      // Get only active/public users
      const snapshot = await usersRef.orderByChild("isPublic").equalTo(true).once("value");

      if (!snapshot.exists()) {
        return;
      }

      const updates = {};
      const jobUpdates = {};

      snapshot.forEach((userSnap) => {
        const userId = userSnap.key;
        const userData = userSnap.val();

        // Get the last update timestamp
        const lastUpdated = userData.updatedAt || userData.createdAt;

        if (!lastUpdated || lastUpdated < cutoffTimestamp) {
          // User hasn't updated in 30+ days, deactivate profile
          updates[`${userType}s/${userId}/isPublic`] = false;
          updates[`${userType}s/${userId}/autoDeactivatedAt`] = new Date().toISOString();

          // If employer, also deactivate their jobs
          if (userType === "employer" && userData.jobs) {
            Object.keys(userData.jobs).forEach((jobId) => {
              jobUpdates[`jobs/${userId}/${jobId}/status`] = "inactive";
              deactivatedProfiles.jobs++;
            });
          }

          deactivatedProfiles[userType + "s"]++;
        }
      });

      // Apply all updates at once
      if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
      }

      // Apply job updates if any
      if (Object.keys(jobUpdates).length > 0) {
        await db.ref().update(jobUpdates);
      }
    };

    // Process both user types
    await processUsers(employersRef, "employer");
    await processUsers(candidatesRef, "candidate");

    console.log(`Auto-deactivation process completed. Deactivated: ${JSON.stringify(deactivatedProfiles)}`);

    return { success: true, deactivatedProfiles };
  } catch (error) {
    console.error("Error during automatic profile deactivation:", error);
    throw new Error(`Failed to run auto-deactivation: ${error.message}`);
  }
};

/**
 * Helper function to calculate days since a given date
 * @param {string} dateString The date string to calculate from
 * @return {number} Number of days since the date
 */
function calculateDaysSinceDate(dateString) {
  const pastDate = new Date(dateString);
  const currentDate = new Date();
  const timeDiff = currentDate.getTime() - pastDate.getTime();
  // Convert ms to days and round up
  const msInOneDay = 1000 * 3600 * 24;
  return Math.floor(timeDiff / msInOneDay);
}

/**
 * Create the email content for profile update reminder
 * @param {Object} userData The user data
 * @param {number} daysSinceUpdate Days since profile was last updated
 * @param {boolean} profileDeactivated Whether the profile has been deactivated
 * @return {Object} The email content object with subject, text, and html
 */
function createEmailContent(userData,
  daysSinceUpdate, profileDeactivated = false) {
  const { firstName, lastName, userType } = userData;
  const fullName = `${firstName || ""} ${lastName || ""}`.trim();
  const profileType = userType === "employer" ? "employer" : "candidate";
  const updateUrl = `https://hiremeja.com/${profileType}-sign-in`;

  let updateMessage;
  let subject;
  let deactivationMessage = "";

  // Default threshold for reminders is 30 days
  if (daysSinceUpdate >= 30) {
    subject = profileDeactivated ?
      `Your HireMeJA Profile Has Been Deactivated` :
      `Time to Update Your HireMeJA Profile`;

    updateMessage = `Your profile has not been updated in ${daysSinceUpdate} days.`;

    if (profileDeactivated) {
      deactivationMessage = `
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
        <p style="font-weight: bold; margin-top: 0; color: #b91c1c;">Important: Your profile has been automatically set to private due to inactivity.</p>
        <p style="margin-bottom: 0;">To make your profile visible again, please sign in, update your information, and set your profile to public.</p>
      </div>`;
    }
  } else {
    // This case shouldn't normally happen if the function is called correctly
    subject = `Keep Your HireMeJA Profile Up to Date`;
    updateMessage = `It's been ${daysSinceUpdate} days since you last updated your profile.`;
  }

  const actionText = profileDeactivated ?
    "Update your profile now to reactivate it and make it visible again" :
    "Update your profile now to improve your visibility and keep your information current";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1e3a8a; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Profile ${profileDeactivated ? "Deactivation" : "Update Reminder"}</h1>
      </div>
      
      <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none;">
        <p>Hello${fullName ? ` ${fullName}` : ""},</p>
        
        <p>This is an important message about your HireMeJA ${profileType} profile.</p>
        
        <div style="background-color: #f8f8f8; border-left: 4px solid #1e3a8a; padding: 15px; margin: 20px 0;">
          <p style="font-weight: bold; margin-top: 0;">${updateMessage}</p>
        </div>
        
        ${deactivationMessage}
        
        <p>Keeping your profile updated has several benefits:</p>
        <ul>
          ${userType === "employer" ?
    `<li>Attracts more qualified candidates to your job postings</li>
               <li>Improves your company's visibility in search results</li>
               <li>Shows candidates your company is actively hiring</li>` :
    `<li>Increases your visibility to potential employers</li>
               <li>Showcases your latest skills and achievements</li>
               <li>Improves your chances of finding the right job match</li>`}
        </ul>
        
        <p>${actionText}</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${updateUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #1e3a8a; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
            ${profileDeactivated ? "Reactivate My Profile" : "Update My Profile"}
          </a>
        </div>
        
        <p>If you have any questions or need assistance, please don't hesitate to contact our support team at <a href="mailto:info@hiremeja.com">info@hiremeja.com</a>.</p>
        
        <p>Thank you for using HireMeJA!</p>
        
        <p>Best regards,<br>The HireMeJA Team</p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>If you have any questions, please contact <a href="mailto:info@hiremeja.com">info@hiremeja.com</a></p>
        <p>&copy; ${new Date().getFullYear()} HireMeJA. All rights reserved.</p>
      </div>
    </div>
  `;

  const text = `
Profile ${profileDeactivated ? "Deactivation" : "Update Reminder"}

Hello${fullName ? ` ${fullName}` : ""},

This is an important message about your HireMeJA ${profileType} profile.

${updateMessage}

${profileDeactivated ? "IMPORTANT: Your profile has been automatically set to private due to inactivity. To make your profile visible again, please sign in, update your information, and set your profile to public." : ""}

Keeping your profile updated has several benefits:
${userType === "employer" ?
    `- Attracts more qualified candidates to your job postings
- Improves your company's visibility in search results
- Shows candidates your company is actively hiring` :
    `- Increases your visibility to potential employers
- Showcases your latest skills and achievements
- Improves your chances of finding the right job match`}

${actionText}

${profileDeactivated ? "Reactivate" : "Update"} your profile here: ${updateUrl}

If you have any questions or need assistance, please don't hesitate to contact our support team at info@hiremeja.com.

Thank you for using HireMeJA!

Best regards,
The HireMeJA Team

---
This is an automated message. Please do not reply to this email.
If you have any questions, please contact info@hiremeja.com
© ${new Date().getFullYear()} HireMeJA. All rights reserved.
`;

  return { subject, text, html };
}
