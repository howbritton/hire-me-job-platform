const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

const logAuthenticationEvent = async (eventType, orderId, data) => {
  console.log(`3DS Authentication event: ${eventType} for order ${orderId}`, {
    data: JSON.stringify(data, null, 2),
  });
};

const sagicorConfig = {
  API_BASE: "https://sagicorbank.gateway.mastercard.com",
  MERCHANT_ID: "TESTHIREMEJA",
  API_PASSWORD: functions.config().sagicor.api_password,
  MERCHANT_NAME: "Hire Me Jamaica Limited",
  FRONTEND_URL: "https://hiremeja.com",
  apiVersion: "79",
  apiUrl: "https://sagicorbank.gateway.mastercard.com" +
         "/api/rest/version/" +
         "79/merchant/",
  getAuthHeader() {
    const credentials =
            `merchant.${this.MERCHANT_ID}:${this.API_PASSWORD}`;
    return `Basic ${Buffer.from(credentials).toString("base64")}`;
  },
};

// Initialize checkout session
app.post("/initiate-checkout", async (req, res) => {
  try {
    const { amount, currency, orderId, userId, email } = req.body;

    if (!amount || !currency || !orderId || !userId || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const checkoutData = {
      apiOperation: "INITIATE_CHECKOUT",
      // Add 3DS configuration
      authentication: {
        acceptVersions: ["3DS1", "3DS2"],
        channel: "BROWSER",
        purpose: "PAYMENT_TRANSACTION",
      },
      interaction: {
        operation: "PURCHASE",
        returnUrl: `${sagicorConfig.FRONTEND_URL}/payment/callback`,
        merchant: {
          name: sagicorConfig.MERCHANT_NAME,
          url: sagicorConfig.FRONTEND_URL,
        },
      },
      order: {
        amount: amount.toString(),
        currency,
        id: orderId,
        description: `${sagicorConfig.MERCHANT_NAME} Package - ${orderId}`,
      },
      customer: {
        email,
        reference: userId,
      },
    };

    const apiUrl = `${sagicorConfig.apiUrl}${
      sagicorConfig.MERCHANT_ID
    }/session`;

    const response = await axios({
      method: "POST",
      url: apiUrl,
      headers: {
        "Authorization": sagicorConfig.getAuthHeader(),
        "Content-Type": "application/json",
      },
      data: checkoutData,
    });

    console.log(`Payment session created for order ${orderId}`);

    res.json({
      sessionId: response.data.session.id,
      successIndicator: response.data.successIndicator,
    });
  } catch (error) {
    console.error("Sagicor API Error:",
      error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to initialize checkout",
      details: error.response?.data?.error?.explanation ||
                error.message,
    });
  }
});

// Handle webhook notifications
app.post("/webhook", async (req, res) => {
  try {
    const webhookData = req.body;
    const db = admin.database(); // Change to Realtime Database
    const timestamp = new Date().toISOString(); // Use ISO string for timestamp

    if (webhookData.eventType.startsWith("AUTHENTICATION.")) {
      await logAuthenticationEvent(
        webhookData.eventType,
        webhookData.orderId,
        webhookData,
      );
    }

    console.log(
      `Received webhook: ${webhookData.eventType} ` +
      `for ${webhookData.orderId}`,
    );

    const paymentRef = db.ref(`payments/${webhookData.orderId}`); // Use ref instead of collection

    switch (webhookData.eventType) {
    case "AUTHENTICATION.ATTEMPTED": {
      await paymentRef.update({
        authentication_status: "attempted",
        updatedAt: timestamp,
      });
      break;
    }

    case "AUTHENTICATION.SUCCESSFUL": {
      await paymentRef.update({
        authentication_status: "successful",
        updatedAt: timestamp,
      });
      break;
    }

    case "AUTHENTICATION.FAILED": {
      await paymentRef.update({
        authentication_status: "failed",
        status: "failed",
        errorDetails: webhookData.error,
        updatedAt: timestamp,
      });
      break;
    }

    case "PAYMENT.AUTHORIZED": {
      await paymentRef.update({
        status: "authorized",
        updatedAt: timestamp,
      });
      break;
    }

    case "PAYMENT.CAPTURED": {
      await paymentRef.update({
        status: "completed",
        updatedAt: timestamp,
      });

      const snapshot = await paymentRef.once("value");
      const paymentData = snapshot.val();

      if (paymentData?.userId) {
        const userRef = db.ref(`users/${paymentData.userId}`);
        await userRef.update({
          "subscription/status": "active",
          "subscription/updatedAt": timestamp,
        });
      }
      break;
    }

    case "PAYMENT.FAILED": {
      await paymentRef.update({
        status: "failed",
        errorDetails: webhookData.error,
        updatedAt: timestamp,
      });
      break;
    }

    default:
      console.log("Unhandled webhook event:", webhookData.eventType);
    }

    res.json({ status: "Webhook processed successfully" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
  });
});

exports.payments = functions.https.onRequest(app);
