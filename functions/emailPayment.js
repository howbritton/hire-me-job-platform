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

export const sendPaymentApprovalEmail = async (
  paymentData,
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
      `/employers/${paymentData.employerId}`,
    );
    const employerSnapshot = await employerRef.once("value");
    const employerData = employerSnapshot.val();

    if (!employerData) {
      throw new Error("Employer not found");
    }

    const email = employerData.profile?.email || employerData.email;

    if (!email) {
      throw new Error("Employer email not found");
    }

    const { subject, text, html } = createApprovalEmailContent(
      paymentData,
      employerData,
    );

    await transporter.sendMail({
      from: "\"HireMeJA\" <info@hiremeja.com>",
      to: email,
      subject,
      text,
      html,
    });

    console.log(`Payment approval email sent to ${email}`);
    return {
      success: true,
      message: `Payment approval notification sent to ${email}`,
    };
  } catch (error) {
    console.error("Error sending payment approval email:", error);
    throw new HttpsError(
      "internal",
      `Failed to send payment approval email: ${error.message}`,
    );
  }
};

export const sendPaymentRejectionEmail = async (
  paymentData,
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
      `/employers/${paymentData.employerId}`,
    );
    const employerSnapshot = await employerRef.once("value");
    const employerData = employerSnapshot.val();

    if (!employerData || !employerData.email) {
      throw new Error("Employer email not found");
    }

    const { subject, text, html } = createRejectionEmailContent(
      paymentData,
      employerData,
    );

    await transporter.sendMail({
      from: "\"HireMeJA\" <info@hiremeja.com>",
      to: employerData.email,
      subject,
      text,
      html,
    });

    console.log(
      `Payment rejection email sent to ${employerData.email}`,
    );
    return {
      success: true,
      message: `Payment rejection sent to ${employerData.email}`,
    };
  } catch (error) {
    console.error("Error sending payment rejection:", error);
    throw new HttpsError(
      "internal",
      `Failed to send payment rejection: ${error.message}`,
    );
  }
};

const createApprovalEmailContent = (paymentData, employerData) => {
  const subject = `Payment Approved - ${paymentData.packageName}`;
  const endDate = new Date(
    Date.now() +
    paymentData.packageDetails.duration * 24 * 60 * 60 * 1000,
  );

  const htmlContent = `
    <h1>Payment Approved</h1>
    
    <h2>Package Details:</h2>
    <ul>
      <li><strong>Package:</strong> ${paymentData.packageName}</li>
      <li><strong>Amount:</strong> $${paymentData.amount.toFixed(2)}</li>
      <li><strong>Duration:</strong> 
        ${paymentData.packageDetails.duration} days</li>
      <li><strong>Job Post Limit:</strong> 
        ${paymentData.packageDetails.jobPostLimit} posts</li>
    </ul>

    <h3>Subscription Information:</h3>
    <ul>
      <li><strong>Start Date:</strong> ${
  new Date().toLocaleDateString()
}</li>
      <li><strong>End Date:</strong> ${
  endDate.toLocaleDateString()
}</li>
    </ul>

    <p>Your subscription has been activated.</p>

    <p>
      <a href="https://hiremeja.com/employer/dashboard" 
         style="padding: 10px 20px;
                background-color: #1e3a8a;
                color: white;
                text-decoration: none;
                border-radius: 5px;">
        Go to Dashboard
      </a>
    </p>
  `;

  const text = `
Payment Approved

Package Details:
---------------
Package: ${paymentData.packageName}
Amount: $${paymentData.amount.toFixed(2)}
Duration: ${paymentData.packageDetails.duration} days
Job Post Limit: ${paymentData.packageDetails.jobPostLimit} posts

Subscription Information:
------------------------
Start Date: ${new Date().toLocaleDateString()}
End Date: ${endDate.toLocaleDateString()}

Your subscription has been activated.

Visit your dashboard: https://hiremeja.com/employer/dashboard
  `;

  return { subject, text, html: htmlContent };
};

const createRejectionEmailContent = (paymentData, employerData) => {
  const subject = `Payment Unsuccessful - ${paymentData.packageName}`;

  const htmlContent = `
    <h1>Payment Unsuccessful</h1>
    
    <h2>Payment Details:</h2>
    <ul>
      <li><strong>Package:</strong> ${paymentData.packageName}</li>
      <li><strong>Amount:</strong> $${paymentData.amount.toFixed(2)}</li>
    </ul>

    <p>
      Unfortunately, your payment for the ${paymentData.packageName} 
      package was unsuccessful. This could be due to:
    </p>
    
    <ul>
      <li>Insufficient funds</li>
      <li>Card verification failed</li>
      <li>Transaction declined by bank</li>
    </ul>

    <p>
      Please try again with a different payment method or contact your 
      bank for more information.
    </p>

    <p>
      <a href="https://hiremeja.com/employer/packages" 
         style="padding: 10px 20px;
                background-color: #1e3a8a;
                color: white;
                text-decoration: none;
                border-radius: 5px;">
        Try Again
      </a>
    </p>

    <p>
      Need help? Contact our support team at support@hiremeja.com
    </p>
  `;

  const text = `
Payment Unsuccessful

Payment Details:
---------------
Package: ${paymentData.packageName}
Amount: $${paymentData.amount.toFixed(2)}

Unfortunately, your payment was unsuccessful. 
This could be due to:

- Insufficient funds
- Card verification failed
- Transaction declined by bank

Please try again with a different payment method.

Visit: https://hiremeja.com/employer/packages

Need help? Contact support@hiremeja.com
  `;

  return { subject, text, html: htmlContent };
};
