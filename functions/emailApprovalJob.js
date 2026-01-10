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

export const sendJobApprovalEmail = async (jobData, context) => {
  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated",
    );
  }

  try {
    const db = getDatabase();
    const adminsRef = db.ref("admins");
    const adminsSnapshot = await adminsRef.once("value");
    const admins = adminsSnapshot.val();

    if (!admins) {
      throw new Error("No admin users found");
    }

    const adminEmails = Object.values(admins)
      .filter((admin) => admin.email)
      .map((admin) => admin.email);

    if (adminEmails.length === 0) {
      throw new Error("No admin email addresses found");
    }

    const { subject, text, html } = createEmailContent(jobData);

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

  const htmlStart = `
    <h1>New Job Submission Requires Approval</h1>
    <h2>Job Details:</h2>
    <ul>`;

  const jobDetails = [
    ["Title", jobData.jobTitle],
    ["Company", jobData.companyName],
    ["Location", jobData.parish],
    ["Industry", jobData.industry],
    ["Employment Type", jobData.employmentType],
    ["Work Type", jobData.workType],
  ]
    .map(([label, value]) =>
      `<li><strong>${label}:</strong> ${value}</li>`,
    )
    .join("\n");

  const htmlMiddle = `
    </ul>
    <h3>Description:</h3>
    <p>${jobData.description}</p>
    <h3>Requirements:</h3>
    <ul>`;

  const requirements = [
    ["Experience", jobData.experience],
    ["Education", jobData.degreeLevel],
    jobData.otherRequirements && [
      "Other Requirements",
      jobData.otherRequirements,
    ],
  ]
    .filter(Boolean)
    .map(([label, value]) =>
      `<li><strong>${label}:</strong> ${value}</li>`,
    )
    .join("\n");

  const htmlContact = `
    </ul>
    <h3>Contact Information:</h3>
    <ul>`;

  const contactInfo = [
    ["Email", jobData.applicationEmail],
    jobData.contactName && ["Contact Person", jobData.contactName],
    jobData.website && [
      "Website",
      `<a href="${jobData.website}">${jobData.website}</a>`,
    ],
  ]
    .filter(Boolean)
    .map(([label, value]) =>
      `<li><strong>${label}:</strong> ${value}</li>`,
    )
    .join("\n");

  const htmlEnd = `
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
    </p>`;

  const htmlContent = `${htmlStart}${jobDetails}${htmlMiddle}${requirements}${
    htmlContact}${contactInfo}${htmlEnd}`;

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
    `- Other Requirements:\n  ${jobData.otherRequirements}` :
    ""}

Contact Information:
-------------------
Email: ${jobData.applicationEmail}
${jobData.contactName ? `Contact Person: ${jobData.contactName}` : ""}
${jobData.website ? `Website: ${jobData.website}` : ""}

Review at: https://hiremeja.com/admin
`;

  return { subject, text, html: htmlContent };
};
