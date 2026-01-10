import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const serviceAccount = require(
  "./hireme-d14cb-firebase-adminsdk-hp4ot-14c998a5d6.json",
);

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://hireme-d14cb-default-rtdb.firebaseio.com",
});

/**
 * Sets up admin users in Firebase Authentication and Realtime Database.
 * @return {Promise<void>} Resolves when all admin users are set up
 */
async function setAdminsWithDatabase() {
  const admins = [
    {
      email: "admin@hiremeja.com",
      uid: "ecGj6aHbGndgaGhb18fGecxc0ru1",
    },
    {
      email: "info@hiremeja.com",
      uid: "vfgZNCjKG3dnH4FcoEQ2ydSInKd2",
    },
    {
      email: "how.britton@gmail.com",
      uid: "2WV5xhjugAXqp2wBgf8GUF3ixso1",
    },
  ];

  const db = getDatabase();
  const auth = getAuth();

  try {
    for (const adminUser of admins) {
      console.log(`Setting up admin for ${adminUser.email}...`);

      // Set Authentication custom claims
      await auth.setCustomUserClaims(adminUser.uid, {
        admin: true,
      });

      // Remove from employers if exists
      await db.ref(`employers/${adminUser.uid}`).remove();

      // Add to admins collection
      await db.ref(`admins/${adminUser.uid}`).set({
        email: adminUser.email,
        role: "admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Verify setup
      const userRecord = await auth.getUser(adminUser.uid);
      console.log(`\nVerification for ${adminUser.email}:`);
      console.log("Custom Claims:", userRecord.customClaims);
      console.log(
        "Admin Status:",
        userRecord.customClaims?.admin === true,
      );
    }

    console.log("\nSetup Complete!");
    process.exit(0);
  } catch (error) {
    console.error("Error setting admin roles:", error);
    process.exit(1);
  }
}

// Run the setup
setAdminsWithDatabase();
