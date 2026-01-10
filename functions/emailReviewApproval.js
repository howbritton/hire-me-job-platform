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

export const sendReviewApprovalToAdmin = async (
  reviewData,
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

    const {
      subject,
      text,
      html,
    } = createReviewApprovalEmail(reviewData);

    const sendPromises = adminEmails.map((email) =>
      transporter.sendMail({
        from: "\"HireMeJA\" <info@hiremeja.com>",
        to: email,
        subject,
        text,
        html,
      }),
    );

    await Promise.all(sendPromises);

    const message = `Review notices sent to ${adminEmails.length} admins`;
    console.log(message);
    return { success: true, message };
  } catch (error) {
    console.error("Error sending review notifications:", error);
    throw new HttpsError(
      "internal",
      `Failed to send review notices: ${error.message}`,
    );
  }
};

const createReviewApprovalEmail = (reviewData) => {
  const subject = `New Review Pending - ${reviewData.companyName}`;

  const reviewDetails = [
    ["Company", reviewData.companyName],
    ["Rating", `${reviewData.rating}/5`],
    ["Reviewer", reviewData.reviewerName],
    ["Submission Date", new Date().toLocaleDateString()],
    ["Review ID", reviewData.reviewId],
  ]
    .map(([label, value]) =>
      `<li><strong>${label}:</strong> ${value}</li>`,
    )
    .join("\n");

  const categories = [
    ["Work-Life Balance", reviewData.workLifeBalance],
    ["Compensation", reviewData.compensation],
    ["Career Growth", reviewData.careerGrowth],
    ["Management", reviewData.management],
  ]
    .map(([label, value]) =>
      `<li><strong>${label}:</strong> ${value}/5</li>`,
    )
    .join("\n");

  const reviewContent = `
   <div style="background-color: #f8f9fa;
               padding: 15px;
               border-radius: 5px;">
     <p>${reviewData.content}</p>
   </div>
 `;

  const prosSection = reviewData.pros ?
    `
   <h4>Pros:</h4>
   <p>${reviewData.pros}</p>
   ` :
    "";

  const consSection = reviewData.cons ?
    `
   <h4>Cons:</h4>
   <p>${reviewData.cons}</p>
   ` :
    "";

  const actionButtons = `
   <div style="margin-top: 20px;">
     <p>
       <a href="https://hiremeja.com/admin/reviews/${
  reviewData.reviewId
}/approve"
          style="padding: 10px 20px;
                 background-color: #16a34a;
                 color: white;
                 text-decoration: none;
                 border-radius: 5px;
                 margin-right: 10px;">
         Approve Review
       </a>
       <a href="https://hiremeja.com/admin/reviews/${
  reviewData.reviewId
}/reject"
          style="padding: 10px 20px;
                 background-color: #dc2626;
                 color: white;
                 text-decoration: none;
                 border-radius: 5px;">
         Reject Review
       </a>
     </p>
   </div>
 `;

  const htmlContent = `
   <h1>New Review Pending Approval</h1>
   
   <h2>Review Details:</h2>
   <ul>
     ${reviewDetails}
   </ul>

   <h3>Review Categories:</h3>
   <ul>
     ${categories}
   </ul>

   <h3>Review Content:</h3>
   ${reviewContent}
   ${prosSection}
   ${consSection}
   ${actionButtons}

   <p style="margin-top: 20px;
             font-size: 0.9em;
             color: #666;">
     View all pending reviews in the 
     <a href="https://hiremeja.com/admin/reviews">
       admin dashboard
     </a>.
   </p>
 `;

  const text = `
New Review Pending Approval

Review Details:
--------------
Company: ${reviewData.companyName}
Rating: ${reviewData.rating}/5
Reviewer: ${reviewData.reviewerName}
Submission Date: ${new Date().toLocaleDateString()}
Review ID: ${reviewData.reviewId}

Review Categories:
----------------
Work-Life Balance: ${reviewData.workLifeBalance}/5
Compensation: ${reviewData.compensation}/5
Career Growth: ${reviewData.careerGrowth}/5
Management: ${reviewData.management}/5

Review Content:
${reviewData.content}

${reviewData.pros ? `Pros:\n${reviewData.pros}\n` : ""}
${reviewData.cons ? `Cons:\n${reviewData.cons}\n` : ""}

Actions:
- Approve: https://hiremeja.com/admin/reviews/${
  reviewData.reviewId
}/approve
- Reject: https://hiremeja.com/admin/reviews/${
  reviewData.reviewId
}/reject

View pending reviews: https://hiremeja.com/admin/reviews
`;

  return { subject, text, html: htmlContent };
};
