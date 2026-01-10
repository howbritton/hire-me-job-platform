// test-connection.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";

// Load environment variables
dotenv.config();

// Mock data for testing
const mockPaymentData = {
  id: `TEST-${Date.now()}`,
  amount: "200",
  createdAt: new Date().toISOString(),
  packageName: "Gold Package",
  paymentMethod: "bank-transfer",
  employerName: "Test Employer",
  email: "info@hiremeja.com",
  bankDetails: {
    bankName: "Bank of America",
    accountNumber: "1234567890",
    routingNumber: "987654321",
    lastFourDigits: "7890",
  },
};

/**
 * Generates a PDF invoice from the provided data
 * @param {Object} data - The invoice data
 * @return {Promise<Buffer>} The generated PDF as a buffer
 */
async function generatePDF(data) {
  const doc = new PDFDocument({ margin: 50 });
  const buffers = [];

  doc.on("data", (buffer) => buffers.push(buffer));

  doc
    .fontSize(20)
    .text("INVOICE", { align: "right" })
    .fontSize(10)
    .text(`Invoice #${data.id}`, { align: "right" })
    .text(
      `Date: ${new Date(data.createdAt).toLocaleDateString()}`,
      { align: "right" },
    )
    .moveDown()
    .text("Bill To:")
    .text(data.employerName || "")
    .text(data.email)
    .moveDown()
    .text(`Package: ${data.packageName}`)
    .text(`Amount: $${data.amount}`)
    .text(`Payment Method: ${data.paymentMethod}`)
    .moveDown()
    .text("Bank Details:")
    .text(`Bank: ${data.bankDetails.bankName}`)
    .text(`Account: ****${data.bankDetails.lastFourDigits}`)
    .moveDown()
    .text(`Total: $${data.amount}`, { align: "right" })
    .moveDown()
    .fontSize(8)
    .text(
      "Thank you for choosing HireMeJA. Please complete your " +
        "bank transfer to activate your subscription.",
      { align: "center", color: "gray" },
    );

  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });
}

/**
 * Tests the email connection by sending a test invoice
 * @return {Promise<void>}
 */
async function testEmailConnection() {
  console.log("Testing email connection...");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "info@hiremeja.com",
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  try {
    // Verify connection configuration
    await transporter.verify();
    console.log("✅ Email server connection successful!");

    // Generate PDF
    console.log("Generating PDF...");
    const pdfBuffer = await generatePDF(mockPaymentData);
    console.log("✅ PDF generated successfully!");

    // Send test email with PDF attachment
    console.log("Sending test email with invoice...");

    const emailText = `Dear ${mockPaymentData.employerName},\n\n` +
      `Thank you for choosing HireMeJA!\n\n` +
      `Your invoice for the ${mockPaymentData.packageName} ` +
      `package is attached.\n\n` +
      "Please complete the bank transfer using the details " +
      "provided in the invoice.\n" +
      "Remember to include your email address as the " +
      "payment reference.\n\n" +
      `Amount Due: $${mockPaymentData.amount}\n\n` +
      "Your subscription will be activated once we confirm " +
      "your payment.\n\n" +
      "Best regards,\n" +
      "The HireMeJA Team";

    const result = await transporter.sendMail({
      from: "info@hiremeja.com",
      to: "info@hiremeja.com",
      subject: `Test Invoice #${mockPaymentData.id}`,
      text: emailText,
      attachments: [{
        filename: `invoice-${mockPaymentData.id}.pdf`,
        content: pdfBuffer,
      }],
    });

    console.log("✅ Test email with invoice sent successfully!");
    console.log("Message ID:", result.messageId);
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testEmailConnection();
