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

export const sendPaymentConfirmationEmail = async (
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

    // Get employer data to retrieve additional details if needed
    const employerRef = db.ref(
      `employers/${paymentData.employerDetails.id}`,
    );
    const employerSnapshot = await employerRef.once("value");
    const employer = employerSnapshot.val() || {};

    // Get profile data for more complete employer details
    const profileRef = db.ref(
      `employers/${paymentData.employerDetails.id}/profile`,
    );
    const profileSnapshot = await profileRef.once("value");
    const profile = profileSnapshot.val() || {};

    // Build comprehensive employer data
    const employerData = {
      id: paymentData.employerDetails.id,
      email: paymentData.employerDetails.email,
      firstName: employer.firstName || "",
      lastName: employer.lastName || "",
      companyName: profile.companyName || "",
      phone: profile.phone || "",
    };

    const { subject, text, html } = createEmailContent(
      paymentData,
      employerData,
    );

    // Send email to employer
    await transporter.sendMail({
      from: "\"HireMeJA\" <info@hiremeja.com>",
      to: employerData.email,
      subject,
      text,
      html,
    });

    console.log(`Payment confirmation email sent to: ${employerData.email}`);

    return {
      success: true,
      message: `Payment confirmation email sent to ${employerData.email}`,
    };
  } catch (error) {
    console.error("Error sending payment confirmation email:", error);
    throw new HttpsError(
      "internal",
      `Failed to send payment confirmation email: ${error.message}`,
    );
  }
};

const createEmailContent = (paymentData, employerData) => {
  const subject = `Payment Confirmation - Order #${paymentData.orderId}`;
  const orderDate =
    new Date(paymentData.paymentDate).toLocaleDateString();
  const dashboardUrl = "https://hiremeja.com/employer/dashboard";

  // Format features list if available
  let featuresList = "";
  if (paymentData.packageDetails.features) {
    featuresList = Object.entries(paymentData.packageDetails.features)
      .filter(([_, enabled]) => enabled)
      .map(([feature, _]) => {
        // Convert camelCase to readable format
        const readableFeature = feature
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase());
        return `<li>${readableFeature}</li>`;
      })
      .join("");
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1e3a8a; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Payment Confirmation</h1>
      </div>
      
      <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none;">
        <p>Dear ${employerData.firstName || "Valued Customer"},</p>
        
        <p>Thank you for your payment. Your order has been received and is now being processed.</p>
        
        <h2 style="color: #1e3a8a; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">Order Details</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; font-weight: bold; width: 35%;">Order Number:</td>
            <td style="padding: 8px;">${paymentData.orderId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Date:</td>
            <td style="padding: 8px;">${orderDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Payment Method:</td>
            <td style="padding: 8px;">Credit/Debit Card</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Status:</td>
            <td style="padding: 8px;">
              <span style="color: #f59e0b; font-weight: bold;">Pending Approval</span>
            </td>
          </tr>
        </table>
        
        <h2 style="color: #1e3a8a; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">Package Details</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; font-weight: bold; width: 35%;">Package Name:</td>
            <td style="padding: 8px;">${paymentData.packageDetails.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Duration:</td>
            <td style="padding: 8px;">${paymentData.packageDetails.duration} Days</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Job Posts:</td>
            <td style="padding: 8px;">
              ${paymentData.packageDetails.jobPostLimit === -1 ? "Unlimited" : paymentData.packageDetails.jobPostLimit}
            </td>
          </tr>
        </table>
        
        ${featuresList ? `
        <h3 style="color: #1e3a8a;">Package Features</h3>
        <ul style="margin-bottom: 20px;">
          ${featuresList}
        </ul>
        ` : ""}
        
        <h2 style="color: #1e3a8a; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">Payment Summary</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; font-weight: bold; width: 35%;">Package Price:</td>
            <td style="padding: 8px;">${paymentData.currency} $${paymentData.originalPrice.toFixed(2)}</td>
          </tr>
          ${paymentData.isProratedPayment ? `
          <tr>
            <td style="padding: 8px; font-weight: bold;">Pro-rated Adjustment:</td>
            <td style="padding: 8px;">-${paymentData.currency} $${(paymentData.originalPrice - paymentData.finalPrice).toFixed(2)}</td>
          </tr>
          ` : ""}
          <tr style="border-top: 1px solid #e0e0e0;">
            <td style="padding: 8px; font-weight: bold;">Total:</td>
            <td style="padding: 8px; font-weight: bold;">${paymentData.currency} $${paymentData.finalPrice.toFixed(2)}</td>
          </tr>
        </table>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <p style="margin-top: 0;">
            <strong>Note:</strong> Your payment is currently pending approval. Once approved, your package will be activated, and you'll receive a confirmation email.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #1e3a8a; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
            View Your Dashboard
          </a>
        </div>
        
        <p>If you have any questions or need assistance, please contact our support team at <a href="mailto:info@hiremeja.com" style="color: #1e3a8a;">info@hiremeja.com</a>.</p>
        
        <p>Thank you for choosing HireMeJA for your recruitment needs.</p>
        
        <p>Best regards,<br>The HireMeJA Team</p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>HireMeJA - Making hiring easier and more efficient for businesses in Jamaica</p>
        <p>If you have any questions, please contact <a href="mailto:info@hiremeja.com" style="color: #1e3a8a;">info@hiremeja.com</a></p>
        <p>&copy; ${new Date().getFullYear()} HireMeJA. All rights reserved.</p>
      </div>
    </div>
  `;

  const text = `
Payment Confirmation - Order #${paymentData.orderId}

Dear ${employerData.firstName || "Valued Customer"},

Thank you for your payment. Your order has been received and is now being processed.

Order Details:
--------------
Order Number: ${paymentData.orderId}
Date: ${orderDate}
Payment Method: Credit/Debit Card
Status: Pending Approval

Package Details:
---------------
Package Name: ${paymentData.packageDetails.name}
Duration: ${paymentData.packageDetails.duration} Days
Job Posts: ${paymentData.packageDetails.jobPostLimit === -1 ? "Unlimited" : paymentData.packageDetails.jobPostLimit}

Payment Summary:
--------------
Package Price: ${paymentData.currency} $${paymentData.originalPrice.toFixed(2)}
${paymentData.isProratedPayment ? `Pro-rated Adjustment: -${paymentData.currency} $${(paymentData.originalPrice - paymentData.finalPrice).toFixed(2)}` : ""}
Total: ${paymentData.currency} $${paymentData.finalPrice.toFixed(2)}

Note: Your payment is currently pending approval. Once approved, your package will be activated, and you'll receive a confirmation email.

View Your Dashboard: ${dashboardUrl}

If you have any questions or need assistance, please contact our support team at info@hiremeja.com.

Thank you for choosing HireMeJA for your recruitment needs.

Best regards,
The HireMeJA Team

--
HireMeJA - Making hiring easier and more efficient for businesses in Jamaica
If you have any questions, please contact info@hiremeja.com
© ${new Date().getFullYear()} HireMeJA. All rights reserved.
  `;

  return { subject, text, html };
};
