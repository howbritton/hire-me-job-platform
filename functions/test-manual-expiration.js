/**
 * Test script to manually trigger job expiration check
 * Run with: node test-manual-expiration.js
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getFunctions } from "firebase-admin/functions";
import serviceAccount from "./hireme-d14cb-firebase-adminsdk-hp4ot-14c998a5d6.json" assert { type: "json" };

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://hireme-d14cb-default-rtdb.firebaseio.com",
});

console.log("🚀 Starting manual job expiration test...");
console.log("📅 Current time:", new Date().toISOString());

// Import and run the expiration check
import("./jobExpiration.js").then(async (module) => {
  try {
    // Get the database to check what we have
    const db = getDatabase();

    // Check jobs
    const jobsSnapshot = await db.ref("jobs").once("value");
    const jobs = jobsSnapshot.val();

    if (jobs) {
      console.log("\n📋 Current Jobs in Database:");
      for (const [employerId, employerJobs] of Object.entries(jobs)) {
        console.log(`\n👤 Employer: ${employerId}`);
        for (const [jobId, jobData] of Object.entries(employerJobs)) {
          if (typeof jobData === "object") {
            console.log(`  📝 Job ${jobId}:`);
            console.log(`     Title: ${jobData.jobTitle || jobData.title}`);
            console.log(`     Status: ${jobData.status}`);
            console.log(`     Created: ${jobData.createdAt}`);
            console.log(`     Expires: ${jobData.expirationDate}`);

            // Check if expired
            const now = new Date();
            const expiryDate = jobData.expirationDate ? new Date(jobData.expirationDate) : null;
            if (expiryDate) {
              const isExpired = now > expiryDate;
              console.log(`     Is Expired: ${isExpired ? "✅ YES" : "❌ NO"}`);
              if (!isExpired) {
                const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                console.log(`     Days until expiry: ${daysUntilExpiry}`);
              }
            }
          }
        }
      }
    } else {
      console.log("\n⚠️ No jobs found in database");
    }

    console.log("\n" + "=".repeat(60));
    console.log("Now calling manualJobExpiration function...");
    console.log("=".repeat(60) + "\n");

    // Note: Since this is a callable function, we can't directly invoke it here
    // You need to call it via HTTP or Firebase Console
    console.log("\n⚠️ To actually run the expiration check, you need to:");
    console.log("1. Deploy: firebase deploy --only functions:manualJobExpiration");
    console.log("2. Use Firebase Console Functions section");
    console.log("3. Or use the testing HTML file below");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
});
