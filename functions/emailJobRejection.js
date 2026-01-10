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

export const sendJobRejectionNotificationToEmployer =
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

    const { subject, text, html } = createEmailContent(jobData);

    // Send email to employer
    await transporter.sendMail({
      from: "\"HireMeJA\" <info@hiremeja.com>",
      to: employer.email,
      subject,
      text,
      html,
    });

    console.log(`Job rejection notification sent to employer: ${employer.email}`);

    return {
      success: true,
      message: `Job rejection notification sent to ${employer.email}`,
    };
  } catch (error) {
    console.error("Error sending job rejection notification:", error);
    throw new HttpsError(
      "internal",
      `Failed to send job rejection notification: ${error.message}`,
    );
  }
};

const createEmailContent = (jobData) => {
  const subject = `Your Job Posting: Action Required - ${jobData.jobTitle}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1e3a8a; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Job Posting Review Complete</h1>
      </div>
      
      <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none;">
        <p>Thank you for submitting your job posting <strong>"${jobData.jobTitle}"</strong> to HireMeJA.</p>
        
        <p>After careful review, we've determined that some adjustments are needed before your job can be published on our platform. Our team has some suggestions to help optimize your posting to better attract qualified candidates.</p>
        
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
            <td style="padding: 8px; font-weight: bold;">Date Submitted:</td>
            <td style="padding: 8px;">${new Date(jobData.createdAt).toLocaleDateString()}</td>
          </tr>
        </table>
        
        <div style="background-color: #f8f9fa; border-left: 4px solid #dc3545; padding: 15px; margin-bottom: 20px;">
          <p style="margin-top: 0; font-weight: bold;">Next Steps:</p>
          <p style="margin-bottom: 0;">Please log in to your employer dashboard to review and update your job posting. Once updated, you can resubmit it for approval.</p>
        </div>
        
        <p>Common reasons for job posting adjustments include:</p>
        <ul>
          <li>Incomplete or vague job description</li>
          <li>Missing key qualifications or requirements</li>
          <li>Inappropriate content or formatting issues</li>
          <li>Salary information missing or outside market norms</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://hiremeja.com/employer-sign-in" 
             style="display: inline-block; padding: 12px 24px; background-color: #1e3a8a; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Update Your Job Posting
          </a>
        </div>
        
        <p>If you have any questions or need guidance on improving your job posting, please don't hesitate to contact our support team.</p>
        
        <p>Thank you for choosing HireMeJA for your recruitment needs.</p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>If you have any questions, please contact <a href="mailto:info@hiremeja.com">info@hiremeja.com</a></p>
        <p>&copy; ${new Date().getFullYear()} HireMeJA. All rights reserved.</p>
      </div>
    </div>
  `;

  const text = `
Job Posting Review Complete

Thank you for submitting your job posting "${jobData.jobTitle}" to HireMeJA.

After careful review, we've determined that some adjustments are needed before your job can be published on our platform. Our team has some suggestions to help optimize your posting to better attract qualified candidates.

Job Details:
------------
Job Title: ${jobData.jobTitle}
Location: ${jobData.parish}
Employment Type: ${jobData.employmentType}
Date Submitted: ${new Date(jobData.createdAt).toLocaleDateString()}

Next Steps:
Please log in to your employer dashboard to review and update your job posting. Once updated, you can resubmit it for approval.

Common reasons for job posting adjustments include:
- Incomplete or vague job description
- Missing key qualifications or requirements
- Inappropriate content or formatting issues
- Salary information missing or outside market norms

Update Your Job Posting: https://hiremeja.com/employer-sign-in

If you have any questions or need guidance on improving your job posting, please don't hesitate to contact our support team.

Thank you for choosing HireMeJA for your recruitment needs.

---
This is an automated message. Please do not reply to this email.
If you have any questions, please contact info@hiremeja.com
© ${new Date().getFullYear()} HireMeJA. All rights reserved.
`;

  return { subject, text, html };
};
