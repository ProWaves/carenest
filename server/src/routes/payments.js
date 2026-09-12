// server/src/routes/payments.js
// ==========================================================================
// Wallet, bank accounts, withdrawals, and "mark as paid" endpoints.
//
// Flow:
//  1. Parent books → payment_method saved on the booking.
//  2. Babysitter completes booking → status = 'completed'.
//  3. Babysitter taps "Mark Received" → payment_status = 'paid',
//     wallet credited with total_amount, ledger row inserted.
//  4. Babysitter requests withdrawal → wallet balance reduced,
//     withdrawal row created with status = 'pending'.
//  5. Admin marks it paid offline → status = 'paid'.
// ==========================================================================
const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification } = require('./notifications');

const router = express.Router();

// ============================================
// HELPER: ensure a wallet row exists for a user
// ============================================
async function ensureWallet(client, userId) {
  // Uses the passed client so it can participate in an existing transaction
  const q = client || db;
  await q.query(
    `INSERT INTO wallets (user_id, balance) VALUES ($1, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

// ============================================
// 1. MARK BOOKING AS PAID
// ============================================
// Called by the babysitter when they receive the money (cash or bank transfer).
// Credits their wallet and writes a ledger entry.
router.put('/bookings/:id/mark-paid', authenticate, authorize('babysitter'), async (req, res) => {
  const bookingId = req.params.id;
  const { note } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Load the booking with a row lock
    const bookingRes = await client.query(
      'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );

    if (bookingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const booking = bookingRes.rows[0];

    if (booking.babysitter_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not your booking.' });
    }

    if (booking.status !== 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only completed bookings can be marked as paid.' });
    }

    if (booking.payment_status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Booking is already marked as paid.' });
    }

    // Mark the booking as paid
    const updated = await client.query(
      `UPDATE bookings
       SET payment_status = 'paid',
           paid_at = CURRENT_TIMESTAMP,
           paid_confirmed_by = $1,
           paid_note = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [req.user.id, note || null, bookingId]
    );

    // Ensure wallet exists
    await ensureWallet(client, req.user.id);

    // Credit the wallet
    await client.query(
      `UPDATE wallets
       SET balance = balance + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [booking.total_amount, req.user.id]
    );

    // Ledger entry
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, booking_id, note)
       VALUES ($1, 'booking_earning', $2, $3, $4)`,
      [req.user.id, booking.total_amount, bookingId, note || null]
    );

    await client.query('COMMIT');

    // Notify the parent
    await createNotification(
      booking.parent_id,
      'payment_received',
      '💰 Payment Confirmed',
      `Your babysitter has confirmed receipt of $${parseFloat(booking.total_amount).toFixed(2)}.`,
      '/dashboard?tab=bookings'
    );

    res.json({
      message: 'Payment confirmed and wallet credited.',
      booking: updated.rows[0],
      credited: parseFloat(booking.total_amount),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ mark-paid error:', err);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    client.release();
  }
});

