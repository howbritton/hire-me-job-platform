/**
 * Simple Admin Email Notification
 * @description Sends simple email notification to admin when payment is submitted
 */

import { HttpsError } from "firebase-functions/v2/https";
import nodemailer from "nodemailer";

/**
 * Send simple admin notification email
 * @param {Object} paymentData - Payment information
 * @param {Object} context - Firebase function context
 * @return {Promise<Object>} Result of email sending
 */
export const sendAdminNotification = async (paymentData, context) => {
  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated",
    );
  }

  try {
    console.log("📧 [ADMIN NOTIFICATION] Sending admin notification email");

    const transporter = nodemailer.createTransporter({
      service: "gmail",
      auth: {
        user: "info@hiremeja.com",
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const subject = `New Payment Awaiting Approval - ${paymentData.employerEmail}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #dc2626;">Payment Awaiting Admin Approval</h1>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2>Payment Details:</h2>
          <p><strong>Payment ID:</strong> ${paymentData.paymentId}</p>
          <p><strong>Amount:</strong> $${paymentData.amount.toFixed(2)}</p>
          <p><strong>Package:</strong> ${paymentData.packageName}</p>
          <p><strong>Employer Email:</strong> ${paymentData.employerEmail}</p>
          <p><strong>Date:</strong> ${new Date(paymentData.timestamp).toLocaleString()}</p>
        </div>

        <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #dc2626;">Action Required</h3>
          <p>A new payment has been submitted and requires your approval to activate the employer's subscription.</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://hiremeja.com/admin/payments" 
             style="background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Review Payment
          </a>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          This is an automated notification. Please do not reply to this email.
        </p>
      </div>
    `;

    const mailOptions = {
      from: "info@hiremeja.com",
      to: "info@hiremeja.com",
      cc: ["how.britton@gmail.com"],
      subject: subject,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions);

    console.log("✅ [ADMIN NOTIFICATION] Email sent successfully");
    return {
      success: true,
      message: "Admin notification email sent successfully",
    };
  } catch (error) {
    console.error("❌ [ADMIN NOTIFICATION] Error sending email:", error);
    throw new HttpsError(
      "internal",
      `Failed to send admin notification: ${error.message}`,
    );
  }
};
