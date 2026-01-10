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

export const sendPackageExpirationEmail = async (
  packageData,
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
      `/employers/${packageData.employerId}`,
    );
    const employerSnapshot = await employerRef.once("value");
    const employerData = employerSnapshot.val();

    if (!employerData?.email) {
      throw new Error("Employer email not found");
    }

    // Get active job postings count
    const jobsRef = db.ref("jobs")
      .orderByChild("employerId")
      .equalTo(packageData.employerId);
    const jobsSnapshot = await jobsRef.once("value");
    const activeJobs = Object.values(jobsSnapshot.val() || {})
      .filter((job) => job.status === "active").length;

    const { subject, text, html } = createPackageExpirationEmail(
      packageData,
      employerData,
      activeJobs,
    );

    await transporter.sendMail({
      from: "\"HireMeJA\" <info@hiremeja.com>",
      to: employerData.email,
      subject,
      text,
      html,
    });

    console.log(
      `Package expiration notice sent to: ${employerData.email}`,
    );
    return {
      success: true,
      message: "Package expiration notice sent",
    };
  } catch (error) {
    console.error("Error sending package expiration notice:", error);
    throw new HttpsError(
      "internal",
      `Failed to send expiration notice: ${error.message}`,
    );
  }
};

const createPackageExpirationEmail = (
  packageData,
  employerData,
  activeJobs,
) => {
  const subject = "Your HireMeJA Package is Expiring Soon";
  const daysUntilExpiry = Math.ceil(
    (new Date(packageData.expiryDate) - new Date()) /
    (1000 * 60 * 60 * 24),
  );

  const getUrgencyColor = (days) => {
    if (days <= 3) return "#dc2626"; // red
    if (days <= 7) return "#ea580c"; // orange
    return "#1e3a8a"; // blue
  };

  const urgencyColor = getUrgencyColor(daysUntilExpiry);

  const createTableRow = (pkg, bg = "") => `
    <tr${bg ? ` style="background-color: ${bg};"` : ""}>
      <td style="padding: 10px; border: 1px solid #e2e8f0;">
        ${pkg.name}
      </td>
      <td style="padding: 10px; border: 1px solid #e2e8f0;">
        ${pkg.duration}
      </td>
      <td style="padding: 10px; border: 1px solid #e2e8f0;">
        ${pkg.posts}
      </td>
      <td style="padding: 10px; border: 1px solid #e2e8f0;">
        ${pkg.price}
      </td>
    </tr>`;

  const packages = [
    { name: "Basic", duration: "30 days", posts: "5", price: "$99" },
    {
      name: "Professional",
      duration: "60 days",
      posts: "15",
      price: "$249",
    },
    {
      name: "Enterprise",
      duration: "90 days",
      posts: "Unlimited",
      price: "$499",
    },
  ];

  const packageRows = packages
    .map((pkg, i) => createTableRow(pkg, i % 2 ? "#f8fafc" : ""))
    .join("");

  const htmlHeader = `
    <h1>Package Expiration Notice</h1>
    
    <div style="background-color: ${urgencyColor};
                color: white;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;">
      <p style="margin: 0; font-size: 1.2em;">
        Your ${packageData.packageName} package will expire in 
        ${daysUntilExpiry} days
      </p>
    </div>`;

  const packageDetails = `
    <h2>Package Details:</h2>
    <ul>
      <li><strong>Company:</strong> ${employerData.companyName}</li>
      <li><strong>Package:</strong> ${packageData.packageName}</li>
      <li><strong>Expiry Date:</strong> ${
  new Date(packageData.expiryDate).toLocaleDateString()
}</li>
      <li><strong>Remaining Posts:</strong> ${
  packageData.remainingPosts
}</li>
      <li><strong>Active Postings:</strong> ${activeJobs}</li>
    </ul>`;

  const expiredFeatures = `
    <h3>What happens when your package expires?</h3>
    <ul>
      <li>Your active job postings will be archived</li>
      <li>You won't be able to post new jobs</li>
      <li>You'll lose access to premium features</li>
      <li>Your company profile and job history will be preserved</li>
      ${
  activeJobs > 0 ?
    `<li><strong>Important:</strong> You have ${activeJobs} 
              active posting(s) that will be affected</li>` :
    ""
}
    </ul>`;

  const premiumFeatures = `
    <h3>Premium Features You'll Lose:</h3>
    <ul>
      <li>Ability to post new jobs</li>
      <li>Access to candidate database</li>
      <li>Featured company listing</li>
      <li>Priority customer support</li>
      <li>Advanced analytics and reporting</li>
    </ul>`;

  const specialOfferSection = packageData.specialOffer ?
    `
    <div style="background-color: #fef3c7;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;">
      <h3 style="color: #92400e; margin-top: 0;">
        Special Renewal Offer
      </h3>
      <p style="color: #92400e; margin-bottom: 0;">
        ${packageData.specialOffer}
      </p>
    </div>` :
    "";

  const packagesTable = `
    <h3>Available Packages:</h3>
    <table style="width: 100%;
                  border-collapse: collapse;
                  margin: 20px 0;">
      <tr style="background-color: #f8fafc;">
        <th style="padding: 10px; border: 1px solid #e2e8f0;">
          Package
        </th>
        <th style="padding: 10px; border: 1px solid #e2e8f0;">
          Duration
        </th>
        <th style="padding: 10px; border: 1px solid #e2e8f0;">
          Job Posts
        </th>
        <th style="padding: 10px; border: 1px solid #e2e8f0;">
          Price
        </th>
      </tr>
      ${packageRows}
    </table>`;

  const actionButtons = `
    <div style="margin-top: 20px;">
      <p>
        <a href="https://hiremeja.com/employer/packages"
           style="padding: 10px 20px;
                  background-color: ${urgencyColor};
                  color: white;
                  text-decoration: none;
                  border-radius: 5px;">
          Renew Package
        </a>
      </p>
    </div>`;

  const footer = `
    <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
      Need help? Contact our support team at support@hiremeja.com or
      visit your 
      <a href="https://hiremeja.com/employer/dashboard">
        employer dashboard
      </a>.
    </p>`;

  const htmlContent = `
    ${htmlHeader}
    ${packageDetails}
    ${expiredFeatures}
    ${premiumFeatures}
    ${specialOfferSection}
    ${packagesTable}
    ${actionButtons}
    ${footer}
  `;

  const text = `
Package Expiration Notice

Your ${packageData.packageName} package will expire in ${
  daysUntilExpiry
} days.

Package Details:
--------------
Company: ${employerData.companyName}
Package: ${packageData.packageName}
Expiry Date: ${new Date(packageData.expiryDate).toLocaleDateString()}
Remaining Job Posts: ${packageData.remainingPosts}
Active Job Postings: ${activeJobs}

What happens when your package expires?
- Your active job postings will be archived
- You won't be able to post new jobs
- You'll lose access to premium features
- Your company profile and job history will be preserved
${
  activeJobs > 0 ?
    `- Important: You have ${activeJobs} active posting(s) affected` :
    ""
}

Premium Features You'll Lose:
- Ability to post new jobs
- Access to candidate database
- Featured company listing
- Priority customer support
- Advanced analytics and reporting

${
  packageData.specialOffer ?
    `
Special Renewal Offer:
${packageData.specialOffer}
` :
    ""
}

Renew your package at: https://hiremeja.com/employer/packages
View your dashboard at: https://hiremeja.com/employer/dashboard

Need help? Contact support@hiremeja.com
`;

  return { subject, text, html: htmlContent };
};
