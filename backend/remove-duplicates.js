const mysql = require('mysql2/promise');

async function removeOutRecordDuplicates() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'barangay_system'
  });

  try {
    // For each resident/date combination, keep only the IN record if there are both IN and OUT
    const [sessionPairs] = await connection.execute(`
      SELECT resident_id, DATE(scan_time) as scan_date, 
             MAX(CASE WHEN scan_type = 'IN' THEN id END) as in_id,
             MAX(CASE WHEN scan_type = 'OUT' THEN id END) as out_id
      FROM attendance
      WHERE deleted_at IS NULL
      GROUP BY resident_id, DATE(scan_time)
      HAVING in_id IS NOT NULL AND out_id IS NOT NULL
    `);

    if (sessionPairs.length > 0) {
      console.log(`Found ${sessionPairs.length} sessions with duplicate IN/OUT pairs`);
      
      // Delete the OUT records (keep the updated IN records)
      const outIds = sessionPairs.map(p => p.out_id);
      
      const [result] = await connection.execute(`
        DELETE FROM attendance WHERE id IN (${outIds.join(',')})
      `);
      
      console.log(`Deleted ${result.affectedRows} OUT record duplicates`);
    } else {
      console.log('No duplicate IN/OUT pairs found');
    }

    // Show final record count by type
    const [stats] = await connection.execute(`
      SELECT scan_type, COUNT(*) as count FROM attendance
      WHERE deleted_at IS NULL
      GROUP BY scan_type
    `);

    console.log('\nFinal record count:');
    stats.forEach(s => {
      console.log(`${s.scan_type}: ${s.count} records`);
    });

    const [total] = await connection.execute(`
      SELECT COUNT(*) as count FROM attendance WHERE deleted_at IS NULL
    `);
    console.log(`Total: ${total[0].count} records`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

removeOutRecordDuplicates();
