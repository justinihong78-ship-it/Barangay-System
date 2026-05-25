const mysql = require('mysql2/promise');

(async function() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'barangay_system'
    });

    const tables = ['employees','employee_schedules'];
    for (const t of tables) {
      const [exists] = await pool.query("SHOW TABLES LIKE ?", [t]);
      if (exists.length === 0) {
        console.log('Table ' + t + ' does not exist, skipping.');
        continue;
      }
      const [countRows] = await pool.query('SELECT COUNT(*) as c FROM ' + t);
      console.log('Table ' + t + ' exists, rows=' + countRows[0].c + '. Dropping...');
      await pool.execute('DROP TABLE IF EXISTS ' + t);
      console.log('Dropped ' + t + '.');
    }

    const [remaining] = await pool.query("SHOW TABLES");
    console.log('Remaining tables (sample):', JSON.stringify(remaining.slice(0,50), null, 2));

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