// ============================================
// 2. GET MY WALLET
// ============================================
router.get('/wallet', authenticate, async (req, res) => {
  try {
    await ensureWallet(null, req.user.id);

    const walletRes = await db.query(
      'SELECT balance, updated_at FROM wallets WHERE user_id = $1',
      [req.user.id]
    );

    const txRes = await db.query(
      `SELECT id, type, amount, booking_id, withdrawal_id, note, created_at
       FROM wallet_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.id]
    );

    res.json({
      balance: parseFloat(walletRes.rows[0]?.balance || 0),
      updated_at: walletRes.rows[0]?.updated_at || null,
      transactions: txRes.rows,
    });
  } catch (err) {
    console.error('❌ get wallet error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// 3. BANK ACCOUNTS
// ============================================
// List
router.get('/bank-accounts', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, bank_name, holder_name, iban, is_default, created_at
       FROM bank_accounts
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ list bank accounts error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Create
router.post('/bank-accounts', authenticate, authorize('babysitter'), async (req, res) => {
  const { bank_name, holder_name, iban, is_default } = req.body;

  if (!bank_name || !holder_name || !iban) {
    return res.status(400).json({ error: 'bank_name, holder_name, and iban are required.' });
  }

  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // If this is the first account, force it default
      const existing = await client.query(
        'SELECT COUNT(*)::int AS c FROM bank_accounts WHERE user_id = $1',
        [req.user.id]
      );
      const shouldBeDefault = is_default === true || existing.rows[0].c === 0;

      if (shouldBeDefault) {
        await client.query(
          'UPDATE bank_accounts SET is_default = false WHERE user_id = $1',
          [req.user.id]
        );
      }

      const result = await client.query(
        `INSERT INTO bank_accounts (user_id, bank_name, holder_name, iban, is_default)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, bank_name, holder_name, iban, is_default, created_at`,
        [req.user.id, bank_name.trim(), holder_name.trim(), iban.trim(), shouldBeDefault]
      );

      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ create bank account error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Delete
router.delete('/bank-accounts/:id', authenticate, authorize('babysitter'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'DELETE FROM bank_accounts WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bank account not found.' });
    }
    res.json({ message: 'Bank account removed.' });
  } catch (err) {
    console.error('❌ delete bank account error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// 4. WITHDRAWALS
// ============================================
// Babysitter requests a withdrawal
router.post('/withdrawals', authenticate, authorize('babysitter'), async (req, res) => {
  const { amount, bank_account_id } = req.body;

  const amt = parseFloat(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ error: 'A positive amount is required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure wallet exists
    await ensureWallet(client, req.user.id);

    // Lock the wallet row
    const walletRes = await client.query(
      'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
      [req.user.id]
    );
    const balance = parseFloat(walletRes.rows[0].balance);

    if (amt > balance) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient balance. Available: $${balance.toFixed(2)}` });
    }

    // Validate the bank account
    const baRes = await client.query(
      'SELECT id, is_default FROM bank_accounts WHERE id = $1 AND user_id = $2',
      [bank_account_id, req.user.id]
    );
    if (baRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid bank account.' });
    }

    // Reduce wallet balance
    await client.query(
      `UPDATE wallets
       SET balance = balance - $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [amt, req.user.id]
    );

    // Create the withdrawal
    const wdRes = await client.query(
      `INSERT INTO withdrawals (user_id, amount, bank_account_id, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [req.user.id, amt, bank_account_id]
    );

    const withdrawal = wdRes.rows[0];

    // Ledger entry
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, withdrawal_id, note)
       VALUES ($1, 'withdrawal', $2, $3, $4)`,
      [req.user.id, -amt, withdrawal.id, 'Withdrawal request']
    );

    await client.query('COMMIT');

    // Notify the user + all admins
    await createNotification(
      req.user.id,
      'withdrawal_requested',
      '💸 Withdrawal Requested',
      `Your withdrawal of $${amt.toFixed(2)} is pending admin approval.`,
      '/dashboard?tab=payouts'
    );

    const admins = await db.query("SELECT id FROM users WHERE role = 'admin' AND is_active = true");
    for (const admin of admins.rows) {
      await createNotification(
        admin.id,
        'new_withdrawal',
        '💸 New Withdrawal Request',
        `${req.user.first_name} ${req.user.last_name} requested $${amt.toFixed(2)}.`,
        '/dashboard?tab=payouts'
      );
    }

    res.status(201).json(withdrawal);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ create withdrawal error:', err);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    client.release();
  }
});

// Babysitter's own withdrawal history
router.get('/withdrawals/my', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT w.*, ba.bank_name, ba.holder_name, ba.iban
       FROM withdrawals w
       JOIN bank_accounts ba ON ba.id = w.bank_account_id
       WHERE w.user_id = $1
       ORDER BY w.requested_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ my withdrawals error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;