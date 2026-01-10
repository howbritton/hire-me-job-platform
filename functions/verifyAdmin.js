import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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
 * Verifies admin status of specific users in Firebase Authentication.
 * @return {Promise<void>} Resolves when admin verification is complete
 */
async function verifyAdmin() {
  const auth = getAuth();

  try {
    const admins = [
      {
        email: "admin@hiremeja.com",
        uid: "ecGj6aHbGndgaGhb18fGecxc0ru1",
      },
      {
        email: "how.britton@gmail.com",
        uid: "2WV5xhjugAXqp2wBgf8GUF3ixso1",
      },
    ];

    for (const adminUser of admins) {
      const user = await auth.getUser(adminUser.uid);

      console.log(`\nChecking admin status for ${adminUser.email}:`);
      console.log("User exists:", !!user);
      console.log("Custom Claims:", user.customClaims);
      console.log("Is admin:", user.customClaims?.admin === true);
      console.log("------------------------");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error verifying admin:", error);
    process.exit(1);
  }
}

verifyAdmin();
