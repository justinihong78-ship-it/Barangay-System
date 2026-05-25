const mysql = require('mysql2/promise');

async function insertTestData() {
    try {
        const conn = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'barangay_system'
        });
        
        console.log('Connected to database');
        
        // Insert a test resident
        console.log('\nInserting test resident...');
        const insertResident = `
            INSERT INTO residents (full_name, email, phone, address, barangay, gender, category, date_of_birth, rfid_card_number, status, created_at)
            VALUES ('John Doe', 'john@example.com', '09123456789', '123 Main Street', 'Example Barangay', 'male', 'regular', '1990-01-15', 'RFID001', 'active', NOW())
        `;
        
        const [result] = await conn.execute(insertResident);
        const residentId = result.insertId;
        console.log(`✓ Test resident inserted with ID: ${residentId}`);
        
        // Insert sample attendance records
        console.log('\nInserting sample attendance records...');
        const insertAttendance = `
            INSERT INTO attendance (resident_id, scan_time, scan_type, rfid_card_number, notes, created_at, deleted_at)
            VALUES 
            (?, DATE_SUB(NOW(), INTERVAL 3 DAY), 'IN', 'RFID001', 'NOT_LATE', NOW(), NULL),
            (?, DATE_SUB(NOW(), INTERVAL 3 DAY), 'OUT', 'RFID001', 'NOT_LATE', NOW(), NULL),
            (?, DATE_SUB(NOW(), INTERVAL 2 DAY), 'IN', 'RFID001', 'NOT_LATE', NOW(), NULL),
            (?, DATE_SUB(NOW(), INTERVAL 2 DAY), 'OUT', 'RFID001', 'NOT_LATE', NOW(), NULL),
            (?, DATE_SUB(NOW(), INTERVAL 1 DAY), 'IN', 'RFID001', 'NOT_LATE', NOW(), NULL),
            (?, DATE_SUB(NOW(), INTERVAL 1 DAY), 'OUT', 'RFID001', 'NOT_LATE', NOW(), NULL),
            (?, NOW(), 'IN', 'RFID001', 'NOT_LATE', NOW(), NULL)
        `;
        
        const params = Array(7).fill(residentId);
        const [attResult] = await conn.execute(insertAttendance, params);
        console.log(`✓ ${attResult.affectedRows} attendance records inserted`);
        
        // Display the inserted data
        console.log('\n=== Inserted Test Data ===\n');
        
        const [residents] = await conn.execute(
            'SELECT id, full_name, email, phone, rfid_card_number, status FROM residents WHERE id = ?',
            [residentId]
        );
        
        console.log('Resident:');
        if (residents.length > 0) {
            const r = residents[0];
            console.log(`  ID: ${r.id}`);
            console.log(`  Name: ${r.full_name}`);
            console.log(`  Email: ${r.email}`);
            console.log(`  Phone: ${r.phone}`);
            console.log(`  RFID Card: ${r.rfid_card_number}`);
            console.log(`  Status: ${r.status}`);
        }
        
        const [attendance] = await conn.execute(
            'SELECT id, resident_id, scan_time, scan_type, rfid_card_number FROM attendance WHERE resident_id = ? ORDER BY scan_time DESC LIMIT 10',
            [residentId]
        );
        
        console.log('\nAttendance Records:');
        attendance.forEach((att, idx) => {
            console.log(`  ${idx + 1}. ID: ${att.id}, Scan Time: ${att.scan_time}, Type: ${att.scan_type}`);
        });
        
        console.log('\n✓ Test data insertion completed successfully!');
        await conn.end();
        
    } catch(e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

insertTestData();
