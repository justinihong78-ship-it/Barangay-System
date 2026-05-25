// Script to free up Barangay Captain position by soft-deleting the current holder
const mysql = require('mysql2/promise');

async function freeUpPosition() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'barangay_system'
  });

  try {
    console.log('Freeing up Barangay Captain position...\n');

    // Find current Barangay Captain
    const [current] = await connection.execute(
      'SELECT id, full_name, position FROM residents WHERE position = ? AND deleted_at IS NULL',
      ['Barangay Captain (Punong Barangay)']
    );

    if (current.length === 0) {
      console.log('✅ Barangay Captain position is already free!');
      await connection.end();
      return;
    }

    console.log(`Current Barangay Captain: ${current[0].full_name} (ID: ${current[0].id})`);
    console.log('Setting deleted_at to mark as soft-deleted...\n');

    // Soft delete the current Barangay Captain
    const result = await connection.execute(
      'UPDATE residents SET deleted_at = NOW() WHERE id = ? AND position = ?',
      [current[0].id, 'Barangay Captain (Punong Barangay)']
    );

    console.log(`✅ Successfully marked for deletion:`);
    console.log(`  Resident: ${current[0].full_name}`);
    console.log(`  Position freed: Barangay Captain (Punong Barangay)\n`);

    // Verify the position is now free
    const [check] = await connection.execute(
      'SELECT COUNT(*) as active_count FROM residents WHERE position = ? AND deleted_at IS NULL',
      ['Barangay Captain (Punong Barangay)']
    );

    if (check[0].active_count === 0) {
      console.log('✅ Barangay Captain position is now FREE for new registration!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

freeUpPosition();
