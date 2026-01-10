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

export const sendCandidateApplicationEmail = async (
  applicationData,
  context,
) => {
  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated",
    );
  }

  try {
    const db = getDatabase();
    const employerRef = db.ref(
      `/employers/${applicationData.employerId}`,
    );
    const employerSnapshot = await employerRef.once("value");
    const employerData = employerSnapshot.val();

    if (!employerData?.email) {
      throw new Error("Employer email not found");
    }

    const { subject, text, html } = createCandidateApplicationEmail(
      applicationData,
    );

    await transporter.sendMail({
      from: "\"HireMeJA\" <info@hiremeja.com>",
      to: employerData.email,
      subject,
      text,
      html,
    });

    console.log(
      `Application notification sent to employer: ${employerData.email}`,
    );
    return {
      success: true,
      message: "Application notification sent to employer",
    };
  } catch (error) {
    console.error("Error sending application notification:", error);
    throw new HttpsError(
      "internal",
      `Failed to send application notification: ${error.message}`,
    );
  }
};

const createCandidateApplicationEmail = (applicationData) => {
  const subject = `New Application Received - ${applicationData.jobTitle}`;
  const applicationUrl = `https://hiremeja.com/employer-sign-in?redirect=/employer/applications`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1e3a8a; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">New Job Application</h1>
      </div>
      
      <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none;">
        <p>You have received a new application for your job posting <strong>"${applicationData.jobTitle}"</strong>.</p>
        
        <h2 style="color: #1e3a8a; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">Application Details</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; font-weight: bold; width: 35%;">Job Title:</td>
            <td style="padding: 8px;">${applicationData.jobTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Date Applied:</td>
            <td style="padding: 8px;">${new Date().toLocaleDateString()}</td>
          </tr>
        </table>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${applicationUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #1e3a8a; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Review Application
          </a>
        </div>
        
        <p>You can view all applications and manage your hiring process through your employer dashboard.</p>
        
        <p>Thank you for using HireMeJA to find your next great hire!</p>
        
        <p>Best Regards,<br>The HireMeJA Team</p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>If you have any questions, please contact <a href="mailto:info@hiremeja.com" style="color: #1e3a8a; text-decoration: underline;">info@hiremeja.com</a></p>
        <p>&copy; ${new Date().getFullYear()} HireMeJA. All rights reserved.</p>
      </div>
    </div>
  `;

  const text = `
New Job Application

You have received a new application for your job posting "${applicationData.jobTitle}".

Application Details:
------------------
Job Title: ${applicationData.jobTitle}
Date Applied: ${new Date().toLocaleDateString()}

Review application at: ${applicationUrl}

Thank you for using HireMeJA to find your next great hire!

Best Regards,
The HireMeJA Team

---
This is an automated message. Please do not reply to this email.
If you have any questions, please contact info@hiremeja.com
© ${new Date().getFullYear()} HireMeJA. All rights reserved.
`;

  return { subject, text, html };
};
