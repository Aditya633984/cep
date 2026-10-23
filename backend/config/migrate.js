'use strict';

/**
 * FoodBridge – Database Migration Runner
 * Executes pending database migrations against MySQL if configured,
 * or validates the mock store schema.
 */

const fs = require('fs');
const path = require('path');
const { pool, testConnection } = require('./db');

async function runMigrations() {
  console.log('🔄 Checking FoodBridge database migrations...');

  try {
    const connCheck = await testConnection();
    if (connCheck && connCheck.mode === 'mock') {
      console.log('📦 Mock Data Store active: in-memory verification tokens schema is already initialized.');
      return;
    }

    const conn = await pool.getConnection();
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        console.log(`➡️  Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        // Split queries by semicolon if multiple
        const queries = sql
          .split(';')
          .map(q => q.trim())
          .filter(q => q.length > 0 && !q.startsWith('--'));

        for (const query of queries) {
          try {
            await conn.query(query);
          } catch (err) {
            // Tolerate already existing columns/indices in MySQL versions without IF NOT EXISTS
            if (!err.message.includes('Duplicate column') && !err.message.includes('already exists')) {
              console.warn(`Warning on statement: ${err.message}`);
            }
          }
        }
        console.log(`✅ Completed migration: ${file}`);
      }
    }
    conn.release();
    console.log('✨ All migrations completed successfully.');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

if (require.main === module) {
  runMigrations().then(() => process.exit(0));
}

module.exports = { runMigrations };
