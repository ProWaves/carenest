// ==========================================================================
// Firebase Cloud Messaging — server-side push sender
// ==========================================================================
// Supports two ways of providing the service account:
//   1. FIREBASE_SERVICE_ACCOUNT_BASE64 — env var with base64-encoded JSON
//      (recommended for Render / Heroku / any ephemeral filesystem)
//   2. FIREBASE_SERVICE_ACCOUNT — path to the JSON file on disk
//      (local dev only — never commit the JSON)
// ==========================================================================
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

let initialized = false;

function init() {
  if (initialized) return;

  const hasBase64 = !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const hasFile = !!process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!hasBase64 && !hasFile) {
    console.warn('⚠️ FCM disabled: no FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT set');
    return;
  }

  try {
    let serviceAccount;

    if (hasBase64) {
      // Decode base64 → JSON
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded);
      console.log('🔑 FCM: using FIREBASE_SERVICE_ACCOUNT_BASE64');
    } else {
      // Load from file path
      const accountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT);
      serviceAccount = require(accountPath);
      console.log('🔑 FCM: using file at', accountPath);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    initialized = true;
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Firebase Admin init failed:', error.message);
  }
}

/**
 * Send a push notification to a single user by their FCM token.
 * Silently no-ops if FCM isn't configured or the user has no token.
 */
async function sendPush(fcmToken, { title, body, data = {} }) {
  if (!initialized) init();
  if (!initialized || !fcmToken) return;

  try {
    const message = {
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          channelId: 'sitterspot_default',
          sound: 'default',
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('📤 FCM sent:', response);
  } catch (error) {
    console.error('❌ FCM send error:', error.message);
  }
}

module.exports = { sendPush };