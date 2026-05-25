const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({host:'localhost', user:'root', password:'', database:'barangay_system'});
    
    console.log('=== All Residents (including soft-deleted) ===');
    const [allResidents] = await conn.execute('SELECT id, full_name, position, status, deleted_at FROM residents ORDER BY id DESC LIMIT 10');
    console.table(allResidents);
    
    console.log('\n=== Active Residents Only (deleted_at IS NULL) ===');
    const [activeResidents] = await conn.execute('SELECT id, full_name, position, status FROM residents WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 10');
    console.table(activeResidents);
    
    console.log('\n=== Check Barangay Captain Position ===');
    const [captainCheck] = await conn.execute("SELECT id, full_name, position, status, deleted_at FROM residents WHERE position LIKE '%Barangay Captain%' ORDER BY id DESC");
    console.table(captainCheck);
    
    await conn.end();
  } catch(e) { console.error('Error:', e.message); }
})();
