/**
 * Contact Message Notification Handler
 * @description Automatically detects new contact messages and notifies admin
 */

import { getDatabase } from "firebase-admin/database";
import { onValueCreated } from "firebase-functions/v2/database";
import { HttpsError } from "firebase-functions/v2/https";
import nodemailer from "nodemailer";

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "info@hiremeja.com",
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * Admin email configuration
 */
const ADMIN_EMAILS = [
  "how.britton@gmail.com",
  "info@hiremeja.com",
];

/**
 * Firebase Realtime Database trigger for new contact messages
 */
export const onContactMessageSubmitted = onValueCreated(
  {
    ref: "/contact_messages/{messageId}",
    region: "us-central1",
  },
  async (event) => {
    try {
      console.log("New contact message detected");

      const messageData = event.data.val();
      const messageId = event.params.messageId;

      if (!messageData) {
        console.log("No message data found");
        return;
      }

      console.log("Processing contact message:", messageId);

      // Send notification to all admin emails
      const emailResults = await Promise.allSettled(
        ADMIN_EMAILS.map((adminEmail) =>
          sendAdminNotification(adminEmail, messageData, messageId)),
      );

      // Update message with notification status
      const db = getDatabase();
      const messageRef = db.ref(`contact_messages/${messageId}`);

      const successCount = emailResults.filter(
        (result) => result.status === "fulfilled",
      ).length;

      await messageRef.update({
        adminNotificationSent: successCount > 0,
        adminNotificationSentAt: new Date().toISOString(),
        adminEmailsSent: successCount,
        adminEmailsTotal: ADMIN_EMAILS.length,
        processedAt: new Date().toISOString(),
      });

      console.log(`Notification completed. ${successCount} emails sent.`);

      return {
        success: true,
        messageId: messageId,
        emailsSent: successCount,
        totalEmails: ADMIN_EMAILS.length,
      };
    } catch (error) {
      console.error("Error in contact message notification:", error);

      try {
        const db = getDatabase();
        const messageRef = db.ref(`contact_messages/${event.params.messageId}`);
        await messageRef.update({
          adminNotificationError: error.message,
          adminNotificationErrorAt: new Date().toISOString(),
        });
      } catch (dbError) {
        console.error("Failed to log error to database:", dbError);
      }

      throw new HttpsError("internal", "Failed to process notification");
    }
  },
);

/**
 * Send admin notification email for new contact message
 * @param {string} adminEmail - Admin email address
 * @param {Object} messageData - Contact message data
 * @param {string} messageId - Message ID
 * @return {Promise<Object>} Email send result
 */
async function sendAdminNotification(adminEmail,
  messageData, messageId) {
  try {
    const {
      name = "Unknown",
      email = "No email provided",
      subject = "Contact Form Inquiry",
      message = "No message content",
      phone = "Not provided",
    } = messageData;

    const htmlContent = createSimpleNotificationEmail(
      name, email, phone, subject, message, messageId,
    );
    const textContent = createSimpleNotificationText(
      name, email, phone, subject, message, messageId,
    );

    const mailOptions = {
      from: "HireMeJA <info@hiremeja.com>",
      to: adminEmail,
      subject: `New Contact Message from ${name}`,
      html: htmlContent,
      text: textContent,
      replyTo: email,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Admin notification sent to ${adminEmail}`);

    return {
      success: true,
      adminEmail: adminEmail,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(`Error sending notification to ${adminEmail}:`, error);
    throw error;
  }
}

/**
 * Create simple HTML email content
 * @param {string} name - Sender name
 * @param {string} email - Sender email
 * @param {string} phone - Sender phone
 * @param {string} subject - Message subject
 * @param {string} message - Message content
 * @param {string} messageId - Message ID
 * @return {string} HTML email content
 */
function createSimpleNotificationEmail(name,
  email, phone, subject, message, messageId) {
  return `
    <h2>New Contact Message - HireMeJA</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    <p><strong>Subject:</strong> ${subject}</p>
    <p><strong>Message:</strong></p>
    <p>${message.replace(/\n/g, "<br>")}</p>
    <p><strong>Message ID:</strong> ${messageId}</p>
    <p><a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}">Reply to Sender</a></p>
  `;
}

/**
 * Create simple text email content
 * @param {string} name - Sender name
 * @param {string} email - Sender email
 * @param {string} phone - Sender phone
 * @param {string} subject - Message subject
 * @param {string} message - Message content
 * @param {string} messageId - Message ID
 * @return {string} Text email content
 */
function createSimpleNotificationText(name,
  email, phone, subject, message, messageId) {
  return `
New Contact Message - HireMeJA

Name: ${name}
Email: ${email}
Phone: ${phone}
Subject: ${subject}

Message:
${message}

Message ID: ${messageId}

Reply to sender: mailto:${email}?subject=Re: ${encodeURIComponent(subject)}
  `;
}
