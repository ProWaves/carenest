const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const esc = (val) => {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'object') return "'" + JSON.stringify(val).replace(/'/g, "''") + "'";
  return "'" + String(val).replace(/'/g, "''") + "'";
};

(async () => {
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );

  let sql = '-- ==========================================\n';
  sql += '-- CareNest Database Full Export\n';
  sql += '-- Generated: ' + new Date().toISOString() + '\n';
  sql += '-- ==========================================\n\n';
  sql += 'SET statement_timeout = 0;\n';
  sql += 'SET lock_timeout = 0;\n';
  sql += "SET client_encoding = 'UTF8';\n";
  sql += 'SET standard_conforming_strings = on;\n\n';

  for (const t of tables.rows) {
    const table = t.table_name;

    sql += '-- ----------------------------------------\n';
    sql += '-- Table: ' + table + '\n';
    sql += '-- ----------------------------------------\n\n';

    // Get column info
    const cols = await pool.query(
      `SELECT column_name, column_default, is_nullable, data_type, character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );

    // Get constraints
    const constraints = await pool.query(
      `SELECT tc.constraint_name, tc.constraint_type,
              kcu.column_name,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
       LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
       WHERE tc.table_schema = 'public' AND tc.table_name = $1`,
      [table]
    );

    // Get check constraints
    const checks = await pool.query(
      `SELECT conname, pg_get_constraintdef(oid) as consrc
       FROM pg_constraint
       WHERE contype = 'c' AND conrelid = (SELECT oid FROM pg_class WHERE relname = $1)`,
      [table]
    );

    // Get sequences
    const seqs = await pool.query(
      `SELECT column_name, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
         AND column_default LIKE '%nextval%'`,
      [table]
    );

    sql += 'DROP TABLE IF EXISTS "' + table + '" CASCADE;\n';

    // CREATE TABLE
    sql += 'CREATE TABLE "' + table + '" (\n';
    const colDefs = [];

    for (const c of cols.rows) {
      let def = '  "' + c.column_name + '" ' + c.data_type;
      if (c.character_maximum_length) {
        def += '(' + c.character_maximum_length + ')';
      }
      if (c.column_default && !c.column_default.includes('nextval')) {
        def += ' DEFAULT ' + c.column_default;
      }
      if (c.is_nullable === 'NO') {
        def += ' NOT NULL';
      }
      colDefs.push(def);
    }

    // Add PRIMARY KEY constraints
    for (const con of constraints.rows) {
      if (con.constraint_type === 'PRIMARY KEY') {
        colDefs.push('  CONSTRAINT "' + con.constraint_name + '" PRIMARY KEY ("' + con.column_name + '")');
      }
    }

    // Add UNIQUE constraints
    for (const con of constraints.rows) {
      if (con.constraint_type === 'UNIQUE') {
        colDefs.push('  CONSTRAINT "' + con.constraint_name + '" UNIQUE ("' + con.column_name + '")');
      }
    }

    // Add FOREIGN KEY constraints
    for (const con of constraints.rows) {
      if (con.constraint_type === 'FOREIGN KEY') {
        colDefs.push('  CONSTRAINT "' + con.constraint_name + '" FOREIGN KEY ("' + con.column_name + '") REFERENCES "' + con.foreign_table_name + '"("' + con.foreign_column_name + '") ON DELETE CASCADE');
      }
    }

    // Add CHECK constraints
    for (const ch of checks.rows) {
      let checkDef = ch.consrc;
      if (checkDef.startsWith('CHECK ')) checkDef = checkDef.substring(6);
      colDefs.push('  CONSTRAINT "' + ch.conname + '" CHECK ' + checkDef);
    }

    sql += colDefs.join(',\n');
    sql += '\n);\n\n';

    // Auto-increment sequences (for SERIAL columns)
    for (const s of seqs.rows) {
      const seqName = s.column_default;
      // extract sequence name from default like nextval('users_id_seq'::regclass)
      const match = seqName.match(/'([^']+)'/);
      if (match) {
        sql += "CREATE SEQUENCE IF NOT EXISTS " + match[1] + " OWNED BY \"" + table + "\".\"" + s.column_name + "\";\n";
      }
    }

    // Get data
    const data = await pool.query('SELECT * FROM "' + table + '" ORDER BY 1');
    if (data.rows.length > 0) {
      const colNames = Object.keys(data.rows[0]).map(n => '"' + n + '"').join(', ');
      sql += 'INSERT INTO "' + table + '" (' + colNames + ') VALUES\n';
      const valueRows = data.rows.map(row => {
        const vals = Object.values(row).map(v => esc(v));
        return '(' + vals.join(', ') + ')';
      });
      sql += valueRows.join(',\n');
      sql += ';\n';

      // Set sequence value
      for (const s of seqs.rows) {
        const match = s.column_default.match(/'([^']+)'/);
        if (match) {
          sql += "SELECT setval('" + match[1] + "', (SELECT MAX(\"" + s.column_name + "\") FROM \"" + table + "\"));\n";
        }
      }
      sql += '\n';
    }
  }

  sql += '-- ==========================================\n';
  sql += '-- End of Export\n';
  sql += '-- ==========================================\n';

  console.log(sql);
  await pool.end();
})().catch(err => { console.error(err.message); process.exit(1); });
