const mysql = require('mysql2/promise');

async function test() {
    try {
        const conn = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'barangay_system'
        });
        
        console.log('Connected to database');
        
        console.log('employee_schedules table checks skipped (module removed)');
        
        // Show all tables
        const [tables] = await conn.execute(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'barangay_system'
            ORDER BY TABLE_NAME
        `);
        
        console.log('\n✓ All tables in database:');
        tables.forEach(t => console.log(`  - ${t.TABLE_NAME}`));
        
        await conn.end();
    } catch(e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

test();
