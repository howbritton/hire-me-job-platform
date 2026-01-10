import { HttpsError } from "firebase-functions/v2/https";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "info@hiremeja.com",
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendPaymentConfirmationEmail = async (emailData,
  context) => {
  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated",
    );
  }

  try {
    const employerName = emailData.employerDetails?.firstName ?
      `${emailData.employerDetails.firstName} ${emailData.employerDetails.lastName || ""}`.trim() :
      "Valued Customer";

    const subject = `Payment Confirmation - Order #${emailData.orderId}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px;">
          <h1 style="margin: 0; font-size: 28px;">Payment Received</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Thank you for your payment</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; margin: 20px 0; border-radius: 10px; border-left: 5px solid #fbbf24;">
          <h2 style="color: #d97706; margin-top: 0;">Hello ${employerName}!</h2>
          <p>Your payment has been successfully received and is currently being reviewed by our admin team.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Payment Details:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0; font-weight: bold;">Order ID:</td>
                <td style="padding: 8px 0;">${emailData.orderId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0; font-weight: bold;">Package:</td>
                <td style="padding: 8px 0;">${emailData.packageDetails.name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0; font-weight: bold;">Amount:</td>
                <td style="padding: 8px 0;">$${emailData.finalPrice}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Status:</td>
                <td style="padding: 8px 0; color: #d97706; font-weight: bold;">PENDING APPROVAL</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #92400e;">What happens next?</h4>
            <ul style="margin-bottom: 0; color: #92400e;">
              <li>Our admin team will review your payment within 24 hours</li>
              <li>You'll receive an email notification once approved</li>
              <li>Your subscription will be activated immediately upon approval</li>
              <li>You can then start posting jobs and accessing all features</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://hiremeja.com/employer/profile" 
               style="background: #1e3a8a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              View Your Profile
            </a>
          </div>
          
          <p style="margin-bottom: 0; color: #666; font-size: 14px;">
            If you have any questions about your payment, please contact our support team.
          </p>
        </div>
        
        <div style="text-align: center; color: #666; font-size: 12px; margin-top: 30px;">
          <p>© 2025 HireMeJA. All rights reserved.</p>
          <p>Questions? Contact us at info@hiremeja.com</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: "\"HireMeJA\" <info@hiremeja.com>",
      to: emailData.employerDetails.email,
      subject: subject,
      html: html,
    });

    console.log(`Payment confirmation email sent to ${emailData.employerDetails.email}`);
    return {
      success: true,
      message: `Payment confirmation email sent to ${emailData.employerDetails.email}`,
    };
  } catch (error) {
    console.error("Error sending payment confirmation email:", error);
    throw new HttpsError("internal", `Failed to send confirmation email: ${error.message}`);
  }
};
