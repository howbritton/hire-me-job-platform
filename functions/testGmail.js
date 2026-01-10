// functions/testGmail.js
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "info@hiremeja.com",
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const testGmailConnection = async (data, context) => {
  console.log("🧪 Testing Gmail connection...");
  console.log("Environment variables check:");
  console.log("- GMAIL_APP_PASSWORD available:", process.env.GMAIL_APP_PASSWORD ? "✅ Yes" : "❌ No");
  console.log("- GMAIL_APP_PASSWORD length:", process.env.GMAIL_APP_PASSWORD?.length || 0);

  try {
    // Test 1: Verify transporter connection
    console.log("🔌 Testing transporter verification...");
    await transporter.verify();
    console.log("✅ Gmail transporter verified successfully");

    // Test 2: Send a simple test email
    console.log("📧 Sending test email...");
    const testEmail = {
      from: "\"HireMeJA\" <info@hiremeja.com>",
      to: data.testEmail || "how.britton@gmail.com",
      subject: "Gmail Test Email - " + new Date().toISOString(),
      text: `This is a test email to verify Gmail functionality.
      
Sent at: ${new Date().toISOString()}
Environment: ${process.env.NODE_ENV || "development"}
Function: testGmailConnection

If you receive this email, Gmail is working correctly!`,
      html: `
        <h2>Gmail Test Email</h2>
        <p>This is a test email to verify Gmail functionality.</p>
        <ul>
          <li><strong>Sent at:</strong> ${new Date().toISOString()}</li>
          <li><strong>Environment:</strong> ${process.env.NODE_ENV || "development"}</li>
          <li><strong>Function:</strong> testGmailConnection</li>
        </ul>
        <p style="color: green;"><strong>✅ If you receive this email, Gmail is working correctly!</strong></p>
      `,
    };

    const result = await transporter.sendMail(testEmail);
    console.log("✅ Test email sent successfully!");
    console.log("📧 Email result:", result.messageId);

    return {
      success: true,
      message: "Gmail test completed successfully",
      details: {
        transporterVerified: true,
        emailSent: true,
        messageId: result.messageId,
        recipient: testEmail.to,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("❌ Gmail test failed:", error);

    return {
      success: false,
      message: "Gmail test failed",
      error: error.message,
      details: {
        transporterVerified: false,
        emailSent: false,
        errorType: error.constructor.name,
        timestamp: new Date().toISOString(),
      },
    };
  }
};
