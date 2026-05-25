const mysql = require('mysql2/promise');

(async function() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'barangay_system',
      waitForConnections: true,
      connectionLimit: 10
    });

    console.log('Creating `employees` table (if not exists)...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        resident_id INT NOT NULL UNIQUE,
        employee_number VARCHAR(50) UNIQUE,
        role VARCHAR(100),
        status ENUM('active','inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_emp_resident FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('Inserting employees for residents with RFID (if not already present)...');
    const [residents] = await pool.query("SELECT id, full_name, rfid_card_number FROM residents WHERE rfid_card_number IS NOT NULL AND rfid_card_number <> ''");

    let created = 0;
    for (const r of residents) {
      const [exists] = await pool.query('SELECT id FROM employees WHERE resident_id = ?', [r.id]);
      if (exists.length > 0) continue;

      const empNo = 'EMP-' + String(r.id).padStart(5, '0');
      await pool.execute('INSERT INTO employees (resident_id, employee_number, role, status) VALUES (?, ?, ?, ?)', [r.id, empNo, 'staff', 'active']);
      created++;
    }

    console.log(`Added ${created} employee record(s).`);

    const [rows] = await pool.query('SELECT e.id,e.employee_number,e.role,e.status,e.created_at,r.id as resident_id,r.full_name,r.rfid_card_number FROM employees e JOIN residents r ON e.resident_id = r.id LIMIT 10');
    console.log('Sample employees:', JSON.stringify(rows, null, 2));

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
