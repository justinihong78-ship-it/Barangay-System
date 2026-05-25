const mysql = require('mysql2/promise');

async function fixStatusValues() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'barangay_system'
  });

  try {
    // Update old records with uppercase statuses and NULL statuses
    const [result] = await connection.execute(`
      UPDATE attendance 
      SET attendance_status = CASE 
        WHEN scan_type = 'IN' THEN 'In'
        WHEN UPPER(attendance_status) = 'OVERTIME' THEN 'Overtime'
        WHEN UPPER(attendance_status) = 'UNDERTIME' THEN 'Undertime'
        WHEN UPPER(attendance_status) = 'ON_TIME' THEN 'On Time'
        WHEN attendance_status IS NULL AND scan_type = 'IN' THEN 'In'
        WHEN attendance_status IS NULL AND scan_type = 'OUT' THEN 'Undertime'
        ELSE attendance_status
      END
      WHERE attendance_status IS NULL 
         OR UPPER(attendance_status) IN ('OVERTIME', 'UNDERTIME', 'ON_TIME', 'LATE', 'NOT_LATE');
    `);

    console.log(`Updated ${result.changedRows} records with correct status values`);
    
    // Verify the fix
    const [rows] = await connection.execute(`
      SELECT COUNT(*) as count, attendance_status 
      FROM attendance 
      WHERE deleted_at IS NULL
      GROUP BY attendance_status
    `);
    
    console.log('\nStatus distribution after fix:');
    rows.forEach(row => {
      console.log(`${row.attendance_status}: ${row.count} records`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

fixStatusValues();
