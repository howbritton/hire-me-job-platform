/**
 * Email notification function for payment approval requests to admins
 * Sends notifications to admins when employers submit payments
 * @module emailPaymentAdmin
 */

import nodemailer from "nodemailer";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Sends payment approval notification email to administrators
 * @param {Object} data - Payment notification data
 * @param {string} data.paymentId - Unique payment identifier
 * @param {number} data.amount - Payment amount
 * @param {string} data.currency - Payment currency (USD)
 * @param {string} data.packageId - Package identifier
 * @param {string} data.packageName - Package name
 * @param {Object} data.packageDetails - Package details object
 * @param {string} data.employerId - Employer user ID
 * @param {string} data.employerEmail - Employer email address
 * @param {string} data.timestamp - Payment timestamp
 * @param {string} data.paymentMethod - Payment method used
 * @param {boolean} data.isProratedPayment - Whether payment is prorated
 * @param {number} data.originalPrice - Original package price
 * @param {number} data.finalPrice - Final price after discounts
 * @param {boolean} data.promoCodeApplied - Whether promo code was applied
 * @param {Object} data.promoCodeDetails - Promo code details if applied
 * @param {string} data.status - Payment status
 * @param {boolean} data.isFreeSubscription - Whether it's a free subscription
 * @param {boolean} data.requiresApproval - Whether payment requires approval
 * @param {Object} request - Firebase function request object
 * @return {Promise<Object>} Success/failure result
 */
