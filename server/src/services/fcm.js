// ==========================================================================
// Firebase Cloud Messaging — server-side push sender
// ==========================================================================
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

let initialized = false;

function init() {
  if (initialized) return;

  const accountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!accountPath) {
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not set — FCM disabled');
    return;
  }

  try {
    const serviceAccount = require(path.resolve(accountPath));
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