const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'barangay_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

async function initDatabase() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });

        console.log('Connected to MySQL server');

        // Create database if not exists
        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
        console.log('✓ Database created/verified');

        // Select database
        await connection.execute(`USE ${dbConfig.database}`);

        // employee_schedules table intentionally removed (no longer used)

        // Verify other essential tables exist
        const [tables] = await connection.execute(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = '${dbConfig.database}'
        `);

        console.log('\n✓ Database initialized successfully!');
        console.log('Tables in database:');
        tables.forEach(table => console.log(`  - ${table.TABLE_NAME}`));

        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('✗ Database initialization failed:', error.message);
        if (connection) await connection.end();
        process.exit(1);
    }
}

initDatabase();