export const sendPaymentApprovalToAdmin = async (data, request) => {
  console.log("📧 [ADMIN NOTIFICATION] Starting payment approval notification");
  console.log("📧 [ADMIN NOTIFICATION] Data received:", {
    paymentId: data.paymentId,
    amount: data.amount,
    packageName: data.packageName,
    employerEmail: data.employerEmail,
    isFreeSubscription: data.isFreeSubscription,
    requiresApproval: data.requiresApproval,
  });

  try {
    // Validate required data
    if (!data.paymentId || !data.employerEmail ||
      data.amount === undefined) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: paymentId, employerEmail, and amount are required",
      );
    }

    // Configure Gmail transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER || "info@hiremeja.com",
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Verify transporter configuration
    await transporter.verify();
    console.log("✅ [ADMIN NOTIFICATION] Gmail transporter verified");

    // Admin email addresses
    const adminEmails = ["how.britton@gmail.com", "info@hiremeja.com"];

    // Format payment details
    const paymentAmount = parseFloat(data.amount);
    const isFreeSub = data.isFreeSubscription || paymentAmount === 0;
    const packageDuration = data.packageDetails?.duration || 30;
    const jobPostLimit = data.packageDetails?.jobPostLimit || 10;

    // Create email subject
    const subject = isFreeSub ?
      `🆓 Free Subscription Request - ${data.packageName}` :
      `💳 Payment Approval Required - $${paymentAmount.toFixed(2)} USD`;

    // Create comprehensive email body
    const emailBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
          <!-- Header -->
          <div style="background: ${isFreeSub ? "#f59e0b" : "#3b82f6"}; color: white; padding: 30px; text-align: center; border-radius: 10px; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">
              ${isFreeSub ? "🆓 FREE SUBSCRIPTION REQUEST" : "💳 PAYMENT APPROVAL REQUIRED"}
            </h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
              ${isFreeSub ? "Promo Code Applied - 100% Discount" : "New Payment Awaiting Review"}
            </p>
          </div>

          <!-- Alert Box -->
          <div style="background: ${isFreeSub ? "#fef3c7" : "#dbeafe"}; border-left: 5px solid ${isFreeSub ? "#f59e0b" : "#3b82f6"}; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
            <h3 style="margin-top: 0; color: ${isFreeSub ? "#92400e" : "#1e40af"};">
              ⏰ Action Required
            </h3>
            <p style="margin-bottom: 0; color: ${isFreeSub ? "#92400e" : "#1e40af"};">
              ${isFreeSub ?
    "An employer has requested a free subscription using a promo code. Please review and approve/decline this request." :
    "An employer has submitted a payment for subscription approval. Please review the payment details and approve/decline accordingly."
}
            </p>
          </div>

          <!-- Payment Details -->
          <div style="background: #f9fafb; padding: 25px; border-radius: 10px; margin-bottom: 30px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; margin-top: 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
              📄 Payment Details
            </h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: bold; width: 40%;">Payment ID:</td>
                <td style="padding: 12px 0; font-family: monospace; background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${data.paymentId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: bold;">Package:</td>
                <td style="padding: 12px 0;">${data.packageName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: bold;">Duration:</td>
                <td style="padding: 12px 0;">${packageDuration} days</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: bold;">Job Post Limit:</td>
                <td style="padding: 12px 0;">${jobPostLimit} jobs</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: bold;">Original Price:</td>
                <td style="padding: 12px 0;">$${(data.originalPrice || data.amount).toFixed(2)} USD</td>
              </tr>
              ${data.promoCodeApplied ? `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: bold;">Promo Code:</td>
                <td style="padding: 12px 0; color: #059669;">
                  ${data.promoCodeDetails?.code || "Applied"} 
                  (${data.promoCodeDetails?.discountPercentage || 100}% off)
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: bold;">Discount:</td>
                <td style="padding: 12px 0; color: #059669;">-$${((data.originalPrice || data.amount) - paymentAmount).toFixed(2)} USD</td>
              </tr>
              ` : ""}
              <tr style="border-bottom: 3px solid #3b82f6;">
                <td style="padding: 12px 0; font-weight: bold; font-size: 18px;">Final Amount:</td>
                <td style="padding: 12px 0; font-weight: bold; font-size: 18px; color: ${isFreeSub ? "#059669" : "#1f2937"};">
                  ${isFreeSub ? "FREE" : `$${paymentAmount.toFixed(2)} USD`}
                </td>
              </tr>
            </table>
          </div>

          <!-- Employer Information -->
          <div style="background: #f9fafb; padding: 25px; border-radius: 10px; margin-bottom: 30px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; margin-top: 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
              👤 Employer Information
            </h2>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: bold; width: 30%;">Employer ID:</td>
                <td style="padding: 12px 0; font-family: monospace; background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${data.employerId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: bold;">Email:</td>
                <td style="padding: 12px 0;">
                  <a href="mailto:${data.employerEmail}" style="color: #3b82f6; text-decoration: none;">
                    ${data.employerEmail}
                  </a>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: bold;">Payment Method:</td>
                <td style="padding: 12px 0; text-transform: capitalize;">${data.paymentMethod}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: bold;">Submitted:</td>
                <td style="padding: 12px 0;">${new Date(data.timestamp).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Jamaica",
  })}</td>
              </tr>
            </table>
          </div>

          <!-- Action Buttons -->
          <div style="background: #ffffff; padding: 30px; border-radius: 10px; margin-bottom: 30px; border: 2px solid #e5e7eb; text-align: center;">
            <h2 style="color: #1f2937; margin-top: 0; margin-bottom: 25px;">
              🎯 Quick Actions
            </h2>
            
            <div style="margin-bottom: 20px;">
              <a href="https://hiremeja.com/admin/payments" 
                 style="background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 5px;">
                ✅ Approve Payment
              </a>
              
              <a href="https://hiremeja.com/admin/payments" 
                 style="background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 5px;">
                ❌ Decline Payment
              </a>
            </div>
            
            <div>
              <a href="https://hiremeja.com/admin/dashboard" 
                 style="background: #3b82f6; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 5px;">
                📊 Admin Dashboard
              </a>
              
              <a href="mailto:${data.employerEmail}" 
                 style="background: #6b7280; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 5px;">
                📧 Contact Employer
              </a>
            </div>
          </div>

          <!-- System Information -->
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #374151;">🔧 System Information</h3>
            <div style="font-size: 14px; color: #6b7280; line-height: 1.4;">
              <p style="margin: 5px 0;"><strong>Status:</strong> ${data.status || "pending"}</p>
              <p style="margin: 5px 0;"><strong>Requires Approval:</strong> ${data.requiresApproval ? "Yes" : "No"}</p>
              <p style="margin: 5px 0;"><strong>Subscription Type:</strong> ${isFreeSub ? "Free (Promo Code)" : "Paid"}</p>
              <p style="margin: 5px 0;"><strong>Notification Sent:</strong> ${new Date().toISOString()}</p>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 5px 0; font-weight: bold;">© ${new Date().getFullYear()} HireMeJA Admin System</p>
            <p style="margin: 5px 0;">
              This is an automated notification for payment approval.
            </p>
            <p style="margin: 5px 0;">
              Please respond within 24 hours to maintain service quality.
            </p>
          </div>
        </body>
      </html>
    `;

    // Prepare mail options
    const mailOptions = {
      from: `"HireMeJA Admin System" <${process.env.GMAIL_USER || "info@hiremeja.com"}>`,
      to: adminEmails.join(", "),
      subject: subject,
      html: emailBody,
      priority: "high",
      headers: {
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        "Importance": "high",
      },
    };

    console.log("📤 [ADMIN NOTIFICATION] Sending email to admins:", adminEmails);

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ [ADMIN NOTIFICATION] Email sent successfully");
    console.log("📧 [ADMIN NOTIFICATION] Message ID:", info.messageId);
    console.log("📧 [ADMIN NOTIFICATION] Recipients:", adminEmails);

    return {
      success: true,
      messageId: info.messageId,
      recipients: adminEmails,
      paymentId: data.paymentId,
      amount: paymentAmount,
      packageName: data.packageName,
      isFreeSubscription: isFreeSub,
    };
  } catch (error) {
    console.error("❌ [ADMIN NOTIFICATION] Error sending email:", error);

    // Log detailed error information
    console.error("❌ [ADMIN NOTIFICATION] Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
      paymentId: data.paymentId,
      employerEmail: data.employerEmail,
    });

    throw new HttpsError(
      "internal",
      `Failed to send admin notification email: ${error.message}`,
    );
  }
};
