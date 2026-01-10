// functions/invoice.js - FIXED TO MATCH WORKING PATTERN
import { HttpsError } from "firebase-functions/v2/https";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "info@hiremeja.com",
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendInvoiceEmail = async (invoiceData, context) => {
  // ✅ MATCH WORKING PATTERN - Throw error, don't return
  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated to send invoice.",
    );
  }

  try {
    console.log("🧾 Invoice function called for:", invoiceData.invoiceNumber);
    console.log("📧 Target email:", invoiceData.employerDetails?.email);

    // Test email connection
    console.log("🔌 Testing transporter...");
    await transporter.verify();
    console.log("✅ Transporter verified");

    // Get email address
    const emailAddress = invoiceData.employerDetails?.email ||
      invoiceData.email;
    if (!emailAddress) {
      throw new Error("No recipient email address provided");
    }

    console.log("📧 Sending to:", emailAddress);

    // Generate PDF
    console.log("📄 Generating PDF...");
    const pdfBuffer = await generatePDF(invoiceData);
    console.log("✅ PDF generated, size:", pdfBuffer.length, "bytes");

    // Create email content
    const { subject, text } = createInvoiceEmail(invoiceData);

    // Send email
    console.log("📤 Sending email...");
    await transporter.sendMail({
      from: "\"HireMeJA\" <info@hiremeja.com>",
      to: emailAddress,
      subject: subject,
      text: text,
      attachments: [{
        filename: `invoice-${invoiceData.invoiceNumber || invoiceData.id}.pdf`,
        content: pdfBuffer,
      }],
    });

    console.log("✅ Invoice email sent successfully to:", emailAddress);

    // ✅ MATCH WORKING PATTERN - Return success object
    return {
      success: true,
      message: `Invoice email sent to ${emailAddress}`,
    };
  } catch (error) {
    console.error("❌ Error sending invoice email:", error);
    // ✅ MATCH WORKING PATTERN - Throw HttpsError, don't return
    throw new HttpsError(
      "internal",
      `Failed to send invoice: ${error.message}`,
    );
  }
};

