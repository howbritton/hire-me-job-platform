// test-integration.js
import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, push } from "firebase/database";
import dotenv from "dotenv";

dotenv.config();

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAA0RWug-zj6PFQigycDJ4xpgpJQr7p2lU",
  authDomain: "hireme-d14cb.firebaseapp.com",
  projectId: "hireme-d14cb",
  storageBucket: "hireme-d14cb.firebasestorage.app",
  messagingSenderId: "390114475630",
  appId: "1:390114475630:web:cf4a03c4257a9c3248707f",
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const auth = getAuth(app);
const db = getDatabase(app);

/**
 * Tests the integration between checkout and email functionality
 * by simulating the checkout process
 * @return {Promise<void>}
 */
async function testCheckoutToEmail() {
  try {
    console.log("Starting checkout to email integration test...");

    // 1. Sign in
    console.log("Signing in...");
    await signInWithEmailAndPassword(
      auth,
      "howard.britton@unicoreonline.com",
      "Smart2b@nk",
    );
    console.log("✅ Signed in successfully");

    // 2. Generate payment ID (similar to Checkout.js)
    const paymentsRef = ref(db, "payments");
    const newPaymentRef = push(paymentsRef);
    const paymentId = newPaymentRef.key;

    // 3. Prepare test payment data (matching Checkout.js structure)
    const paymentData = {
      id: paymentId,
      amount: "200",
      createdAt: new Date().toISOString(),
      packageId: "-OCKjToHSmWN_UWdVUbh",
      packageName: "Gold Package",
      paymentMethod: "bank-transfer",
      status: "pending",
      employerName: "Test Employer",
      email: "howard.britton@unicoreonline.com",
      bankDetails: {
        bankName: "Bank of America",
        accountNumber: "1234567890",
        routingNumber: "987654321",
        lastFourDigits: "7890",
      },
      discountAmount: 0,
      profile: {
        firstName: "Test",
        lastName: "Employer",
      },
    };

    // 4. Call the Cloud Function (same as in Checkout.js)
    console.log("Calling sendInvoiceEmail function...");
    const sendInvoice = httpsCallable(functions, "sendInvoiceEmail");
    const result = await sendInvoice(paymentData);

    if (result.data.success) {
      console.log("✅ Integration test completed successfully");
      console.log("Payment ID:", paymentId);
      console.log("Email should be sent to:", paymentData.email);
    } else {
      throw new Error("Function returned failure status");
    }
  } catch (error) {
    console.error("❌ Integration test failed:", {
      code: error.code,
      message: error.message,
      stack: error.stack,
    });
  }
}

// Run the test
testCheckoutToEmail();
