/**
 * Cloud function to check and update expired employer subscriptions
 * @module checkEmployerSubscriptions
 */

import { getDatabase } from "firebase-admin/database";
import { onSchedule } from "firebase-functions/v2/scheduler";

/**
 * Scheduled function that runs daily to check employer subscriptions
 * and update any expired ones to have status 'expired'
 */
export const checkEmployerSubscriptions = onSchedule({
  schedule: "every 24 hours",
  timeZone: "America/Jamaica",
}, async (context) => {
  const db = getDatabase();
  const now = new Date();

  try {
    console.log("Starting subscription expiration check");

    // Get all employers
    const employersSnapshot = await db.ref("employers").once("value");
    const employers = employersSnapshot.val();

    if (!employers) {
      console.log("No employers found");
      return null;
    }

    const updates = {};
    let updatedCount = 0;

    // Check each employer's subscription
    Object.entries(employers).forEach(([employerId, employer]) => {
      // Skip employers without subscription
      if (!employer.subscription) return;

      const { subscription } = employer;

      // Skip already expired subscriptions
      if (subscription.status === "expired") return;

      // Check if subscription is active but has an end date in the past
      if (subscription.status === "active" && subscription.endDate) {
        const endDate = new Date(subscription.endDate);

        if (endDate < now) {
          // Mark subscription as expired
          updates[`employers/${employerId}/subscription/status`] = "expired";
          updatedCount++;
          console.log(`Marking subscription as expired for employer: ${employerId}`);
        }
      }
    });

    // Apply all updates in a single batch
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
      console.log(`Updated ${updatedCount} expired subscriptions`);
    } else {
      console.log("No expired subscriptions found");
    }

    return null;
  } catch (error) {
    console.error("Error checking subscriptions:", error);
    return null;
  }
});
