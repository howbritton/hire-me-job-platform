/**
 * Job Expiration Handler
 * @description Handles expired job cleanup and notifications
 */
import { getDatabase } from "firebase-admin/database";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import nodemailer from "nodemailer";

// Create transporter using same pattern as sendJobApprovalEmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "info@hiremeja.com",
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * Main job expiration checking and processing function
 * @return {Promise<Object>} Processing results with counts and details
 */
async function processExpiredJobs() {
  const db = getDatabase();
  const results = {
    processedJobs: 0,
    expiredJobs: 0,
    emailsSent: 0,
    emailErrors: 0,
    errors: [],
  };

  try {
    console.log("🔍 Starting job expiration check...");

    // Get all jobs organized by employer
    const jobsRef = db.ref("jobs");
    const jobsSnapshot = await jobsRef.once("value");
    const employersData = jobsSnapshot.val();

    if (!employersData) {
      console.log("⚠️ No jobs found in database");
      return results;
    }

    console.log(`📋 Found ${Object.keys(employersData).length} employers with jobs`);

    // Process each employer's jobs
    for (const [employerId, employerJobs] of
      Object.entries(employersData)) {
      if (!employerJobs || typeof employerJobs !== "object") continue;

      // ✅ FIX: Get subscription from employer's data
      const employerRef = db.ref(`employers/${employerId}`);
      const employerSnapshot = await employerRef.once("value");
      const employerData = employerSnapshot.val();
      const employerSubscription = employerData?.subscription;

      console.log(`👤 Processing employer ${employerId}: ${Object.keys(employerJobs).length} jobs`);

      for (const [jobId, jobData] of Object.entries(employerJobs)) {
        if (!jobData || typeof jobData !== "object") continue;

        results.processedJobs++;

        // Only process approved jobs
        if (jobData.status !== "approved") {
          console.log(`⏭️ Skipping job ${jobId} - status: ${jobData.status}`);
          continue;
        }

        // Check if job is expired
        const expiredInfo = checkJobExpiration(jobData,
          employerSubscription);

        console.log(`🔎 Job ${jobId} (${jobData.jobTitle || jobData.title}):`, {
          isExpired: expiredInfo.isExpired,
          reason: expiredInfo.reason,
          expirationDate: expiredInfo.expirationDate,
        });

        if (expiredInfo.isExpired) {
          try {
            console.log(`⚠️ Processing expired job: ${jobId}`);
            await moveJobToExpired(employerId,
              jobId, jobData, expiredInfo);

            const emailResult = await sendExpirationNotifications(
              employerId, jobData, employerData);

            results.expiredJobs++;
            results.emailsSent += emailResult.sent;
            results.emailErrors += emailResult.errors;

            console.log(`✅ Expired job ${jobId} processed successfully`);
          } catch (error) {
            console.error(`❌ Error processing expired job ${jobId}:`, error);
            results.errors.push({
              jobId,
              employerId,
              error: error.message,
              stack: error.stack,
            });
          }
        }
      }
    }

    console.log("✅ Job expiration check completed:", results);
    return results;
  } catch (error) {
    console.error("❌ Error in job expiration process:", error);
    results.errors.push({
      error: error.message,
      stack: error.stack,
    });
    return results;
  }
}

/**
 * Check if a job has expired based on various criteria
 * @param {Object} jobData - The job data object
 * @param {Object} employerSubscription - Employer subscription data
 * @return {Object} Expiration information
 */
