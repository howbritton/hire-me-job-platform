import { HttpsError } from "firebase-functions/v2/https";
import { getDatabase } from "firebase-admin/database";
import nodemailer from "nodemailer";

// Create transporter outside the function for reuse
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "info@hiremeja.com",
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendApplicationStatusEmail = async (
  jobData,
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

    // Get admin users from the database
    const adminsRef = db.ref("admins");
    const adminsSnapshot = await adminsRef.once("value");
    const admins = adminsSnapshot.val();

    if (!admins) {
      throw new Error("No admin users found");
    }

    // Get all admin email addresses
    const adminEmails = Object.values(admins)
      .filter((admin) => admin.email)
      .map((admin) => admin.email);

    if (adminEmails.length === 0) {
      throw new Error("No admin email addresses found");
    }

    // Create email content once for all recipients
    const { subject, text, html } = createEmailContent(jobData);

    // Send email to all admin users
    const sendEmailPromises = adminEmails.map(async (adminEmail) => {
      try {
        await transporter.sendMail({
          from: "\"HireMeJA\" <info@hiremeja.com>",
          to: adminEmail,
          subject,
          text,
          html,
        });

        console.log(`Email sent successfully to ${adminEmail}`);
        return {
          email: adminEmail,
          success: true,
        };
      } catch (error) {
        console.error(
          `Failed to send email to ${adminEmail}:`,
          error,
        );
        return {
          email: adminEmail,
          success: false,
          error: error.message,
        };
      }
    });

    const results = await Promise.all(sendEmailPromises);
    const successCount = results.filter((r) => r.success).length;

    return {
      success: successCount > 0,
      message: `Notifications sent to ${successCount} admins`,
      notifiedEmails: successCount,
      results,
    };
  } catch (error) {
    console.error("Error sending notifications:", error);
    throw new HttpsError(
      "internal",
      `Failed to send notifications: ${error.message}`,
    );
  }
};

const createEmailContent = (jobData) => {
  const subject = `New Job Submission: ${jobData.jobTitle}`;

  const htmlContent = `
    <h1>New Job Submission Requires Approval</h1>
    
    <h2>Job Details:</h2>
    <ul>
      <li><strong>Title:</strong> ${jobData.jobTitle}</li>
      <li><strong>Company:</strong> ${jobData.companyName}</li>
      <li><strong>Location:</strong> ${jobData.parish}</li>
      <li><strong>Industry:</strong> ${jobData.industry}</li>
      <li><strong>Employment Type:</strong> ${
  jobData.employmentType
}</li>
      <li><strong>Work Type:</strong> ${jobData.workType}</li>
    </ul>

    <h3>Description:</h3>
    <p>${jobData.description}</p>

    <h3>Requirements:</h3>
    <ul>
      <li><strong>Experience:</strong> ${jobData.experience}</li>
      <li><strong>Education:</strong> ${jobData.degreeLevel}</li>
      ${jobData.otherRequirements ?
    `<li><strong>Other Requirements:</strong> ${
      jobData.otherRequirements
    }</li>` : ""}
    </ul>

    <h3>Contact Information:</h3>
    <ul>
      <li><strong>Email:</strong> ${jobData.applicationEmail}</li>
      ${jobData.contactName ?
    `<li><strong>Contact Person:</strong> 
         ${jobData.contactName}</li>` : ""}
      ${jobData.website ?
    `<li><strong>Website:</strong> <a href="${
      jobData.website
    }">${jobData.website}</a></li>` : ""}
    </ul>

    <p>
      <a href="https://hiremeja.com/admin/review-jobs" 
         style="padding: 10px 20px; 
                background-color: #1e3a8a; 
                color: white; 
                text-decoration: none; 
                border-radius: 5px;">
        Review Submission
      </a>
    </p>
  `;

  const text = `
New Job Submission Requires Approval

Job Details:
------------
Title: ${jobData.jobTitle}
Company: ${jobData.companyName}
Location: ${jobData.parish}
Industry: ${jobData.industry}
Employment Type: ${jobData.employmentType}
Work Type: ${jobData.workType}

Description:
${jobData.description}

Requirements:
- Experience: ${jobData.experience}
- Education: ${jobData.degreeLevel}
${jobData.otherRequirements ?
    `- Other Requirements: 
   ${jobData.otherRequirements}` : ""}

Contact Information:
-------------------
Email: ${jobData.applicationEmail}
${jobData.contactName ?
    `Contact Person: ${jobData.contactName}` : ""}
${jobData.website ?
    `Website: ${jobData.website}` : ""}

Please review this submission at: https://hiremeja.com/admin
  `;

  return { subject, text, html: htmlContent };
};
