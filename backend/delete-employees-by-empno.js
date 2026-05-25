const mysql = require('mysql2/promise');

(async function() {
  try {
    const pool = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'barangay_system'
    });

    const [before] = await pool.query('SELECT COUNT(*) as c FROM employees');
    console.log('Before count:', before[0].c);

    const [result] = await pool.execute("DELETE FROM employees WHERE employee_number LIKE 'EMP-%'");
    console.log('Deleted rows:', result.affectedRows);

    const [after] = await pool.query('SELECT COUNT(*) as c FROM employees');
    console.log('After count:', after[0].c);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
