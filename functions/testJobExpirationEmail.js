/**
 * Test Job Expiration Email
 * @description Manual test script to verify job expiration emails are working
 *
 * HOW TO USE:
 * 1. Deploy this function: firebase deploy --only functions:testJobExpirationEmail
 * 2. Call it from Firebase Console or using curl
 * 3. Check your email inbox for the expiration notification
 */

import { getDatabase } from "firebase-admin/database";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import nodemailer from "nodemailer";

/**
 * Manual test function to send job expiration email
 * This allows you to test the email without waiting for a job to actually expire
 */
export const testJobExpirationEmail = onCall({
  enforceAppCheck: false,
  cors: true,
}, async (request) => {
  try {
    console.log("🧪 Starting job expiration email test...");

    const { employerId, jobId, testEmail } = request.data;

    // Validate inputs
    if (!employerId || !jobId) {
      throw new HttpsError(
        "invalid-argument",
        "employerId and jobId are required. Optional: testEmail to override employer email",
      );
    }

    const db = getDatabase();

    // Get the job data
    const jobRef = db.ref(`jobs/${employerId}/${jobId}`);
    const jobSnapshot = await jobRef.once("value");

    if (!jobSnapshot.exists()) {
      throw new HttpsError(
        "not-found",
        `Job not found at jobs/${employerId}/${jobId}`,
      );
    }

    const jobData = jobSnapshot.val();
    console.log("📋 Found job:", jobData.jobTitle || jobData.title);

    // Get employer data
    const employerRef = db.ref(`employers/${employerId}`);
    const employerSnapshot = await employerRef.once("value");

    if (!employerSnapshot.exists()) {
      throw new HttpsError(
        "not-found",
        `Employer not found: ${employerId}`,
      );
    }

    const employerData = employerSnapshot.val();
    const employerEmail = testEmail || employerData.email;

    if (!employerEmail) {
      throw new HttpsError(
        "invalid-argument",
        "No email found for employer. Provide testEmail parameter.",
      );
    }

    console.log("📧 Sending test email to:", employerEmail);

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "info@hiremeja.com",
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Send the email using the same template as production
    await transporter.sendMail({
      from: "\"HireMeJA\" <info@hiremeja.com>",
      to: employerEmail,
      subject: "🧪 TEST: Job Listing Expired - HireMeJA",
      html: createTestEmployerNotificationEmail(jobData),
      text: createTestEmployerNotificationText(jobData),
    });

    console.log("✅ Test email sent successfully to:", employerEmail);

    return {
      success: true,
      message: "Test email sent successfully",
      sentTo: employerEmail,
      jobTitle: jobData.jobTitle || jobData.title,
      employerId: employerId,
      jobId: jobId,
    };
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw new HttpsError("internal", `Test failed: ${error.message}`);
  }
});

/**
 * Create test employer notification email HTML
 * @param {Object} jobData - Job data object containing job details
 * @return {string} HTML email template
 */
function createTestEmployerNotificationEmail(jobData) {
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

      <!-- TEST BANNER -->
      <div style="background: #ffc107; color: #000; padding: 15px; text-align: center;
                  border-radius: 5px; margin-bottom: 20px; border: 3px dashed #ff9800;">
        <h2 style="margin: 0; font-size: 20px;">🧪 THIS IS A TEST EMAIL 🧪</h2>
        <p style="margin: 5px 0 0 0; font-size: 14px;">
          This is how the job expiration email will look to employers
        </p>
      </div>

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
          © ${new Date().getFullYear()} HireMeJA. All rights reserved.
        </p>
      </div>
    </div>
  `;
}

/**
 * Create test employer notification email text
 * @param {Object} jobData - Job data object containing job details
 * @return {string} Plain text email template
 */
function createTestEmployerNotificationText(jobData) {
  const jobTitle = jobData.jobTitle || jobData.title || "Untitled Job";
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const applicationsCount = jobData.applications ?
    Object.keys(jobData.applications).length : 0;

  return `🧪 THIS IS A TEST EMAIL 🧪

JOB LISTING EXPIRED - Important Update

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

Thank you for using HireMeJA to find great talent!

Best regards,
The HireMeJA Team

---
© ${new Date().getFullYear()} HireMeJA. All rights reserved.`;
}
