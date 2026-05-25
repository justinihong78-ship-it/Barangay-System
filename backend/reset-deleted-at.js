// Script to reset deleted_at column for active residents
const mysql = require('mysql2/promise');

async function resetDeletedAt() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'barangay_system'
  });

  try {
    console.log('Starting reset of deleted_at column...\n');

    // First, check current state
    const [currentState] = await connection.execute(
      'SELECT COUNT(*) as total, SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active, SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted FROM residents'
    );
    console.log('Current State:');
    console.log(`  Total residents: ${currentState[0].total}`);
    console.log(`  Active (deleted_at IS NULL): ${currentState[0].active}`);
    console.log(`  Deleted (deleted_at IS NOT NULL): ${currentState[0].deleted}\n`);

    // Reset all non-inactive residents to have deleted_at = NULL
    const result = await connection.execute(
      'UPDATE residents SET deleted_at = NULL WHERE status != ? OR status IS NULL',
      ['inactive']
    );

    console.log(`✅ Reset completed:`);
    console.log(`  Updated ${result[0].changedRows} records\n`);

    // Verify the reset
    const [newState] = await connection.execute(
      'SELECT COUNT(*) as total, SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active, SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted FROM residents'
    );
    console.log('After Reset:');
    console.log(`  Total residents: ${newState[0].total}`);
    console.log(`  Active (deleted_at IS NULL): ${newState[0].active}`);
    console.log(`  Deleted (deleted_at IS NOT NULL): ${newState[0].deleted}\n`);

    // Show all residents now
    const [residents] = await connection.execute(
      'SELECT id, full_name, position, status, deleted_at FROM residents ORDER BY id DESC'
    );
    console.log('All Residents:');
    console.table(residents);

    console.log('\n✅ All active residents are now available for registration!');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

resetDeletedAt();
