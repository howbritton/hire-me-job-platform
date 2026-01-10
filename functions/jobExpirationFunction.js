// jobExpirationFunction.js
import { getDatabase } from "firebase-admin/database";
import { onSchedule } from "firebase-functions/v2/scheduler";

export const checkAndUpdateExpiredJobs = onSchedule({
  schedule: "0 0 * * *", // Run daily at midnight
  timeZone: "America/Jamaica", // Use appropriate timezone for Jamaica
}, async () => {
  const db = getDatabase();
  const jobsRef = db.ref("jobs");
  const snapshot = await jobsRef.once("value");

  if (!snapshot.exists()) {
    console.log("No jobs found");
    return null;
  }

  const currentDate = new Date();
  const updates = {};
  let expiredCount = 0;

  // Iterate through each employer's jobs
  Object.entries(snapshot.val()).forEach(([employerId,
    employerJobs]) => {
    Object.entries(employerJobs).forEach(([jobId, job]) => {
      // Check if job has an expiration date and is active/approved
      if (job.expirationDate && ["active", "approved"].includes(job.status)) {
        const expirationDate = new Date(job.expirationDate);

        // If job has expired
        if (expirationDate < currentDate) {
          updates[`jobs/${employerId}/${jobId}/status`] = "expired";
          updates[`jobs/${employerId}/${jobId}/expiredAt`] = currentDate.toISOString();
          expiredCount++;
        }
      }
    });
  });

  // Apply updates if any jobs expired
  if (expiredCount > 0) {
    // Apply each update individually
    for (const [path, value] of Object.entries(updates)) {
      await db.ref(path).set(value);
    }
    console.log(`Updated ${expiredCount} expired jobs`);
  } else {
    console.log("No expired jobs found");
  }

  return { processed: expiredCount };
});
