const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({host:'localhost', user:'root', password:'', database:'barangay_system'});
    
    console.log('=== Checking Barangay Captain Position ===');
    const [captain] = await conn.execute(
      'SELECT id, full_name, position, status, deleted_at FROM residents WHERE position LIKE ? AND deleted_at IS NULL',
      ['%Barangay Captain%']
    );
    
    if(captain.length > 0) {
      console.log('FOUND - Active Barangay Captain:');
      console.table(captain);
    } else {
      console.log('NO ACTIVE BARANGAY CAPTAIN - Registration should work');
    }
    
    console.log('\n=== All Active Residents with Positions ===');
    const [allActive] = await conn.execute(
      'SELECT id, full_name, position, status FROM residents WHERE deleted_at IS NULL AND position IS NOT NULL ORDER BY id'
    );
    console.table(allActive);
    
    await conn.end();
  } catch(e) { console.error('Error:', e.message); }
})();