const generatePDF = async (data) => {
  const doc = new PDFDocument({ margin: 50 });
  const buffers = [];

  doc.on("data", (buffer) => buffers.push(buffer));

  try {
    // Invoice Header
    doc
      .fontSize(24)
      .fillColor("#1e3a8a")
      .text("INVOICE", { align: "right" })
      .fontSize(12)
      .fillColor("black")
      .text(`Invoice #${data.invoiceNumber || data.id}`, { align: "right" })
      .text(`Date: ${new Date(data.paymentDate || data.createdAt).toLocaleDateString()}`, { align: "right" })
      .moveDown(2);

    // Company Info
    doc
      .fontSize(14)
      .fillColor("#1e3a8a")
      .text("HireMeJA", 50)
      .fontSize(10)
      .fillColor("black")
      .text("Making hiring easier and more efficient", 50)
      .text("info@hiremeja.com", 50)
      .moveDown(2);

    // Bill To Section
    doc
      .fontSize(12)
      .fillColor("#1e3a8a")
      .text("BILL TO:", 50)
      .fontSize(10)
      .fillColor("black");

    if (data.employerDetails) {
      const fullName = `${data.employerDetails.firstName ||
        ""} ${data.employerDetails.lastName || ""}`.trim();
      if (fullName) doc.text(fullName, 50);
      if (data.employerDetails.companyName) {
        doc.text(data.employerDetails.companyName, 50);
      }
      if (data.employerDetails.email) {
        doc.text(data.employerDetails.email, 50);
      }
    } else {
      doc.text(data.employerName || "", 50);
      doc.text(data.email || "", 50);
    }

    doc.moveDown(2);

    // Package Details
    doc
      .fontSize(12)
      .fillColor("#1e3a8a")
      .text("PACKAGE DETAILS:", 50)
      .fontSize(10)
      .fillColor("black")
      .text(`Package Name: ${data.packageName}`, 50);

    if (data.packageDuration) {
      doc.text(`Duration: ${data.packageDuration} days`, 50);
    }
    if (data.jobPostLimit) {
      doc.text(`Job Post Limit: ${data.jobPostLimit}`, 50);
    }

    doc.moveDown(2);

    // Payment Details
    const leftColumn = 50;
    const rightColumn = 400;

    if (data.originalAmount && data.originalAmount !== data.amount) {
      doc.text("Original Amount:", leftColumn);
      doc.text(`$${parseFloat(data.originalAmount).toFixed(2)} USD`, rightColumn);
      doc.moveDown(0.5);
    }

    if (data.discount && data.discount > 0) {
      doc.text("Discount:", leftColumn);
      doc.text(`-$${parseFloat(data.discount).toFixed(2)} USD`, rightColumn);
      doc.moveDown(0.5);
    }

    if (data.promoCodeApplied && data.promoCodeDetails) {
      doc.text("Promo Code Applied:", leftColumn);
      doc.text(`${data.promoCodeDetails.code} (${data.promoCodeDetails.discountPercentage}% off)`, rightColumn);
      doc.moveDown(0.5);
    }

    // Total Amount
    doc
      .fontSize(14)
      .fillColor("#1e3a8a")
      .text("TOTAL AMOUNT:", leftColumn)
      .fontSize(16)
      .fillColor(data.isFreeSubscription ? "#16a34a" : "#1e3a8a")
      .text(data.isFreeSubscription ? "FREE" : `$${parseFloat(data.amount || 0).toFixed(2)} USD`, rightColumn);

    doc.moveDown(3);

    // Thank you message
    doc
      .fontSize(12)
      .fillColor("black")
      .text("Thank you for choosing HireMeJA!", 50, doc.y, { align: "center" });

    if (data.isFreeSubscription) {
      doc.fontSize(10).text("Your free subscription is now active!", 50, doc.y, { align: "center" });
    } else {
      doc.fontSize(10).text("Your subscription will be activated once payment is confirmed.", 50, doc.y, { align: "center" });
    }
  } catch (error) {
    console.error("Error generating PDF content:", error);
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });
};

const createInvoiceEmail = (data) => {
  const employerName = data.employerDetails?.firstName ?
    `${data.employerDetails.firstName} ${data.employerDetails.lastName || ""}`.trim() :
    data.employerName || "Valued Customer";

  const subject = data.isFreeSubscription ?
    `HireMeJA - Free Subscription Activated! Invoice #${data.invoiceNumber || data.id}` :
    `HireMeJA Invoice #${data.invoiceNumber || data.id}`;

  let text;
  if (data.isFreeSubscription) {
    text = `Dear ${employerName},

Congratulations! Your free subscription to the ${data.packageName} package has been activated!

Thanks to your promo code, you're getting full access to HireMeJA's premium features at no cost.

Your subscription details:
• Package: ${data.packageName}
• Duration: ${data.packageDuration || "N/A"} days
• Job Posts: ${data.jobPostLimit || "Unlimited"}
• Total Cost: FREE (100% discount applied)

Your subscription is now active and ready to use!

Best regards,
The HireMeJA Team`;
  } else {
    text = `Dear ${employerName},

Thank you for choosing HireMeJA!

Your invoice for the ${data.packageName} package is attached.

Package Details:
• Package: ${data.packageName}
• Duration: ${data.packageDuration || "N/A"} days
• Job Posts: ${data.jobPostLimit || "Unlimited"}
• Amount: $${parseFloat(data.amount || 0).toFixed(2)} USD

${data.promoCodeApplied ? "Great news! Your promo code has been applied for additional savings.\n\n" : ""}Your subscription will be activated once we confirm your payment.

If you have any questions, please contact us.

Best regards,
The HireMeJA Team`;
  }

  return { subject, text };
};
