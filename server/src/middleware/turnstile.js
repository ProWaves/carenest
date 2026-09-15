// server/src/middleware/turnstile.js
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstile(req, res, next) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // If not configured, skip (dev / early deploy friendly)
  if (!secret) {
    console.warn('⚠️  TURNSTILE_SECRET_KEY missing — skipping CAPTCHA check.');
    return next();
  }

  // ✅ NEW: skip CAPTCHA for the native Android app.
  // The app sends X-Client-Type: mobile on every request.
  // (Not cryptographically secure — see notes in the code review.)
  if (req.headers['x-client-type'] === 'mobile') {
    return next();
  }

  const token = req.body?.turnstileToken;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing CAPTCHA token. Please refresh and try again.' });
  }

  try {
    const body = new URLSearchParams();
    body.append('secret', secret);
    body.append('response', token);
    if (req.ip) body.append('remoteip', req.ip);

    const r = await fetch(VERIFY_URL, { method: 'POST', body });
    const data = await r.json();

    if (!data.success) {
      console.warn('❌ Turnstile failed:', data['error-codes']);
      return res.status(403).json({ error: 'CAPTCHA verification failed. Please try again.' });
    }

    next();
  } catch (err) {
    console.error('Turnstile verify error:', err.message);
    return res.status(500).json({ error: 'CAPTCHA service unavailable. Please try again.' });
  }
}

module.exports = verifyTurnstile;