function checkJobExpiration(jobData, employerSubscription) {
  const now = new Date();
  const result = {
    isExpired: false,
    reason: "",
    expirationDate: null,
  };

  // Check explicit job expiration date
  if (jobData.expirationDate) {
    const jobExpiry = new Date(jobData.expirationDate);
    if (now > jobExpiry) {
      result.isExpired = true;
      result.reason = "Job expiration date reached";
      result.expirationDate = jobExpiry;
      return result;
    }
  }

  // Check employer subscription expiry
  if (employerSubscription?.endDate) {
    const subscriptionExpiry = new Date(employerSubscription.endDate);
    if (now > subscriptionExpiry) {
      result.isExpired = true;
      result.reason = "Employer subscription expired";
      result.expirationDate = subscriptionExpiry;
      return result;
    }
  }

  // Default: 30 days from job creation
  if (jobData.createdAt) {
    const jobCreated = new Date(jobData.createdAt);
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const defaultExpiry = new Date(jobCreated.getTime() +
    thirtyDaysMs);
    if (now > defaultExpiry) {
      result.isExpired = true;
      result.reason = "30-day default expiration reached";
      result.expirationDate = defaultExpiry;
      return result;
    }
  }

  return result;
}

/**
 * Move expired job to expired-jobs node
 * @param {string} employerId - The employer ID
 * @param {string} jobId - The job ID
 * @param {Object} jobData - The job data
 * @param {Object} expiredInfo - Expiration information
 * @return {Promise<void>}
 */
async function moveJobToExpired(employerId,
  jobId, jobData, expiredInfo) {
  const db = getDatabase();

  // Add expiration metadata
  const expiredJobData = {
    ...jobData,
    expiredAt: new Date().toISOString(),
    expirationReason: expiredInfo.reason,
    originalExpirationDate: expiredInfo.expirationDate?.toISOString(),
    cleanupVersion: "2.0",
  };

  // Move to expired-jobs
  await db.ref(`expired-jobs/${employerId}/${jobId}`).set(expiredJobData);

  // Remove from active jobs
  await db.ref(`jobs/${employerId}/${jobId}`).remove();

  console.log(`Job ${jobId} expired and moved: ${expiredInfo.reason}`);
}

/**
 * Send expiration notifications to employer and admin
 * @param {string} employerId - The employer ID
 * @param {Object} jobData - The job data
 * @param {Object} employerData - The employer data (optional, will fetch if not provided)
 * @return {Promise<Object>} Result with sent and error counts
 */
async function sendExpirationNotifications(
  employerId, jobData, employerData = null) {
  const result = { sent: 0, errors: 0 };

  try {
    const db = getDatabase();

    // Get employer data if not provided
    if (!employerData) {
      const employerSnapshot = await db.ref(`employers/${employerId}`).once("value");
      employerData = employerSnapshot.val();
    }

    console.log(`📧 Sending expiration emails for job: ${jobData.jobTitle || jobData.title}`);

    // Send to employer if email exists
    if (employerData?.email) {
      console.log(`📤 Attempting to send email to employer: ${employerData.email}`);
      try {
        const mailResult = await transporter.sendMail({
          from: "\"HireMeJA\" <info@hiremeja.com>",
          to: employerData.email,
          subject: "Job Listing Expired - HireMeJA",
          text: createEmployerNotificationText(jobData),
          html: createEmployerNotificationEmail(jobData),
        });
        console.log(`✅ Expiration email sent to employer: ${employerData.email}`, {
          messageId: mailResult.messageId,
          response: mailResult.response,
        });
        result.sent++;
      } catch (error) {
        console.error(`❌ Failed to send employer notification to ${employerData.email}:`, {
          error: error.message,
          code: error.code,
          stack: error.stack,
        });
        result.errors++;
      }
    } else {
      console.warn(`⚠️ No email found for employer ${employerId}`);
    }

    // Get admin emails using same pattern as sendJobApprovalEmail
    const adminsRef = db.ref("admins");
    const adminsSnapshot = await adminsRef.once("value");
    const admins = adminsSnapshot.val();

    if (admins) {
      const adminEmails = Object.values(admins)
        .filter((admin) => admin.email)
        .map((admin) => admin.email);

      console.log(`📤 Sending to ${adminEmails.length} admin(s): ${adminEmails.join(", ")}`);

      // Send to all admin emails
      for (const adminEmail of adminEmails) {
        try {
          const mailResult = await transporter.sendMail({
            from: "\"HireMeJA\" <info@hiremeja.com>",
            to: adminEmail,
            subject: "Job Expired - Admin Notification",
            text: createAdminNotificationText(employerData, jobData),
            html: createAdminNotificationEmail(employerData, jobData),
          });
          console.log(`✅ Admin notification sent to: ${adminEmail}`, {
            messageId: mailResult.messageId,
          });
          result.sent++;
        } catch (error) {
          console.error(`❌ Failed to send admin notification to ${adminEmail}:`, {
            error: error.message,
            code: error.code,
          });
          result.errors++;
        }
      }
    } else {
      console.warn("⚠️ No admin emails found in database");
    }

    console.log(`📧 Email summary - Sent: ${result.sent}, Errors: ${result.errors}`);
    return result;
  } catch (error) {
    console.error("❌ Critical error sending expiration notifications:", error);
    result.errors++;
    return result;
  }
}

