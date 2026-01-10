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

export const sendJobApprovalNotificationToEmployer =
async (jobData, context) => {
  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated",
    );
  }

  try {
    const db = getDatabase();

    // Get employer data to retrieve email
    const employerRef = db.ref(`employers/${jobData.employerId}`);
    const employerSnapshot = await employerRef.once("value");
    const employer = employerSnapshot.val();

    if (!employer || !employer.email) {
      throw new Error("Employer not found or email not available");
    }

    const { subject, text, html } =
        createEmailContent(jobData, employer.companyName);

    // Send email to employer
    await transporter.sendMail({
      from: "\"HireMeJA\" <info@hiremeja.com>",
      to: employer.email,
      subject,
      text,
      html,
    });

    console.log(`Job approval notification sent to employer: ${employer.email}`);

    return {
      success: true,
      message: `Job approval notification sent to ${employer.email}`,
    };
  } catch (error) {
    console.error("Error sending job approval notification:", error);
    throw new HttpsError(
      "internal",
      `Failed to send job approval notification: ${error.message}`,
    );
  }
};

const createEmailContent = (jobData, companyName) => {
  const subject = `Your Job Posting Has Been Approved: ${jobData.jobTitle}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1e3a8a; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Job Posting Approved</h1>
      </div>
      
      <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none;">
        
        <p>Congratulations! Your job posting <strong>"${jobData.jobTitle}"</strong> has been reviewed and approved by our team.</p>
        
        <h2 style="color: #1e3a8a; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">Job Details</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; font-weight: bold; width: 35%;">Job Title:</td>
            <td style="padding: 8px;">${jobData.jobTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Location:</td>
            <td style="padding: 8px;">${jobData.parish}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Employment Type:</td>
            <td style="padding: 8px;">${jobData.employmentType}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Date Posted:</td>
            <td style="padding: 8px;">${new Date(jobData.createdAt).toLocaleDateString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Date Approved:</td>
            <td style="padding: 8px;">${new Date(jobData.approvedAt).toLocaleDateString()}</td>
          </tr>
        </table>
        
        <p>Your job is now live on our platform and visible to all qualified candidates. You can view and manage your job postings from your employer dashboard.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://hiremeja.com/employer-sign-in" 
             style="display: inline-block; padding: 12px 24px; background-color: #1e3a8a; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
            View Your Jobs
          </a>
        </div>
        
        <p>If you need to make any changes to your job posting, you can edit it from your dashboard. Significant changes may require another review process.</p>
        
        <p>Thank you for using HireMeJA to find your next great hire!</p>
        
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
Job Posting Approved

Congratulations! Your job posting "${jobData.jobTitle}" has been reviewed and approved by our team.

Job Details:
------------
Job Title: ${jobData.jobTitle}
Location: ${jobData.parish}
Employment Type: ${jobData.employmentType}
Date Posted: ${new Date(jobData.createdAt).toLocaleDateString()}
Date Approved: ${new Date(jobData.approvedAt).toLocaleDateString()}

Your job is now live on our platform and visible to all qualified candidates. You can view and manage your job postings from your employer dashboard.

View Your Jobs: https://hiremeja.com/employer-sign-in

If you need to make any changes to your job posting, you can edit it from your dashboard. Significant changes may require another review process.

Thank you for using HireMeJA to find your next great hire!

Best regards,
The HireMeJA Team

---
This is an automated message. Please do not reply to this email.
If you have any questions, please contact info@hiremeja.com
© ${new Date().getFullYear()} HireMeJA. All rights reserved.
`;

  return { subject, text, html };
};
