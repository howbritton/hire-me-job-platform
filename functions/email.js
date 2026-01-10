// email.js
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logoPath = join(__dirname, "assets/hireme-logo.png");

const createTransporter = (config) => nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config.email,
    pass: config.password,
  },
});

const generatePDF = async (data) => {
  const doc = new PDFDocument({ margin: 50 });
  const buffers = [];

  doc.on("data", (buffer) => buffers.push(buffer));

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 50, { width: 120 });
  }

  doc
    .moveDown()
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
    .text(data.employerName || data.email)
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
      "Thank you for choosing HireMeJA. Please complete your bank " +
       "transfer to activate your subscription.",
      { align: "center", color: "gray" },
    );

  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });
};

export const sendInvoiceEmail = async (payment, config) => {
  try {
    const pdfBuffer = await generatePDF(payment);
    const transporter = createTransporter(config);

    await transporter.sendMail({
      from: config.email,
      to: payment.email,
      subject: `Your HireMeJA Invoice #${payment.id}`,
      text:
       `Dear ${payment.employerName || "Valued Customer"},\n\n` +
       "Thank you for choosing HireMeJA!\n\n" +
       `Your invoice for the ${payment.packageName} package is ` +
       "attached.\n\n" +
       "Please complete the bank transfer using the details " +
       "provided in the invoice.\n" +
       "Remember to include your email address as the payment " +
       "reference.\n\n" +
       `Amount Due: $${payment.amount}\n\n` +
       "Your subscription will be activated once we confirm " +
       "your payment.\n\n" +
       "Best regards,\n" +
       "The HireMeJA Team",
      attachments: [{
        filename: `invoice-${payment.id}.pdf`,
        content: pdfBuffer,
      }],
    });

    return { success: true };
  } catch (error) {
    console.error("Invoice sending failed:", error);
    return { error: error.message };
  }
};