/**
 * Create employer notification email HTML
 * @param {Object} jobData - The job data object
 * @return {string} HTML email content
 */
function createEmployerNotificationEmail(jobData) {
  const jobTitle = jobData.jobTitle || jobData.title || "Untitled Job";
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const applicationsCount = jobData.applications ?
    Object.keys(jobData.applications).length : 0;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; 
                margin: 0 auto; padding: 20px; background: #f8f9fa;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); 
                  color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Job Listing Expired</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your job posting is no longer visible to candidates</p>
      </div>
      
      <!-- Content -->
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; 
                  box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        
        <div style="background: #fff3cd; border-left: 5px solid #ffc107; 
                    padding: 20px; margin-bottom: 25px; border-radius: 5px;">
          <h2 style="color: #856404; margin: 0 0 10px 0; font-size: 20px;">
            📋 Job Posting Update
          </h2>
          <p style="color: #856404; margin: 0; font-size: 16px;">
            Your job listing "<strong>${jobTitle}</strong>" has expired and is no longer visible to new candidates on our platform.
          </p>
        </div>
        
        <!-- What This Means Section -->
        <div style="margin: 25px 0;">
          <h3 style="color: #1e3a8a; margin-bottom: 15px; font-size: 18px; 
                     border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
            📢 What This Means:
          </h3>
          <ul style="margin: 0; padding-left: 20px; color: #333; line-height: 1.6;">
            <li style="margin-bottom: 8px;">Your job posting is <strong>no longer visible</strong> to candidates browsing our platform</li>
            <li style="margin-bottom: 8px;">New candidates <strong>cannot apply</strong> to this position</li>
            <li style="margin-bottom: 8px;">The job will not appear in search results</li>
          </ul>
        </div>
        
        <!-- What You Can Still Do Section -->
        <div style="background: #d1ecf1; border-left: 5px solid #17a2b8; 
                    padding: 20px; margin: 25px 0; border-radius: 5px;">
          <h3 style="color: #0c5460; margin: 0 0 15px 0; font-size: 18px;">
            ✅ What You Can Still Do:
          </h3>
          <ul style="margin: 0; padding-left: 20px; color: #0c5460; line-height: 1.6;">
            <li style="margin-bottom: 8px;">
              <strong>View all applications</strong> - Access and review all candidates who applied before expiration
            </li>
            <li style="margin-bottom: 8px;">
              <strong>Manage your favourites</strong> - Continue to view and contact candidates you've added to favourites
            </li>
            <li style="margin-bottom: 8px;">
              <strong>Download candidate data</strong> - Export applicant information for your records
            </li>
            <li style="margin-bottom: 8px;">
              <strong>Contact candidates</strong> - Reach out to applicants through the platform
            </li>
          </ul>
        </div>
        
        <!-- Action Buttons -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://hiremeja.com/employer/dashboard" 
             style="background: #1e3a8a; color: white; padding: 15px 25px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold; 
                    display: inline-block; margin: 5px;">
            📊 View Applications
          </a>
          
          <a href="https://hiremeja.com/employer/favourites" 
             style="background: #28a745; color: white; padding: 15px 25px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold; 
                    display: inline-block; margin: 5px;">
            ⭐ View Favourites
          </a>
        </div>
        
        <!-- Repost Option -->
        <div style="background: #f8f9fa; border: 1px solid #dee2e6; 
                    padding: 25px; margin: 25px 0; border-radius: 8px; text-align: center;">
          <h3 style="color: #495057; margin: 0 0 15px 0; font-size: 18px;">
            🔄 Want to Repost This Job?
          </h3>
          <p style="color: #6c757d; margin: 0 0 20px 0; font-size: 14px;">
            If you're still hiring for this position, you can easily create a new job posting to reach more candidates.
          </p>
          <a href="https://hiremeja.com/employer/post-job" 
             style="background: #007bff; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold; 
                    display: inline-block;">
            📝 Post New Job
          </a>
        </div>
        
        <!-- Job Details -->
        <div style="margin: 25px 0; padding: 20px; background: #f8f9fa; 
                    border-radius: 8px; border: 1px solid #e9ecef;">
          <h3 style="color: #495057; margin: 0 0 15px 0; font-size: 16px;">
            📋 Expired Job Details:
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #495057; width: 30%;">Job Title:</td>
              <td style="padding: 8px 0; color: #6c757d;">${jobTitle}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #495057;">Expired On:</td>
              <td style="padding: 8px 0; color: #6c757d;">${currentDate}</td>
            </tr>
            ${applicationsCount > 0 ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #495057;">Total Applications:</td>
              <td style="padding: 8px 0; color: #6c757d;">${applicationsCount}</td>
            </tr>
            ` : ""}
          </table>
        </div>
        
        <!-- Support Section -->
        <div style="text-align: center; margin: 30px 0; padding: 20px; 
                    background: #e9ecef; border-radius: 8px;">
          <h3 style="color: #495057; margin: 0 0 10px 0; font-size: 16px;">
            💬 Need Help?
          </h3>
          <p style="color: #6c757d; margin: 0 0 15px 0; font-size: 14px;">
            Our team is here to help you with your hiring needs.
          </p>
          <a href="mailto:info@hiremeja.com" 
             style="color: #007bff; text-decoration: none; font-weight: bold;">
            📧 Contact Support
          </a>
        </div>
        
        <p style="color: #6c757d; font-size: 14px; text-align: center; margin: 20px 0;">
          Thank you for using HireMeJA to find great talent!
        </p>
        
        <p style="color: #495057; font-weight: bold; text-align: center;">
          Best regards,<br>The HireMeJA Team
        </p>
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; color: #6c757d; font-size: 12px; 
                  margin-top: 20px; padding: 20px; background: #f8f9fa; 
                  border-top: 1px solid #dee2e6;">
        <p style="margin: 5px 0;">
          This is an automated notification. Please do not reply to this email.
        </p>
        <p style="margin: 5px 0;">
          © ${new Date().getFullYear()} HireMeJA. All rights reserved.
        </p>
        <p style="margin: 5px 0;">
          For support and inquiries: 
          <a href="mailto:info@hiremeja.com" style="color: #007bff;">info@hiremeja.com</a>
        </p>
      </div>
    </div>
  `;
}

/**
 * Create employer notification email text
 * @param {Object} jobData - The job data object
 * @return {string} Plain text email content
 */
function createEmployerNotificationText(jobData) {
  const jobTitle = jobData.jobTitle || jobData.title || "Untitled Job";
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const applicationsCount = jobData.applications ?
    Object.keys(jobData.applications).length : 0;

  return `JOB LISTING EXPIRED - Important Update

Hello,

Your job listing "${jobTitle}" has expired and is no longer visible to new candidates on our platform.

WHAT THIS MEANS:
• Your job posting is no longer visible to candidates browsing our platform
• New candidates cannot apply to this position
• The job will not appear in search results

WHAT YOU CAN STILL DO:
✅ View all applications - Access and review all candidates who applied before expiration
✅ Manage your favourites - Continue to view and contact candidates you've added to favourites
✅ Download candidate data - Export applicant information for your records
✅ Contact candidates - Reach out to applicants through the platform

EXPIRED JOB DETAILS:
Job Title: ${jobTitle}
Expired On: ${currentDate}${applicationsCount > 0 ? `\nTotal Applications: ${applicationsCount}` : ""}

ACCESS YOUR DATA:
• View Applications: https://hiremeja.com/employer/dashboard
• View Favourites: https://hiremeja.com/employer/favourites

STILL HIRING?
If you're still looking to fill this position, you can easily create a new job posting:
• Post New Job: https://hiremeja.com/employer/post-job

NEED HELP?
Our team is here to help you with your hiring needs.
Contact us at: info@hiremeja.com

Thank you for using HireMeJA to find great talent!

Best regards,
The HireMeJA Team

---
This is an automated notification. Please do not reply to this email.
© ${new Date().getFullYear()} HireMeJA. All rights reserved.
For support: info@hiremeja.com`;
}

/**
 * Create admin notification email HTML
 * @param {Object} employerData - The employer data object
 * @param {Object} jobData - The job data object
 * @return {string} HTML email content
 */
function createAdminNotificationEmail(employerData, jobData) {
  const jobTitle = jobData.jobTitle || jobData.title || "Untitled Job";
  const companyName = employerData?.companyName || jobData.companyName || "Unknown";
  const applicationsCount = jobData.applications ?
    Object.keys(jobData.applications).length : 0;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; 
                margin: 0 auto; padding: 20px;">
      <h2 style="color: #2c3e50;">Job Expired - Admin Notification</h2>
      <p><strong>Job Title:</strong> ${jobTitle}</p>
      <p><strong>Company:</strong> ${companyName}</p>
      <p><strong>Applications:</strong> ${applicationsCount}</p>
      <p><strong>Posted:</strong> ${jobData.createdAt || "Unknown"}</p>
      <p>This job has been moved to expired-jobs and removed from 
         active listings.</p>
      <p><a href="https://hiremeja.com/admin" 
            style="padding: 10px 20px; background-color: #1e3a8a; 
                   color: white; text-decoration: none; border-radius: 5px;">
         View Admin Dashboard
      </a></p>
    </div>
  `;
}

/**
 * Create admin notification email text
 * @param {Object} employerData - The employer data object
 * @param {Object} jobData - The job data object
 * @return {string} Plain text email content
 */
function createAdminNotificationText(employerData, jobData) {
  const jobTitle = jobData.jobTitle || jobData.title || "Untitled Job";
  const companyName = employerData?.companyName || jobData.companyName || "Unknown";
  const applicationsCount = jobData.applications ?
    Object.keys(jobData.applications).length : 0;

  return `Job Expired - Admin Notification

Job Title: ${jobTitle}
Company: ${companyName}
Applications: ${applicationsCount}
Posted: ${jobData.createdAt || "Unknown"}

This job has been moved to expired-jobs and removed from active listings.

View Admin Dashboard: https://hiremeja.com/admin`;
}

// Export functions for Firebase Functions
export const scheduledJobExpiration = onSchedule({
  schedule: "0 2 * * *", // Daily at 2 AM
  timeZone: "America/Jamaica",
  retryCount: 3,
  maxInstances: 1,
}, async (event) => {
  console.log("Starting scheduled job expiration check...");
  const results = await processExpiredJobs();
  console.log("Scheduled job expiration completed:", results);
  return results;
});

export const manualJobExpiration = onCall({
  enforceAppCheck: false,
}, async (request) => {
  // Simple admin check - you can enhance this
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  console.log("Starting manual job expiration check...");
  const results = await processExpiredJobs();
  console.log("Manual job expiration completed:", results);
  return results;
});
