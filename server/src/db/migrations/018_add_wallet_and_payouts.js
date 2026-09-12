// server/src/db/migrations/018_add_wallet_and_payouts.js
// ==========================================================================
// Creates the wallet and payout system for babysitters:
//
//   wallets             → one row per babysitter, tracks current balance
//   wallet_transactions → append-only ledger of every credit/debit
//   bank_accounts       → where a babysitter wants to receive money
//   withdrawals         → requests to move money from wallet to bank
//
// Money only becomes real (in the wallet) when the babysitter confirms
// they have received cash or a bank transfer for a completed booking.
// ==========================================================================
const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 018_add_wallet_and_payouts');

    // ============================================
    // 1. WALLETS
    // ============================================
    await db.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        balance DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created wallets table');

    // ============================================
    // 2. WALLET TRANSACTIONS (append-only ledger)
    // ============================================
    await db.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL
          CHECK (type IN ('booking_earning', 'withdrawal', 'adjustment')),
        amount DECIMAL(10,2) NOT NULL,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        withdrawal_id INTEGER,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created wallet_transactions table');

    // Index for fast history lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_tx_user
      ON wallet_transactions(user_id, created_at DESC);
    `);
    console.log('✅ Created index on wallet_transactions');

    // ============================================
    // 3. BANK ACCOUNTS
    // ============================================
    await db.query(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        bank_name VARCHAR(100) NOT NULL,
        holder_name VARCHAR(100) NOT NULL,
        iban VARCHAR(50) NOT NULL,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created bank_accounts table');

    // ============================================
    // 4. WITHDRAWALS
    // ============================================
    await db.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
        bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE RESTRICT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
        admin_notes TEXT,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    console.log('✅ Created withdrawals table');

    // Index for admin dashboard filtering
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_withdrawals_status
      ON withdrawals(status, requested_at DESC);
    `);
    console.log('✅ Created index on withdrawals');

    // ============================================
    // 5. FOREIGN KEY: wallet_transactions.withdrawal_id → withdrawals.id
    // (added separately so we can reference the withdrawals table)
    // ============================================
    try {
      await db.query(`
        ALTER TABLE wallet_transactions
        ADD CONSTRAINT wallet_tx_withdrawal_fk
        FOREIGN KEY (withdrawal_id) REFERENCES withdrawals(id) ON DELETE SET NULL;
      `);
      console.log('✅ Linked wallet_transactions.withdrawal_id → withdrawals.id');
    } catch (err) {
      // Already exists
      if (err.code === '42710' || err.message.includes('already exists')) {
        console.log('ℹ️ wallet_tx_withdrawal_fk already exists');
      } else {
        throw err;
      }
    }

    console.log('✅ Migration 018 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();