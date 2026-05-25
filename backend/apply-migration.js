// Script to apply database schema migration for Work Hours and Status tracking
// Run with: node apply-migration.js

const mysql = require('mysql2/promise');

async function applyMigration() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // Update if you have a password
    database: 'barangay_system'
  });

  try {
    console.log('Starting migration for attendance and residents tables...\n');

    // Add columns if they don't exist
    const migrations = [
      "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_in TIMESTAMP NULL AFTER scan_time;",
      "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_out TIMESTAMP NULL AFTER time_in;",
      "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS work_hours DECIMAL(5,2) AFTER time_out;",
      "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS attendance_status VARCHAR(20) AFTER work_hours;",
      "ALTER TABLE attendance ADD INDEX IF NOT EXISTS idx_resident_id (resident_id);",
      "ALTER TABLE residents ADD COLUMN IF NOT EXISTS position VARCHAR(100) AFTER category;",
      "ALTER TABLE residents ADD COLUMN IF NOT EXISTS civil_status VARCHAR(50) AFTER position;",
      "ALTER TABLE residents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at;"
    ];

    for (const migration of migrations) {
      try {
        console.log(`Executing: ${migration}`);
        await connection.execute(migration);
        console.log('✅ Migration applied successfully\n');
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log('⚠️  Column already exists\n');
        } else {
          throw error;
        }
      }
    }

    // Verify schema
    console.log('Verifying schema...\n');
    const [rows] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'attendance' AND TABLE_SCHEMA = 'barangay_system' 
       ORDER BY ORDINAL_POSITION`
    );

    console.log('Current Attendance Table Columns:');
    rows.forEach(row => {
      console.log(`  - ${row.COLUMN_NAME}: ${row.COLUMN_TYPE}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\nRequired columns are now present:');
    console.log('  ✓ Attendance: time_in, time_out, work_hours, attendance_status');
    console.log('  ✓ Residents: position, deleted_at');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await connection.end();
  }
}

applyMigration();
