const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Firebase function that deletes a user from Firebase Authentication
 * when they are deleted from the Realtime Database.
 *
 * Triggers on delete events for both 'employers' and 'candidates' paths.
 */
exports.deleteAuthUser = functions.database
  .ref("/{userType}/{userId}")
  .onDelete(async (snapshot, context) => {
    const { userType, userId } = context.params;

    // Only process for valid user types
    if (userType !== "employers" && userType !== "candidates") {
      console.log(`Ignoring delete for non-user collection: ${userType}`);
      return null;
    }

    try {
      console.log(`User deleted from database: ${userType}/${userId}`);

      // Check if the user exists in Authentication
      try {
        // Get the user from Authentication
        await admin.auth().getUser(userId);

        // If user exists, delete them
        await admin.auth().deleteUser(userId);
        console.log(`Successfully deleted auth user: ${userId}`);

        return { success: true, message: `User ${userId} deleted from authentication` };
      } catch (authError) {
        // If error is "user not found", that's okay
        if (authError.code === "auth/user-not-found") {
          console.log(`Auth user ${userId} does not exist or was already deleted`);
          return { success: true, message: `Auth user ${userId} does not exist or was already deleted` };
        }

        // Otherwise, log the error but don't fail the function
        console.error(`Error getting/deleting auth user ${userId}:`, authError);
        return { success: false, error: authError.message };
      }
    } catch (error) {
      console.error(`Error in deleteAuthUser function:`, error);
      return { success: false, error: error.message };
    }
  });

/**
 * HTTP endpoint that can be called manually to delete a user
 * Both from the database and authentication
 */
exports.deleteUser = functions.https.onCall(async (data, context) => {
  // Check if the caller is an admin
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can delete users.",
    );
  }

  const { userId, userType } = data;

  if (!userId || !userType) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with userId and userType arguments.",
    );
  }

  // Validate userType
  if (userType !== "employer" && userType !== "candidate") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "userType must be either \"employer\" or \"candidate\".",
    );
  }

  try {
    // Delete from database first
    const userRef = admin.database().ref(`${userType}s/${userId}`);

    // Check if user exists
    const snapshot = await userRef.once("value");
    if (!snapshot.exists()) {
      throw new functions.https.HttpsError(
        "not-found",
        `User ${userId} not found in ${userType}s collection.`,
      );
    }

    // Delete user from database
    await userRef.remove();

    // Delete from authentication
    try {
      await admin.auth().deleteUser(userId);
      console.log(`Successfully deleted user ${userId} from auth and database`);
    } catch (authError) {
      // If user not found in auth, that's okay
      if (authError.code === "auth/user-not-found") {
        console.log(`Auth user ${userId} not found, but database record was deleted`);
      } else {
        console.error(`Error deleting auth user ${userId}:`, authError);
        return {
          success: true,
          databaseDeleted: true,
          authDeleted: false,
          message: `User deleted from database, but auth deletion failed: ${authError.message}`,
        };
      }
    }

    return {
      success: true,
      databaseDeleted: true,
      authDeleted: true,
      message: `User ${userId} successfully deleted from both database and authentication`,
    };
  } catch (error) {
    console.error(`Error in deleteUser function:`, error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * Utility function to clean up orphaned auth users
 * Can be scheduled or manually triggered
 */
exports.cleanupOrphanedAuthUsers =
    functions.https.onCall(async (data, context) => {
      // Check if the caller is an admin
      if (!context.auth || !context.auth.token.admin) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only admins can run cleanup operations.",
        );
      }

      try {
        console.log("Starting cleanup of orphaned auth users");

        // Get all auth users
        const listAllUsers = async (nextPageToken) => {
          const listUsersResult =
            await admin.auth().listUsers(1000, nextPageToken);
          return {
            users: listUsersResult.users,
            pageToken: listUsersResult.pageToken,
          };
        };

        let authUsers = [];
        let pageToken = undefined;

        do {
          const result = await listAllUsers(pageToken);
          authUsers = [...authUsers, ...result.users];
          pageToken = result.pageToken;
        } while (pageToken);

        console.log(`Found ${authUsers.length} auth users`);

        // Get all database users
        const employersSnapshot = await admin.database().ref("employers").once("value");
        const candidatesSnapshot = await admin.database().ref("candidates").once("value");

        const employersIds =
            employersSnapshot.exists() ?
              Object.keys(employersSnapshot.val()) : [];
        const candidatesIds =
            candidatesSnapshot.exists() ?
              Object.keys(candidatesSnapshot.val()) : [];

        const databaseUserIds = [...employersIds, ...candidatesIds];
        console.log(`Found ${databaseUserIds.length} database users`);

        // Find orphaned auth users (exist in auth but not in database)
        const orphanedUsers =
            authUsers.filter((user) =>
              !databaseUserIds.includes(user.uid));
        console.log(`Found ${orphanedUsers.length} orphaned auth users`);

        // Delete orphaned auth users
        const deletePromises = orphanedUsers.map(async (user) => {
          try {
            await admin.auth().deleteUser(user.uid);
            return { success: true,
              uid: user.uid, email: user.email };
          } catch (error) {
            console.error(`Error deleting orphaned user ${user.uid}:`, error);
            return { success: false,
              uid: user.uid,
              email: user.email, error: error.message };
          }
        });

        const results = await Promise.all(deletePromises);

        const successCount = results.filter((r) => r.success).length;
        console.log(`Successfully deleted ${successCount} orphaned auth users`);

        return {
          success: true,
          totalAuthUsers: authUsers.length,
          totalDatabaseUsers: databaseUserIds.length,
          orphanedUsersFound: orphanedUsers.length,
          orphanedUsersDeleted: successCount,
          results,
        };
      } catch (error) {
        console.error(`Error in cleanupOrphanedAuthUsers function:`, error);
        throw new functions.https.HttpsError("internal", error.message);
      }
    });
