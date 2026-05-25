const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const { authenticateToken, requireDatabase } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Static files for QR codes
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Server-Sent Events clients container
app.locals.sseClients = [];

app.locals.broadcastOfficialStatus = function (data) {
  const payload = `event: official\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of app.locals.sseClients.slice()) {
    try {
      res.write(payload);
    } catch (e) {
      // remove dead clients
      const idx = app.locals.sseClients.indexOf(res);
      if (idx !== -1) app.locals.sseClients.splice(idx, 1);
    }
  }
};

// Database connection
let db;
async function ensureOfficialsTable() {
  if (!db) return;

  await db.execute(`
    CREATE TABLE IF NOT EXISTS officials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      avatar VARCHAR(5),
      name VARCHAR(100) NOT NULL,
      position VARCHAR(100) NOT NULL,
      term VARCHAR(100) NOT NULL,
      contact VARCHAR(50) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      status ENUM('Active', 'Inactive') DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await db.execute('SELECT COUNT(*) as count FROM officials');
  if (rows[0].count === 0) {
    await db.execute(
      `INSERT IGNORE INTO officials (avatar, name, position, term, contact, email, status) VALUES
        (?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?)`,
      [
        'C', 'Cedric Gem Barimbao', 'Chairman', 'May 01, 2026 - Apr 30, 2030', '+63 912 345 6789', 'cedric.barimbao@barangay.ph', 'Active',
        'J', 'Justeen Limpag', 'Kagawad', 'May 01, 2026 - Apr 30, 2030', '+63 917 555 1234', 'justeen.limpag@barangay.ph', 'Active',
        'V', 'Vince Bryan Caasalan', 'Kagawad', 'May 01, 2026 - Apr 30, 2030', '+63 918 777 4321', 'vince.caasalan@barangay.ph', 'Active',
        'J', 'Justin Ihong', 'Kagawad', 'May 01, 2026 - Apr 30, 2030', '+63 919 888 5678', 'justin.ihong@barangay.ph', 'Active'
      ]
    );
  }
}

async function ensureAdminColumns() {
  if (!db) return;

  const columnsToAdd = [
    { name: 'phone', type: 'VARCHAR(20)' },
    { name: 'address', type: 'TEXT' },
    { name: 'barangay', type: 'VARCHAR(100)' },
    { name: 'date_of_birth', type: 'DATE' },
    { name: 'position', type: 'VARCHAR(100)' },
    { name: 'status', type: "VARCHAR(20) DEFAULT 'Inactive'" }
  ];

  for (const column of columnsToAdd) {
    const [rows] = await db.execute(`SHOW COLUMNS FROM admins LIKE ${mysql.escape(column.name)}`);
    if (rows.length === 0) {
      await db.execute(`ALTER TABLE admins ADD COLUMN ${column.name} ${column.type}`);
    }
  }
}

async function ensureAttendanceSoftDeleteColumn() {
  if (!db) return;

  const [rows] = await db.execute(`SHOW COLUMNS FROM attendance LIKE ${mysql.escape('deleted_at')}`);
  if (rows.length === 0) {
    await db.execute('ALTER TABLE attendance ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL');
  }
}

async function ensureResidentColumns() {
  if (!db) return;

  const columnsToAdd = [
    { name: 'position', type: 'VARCHAR(100)' },
    { name: 'civil_status', type: 'VARCHAR(50)' }
  ];

  for (const column of columnsToAdd) {
    const [rows] = await db.execute(`SHOW COLUMNS FROM residents LIKE ${mysql.escape(column.name)}`);
    if (rows.length === 0) {
      await db.execute(`ALTER TABLE residents ADD COLUMN ${column.name} ${column.type}`);
    }
  }
}

async function ensureResidentSoftDeleteColumn() {
  if (!db) return;

  const [rows] = await db.execute(`SHOW COLUMNS FROM residents LIKE ${mysql.escape('deleted_at')}`);
  if (rows.length === 0) {
    await db.execute('ALTER TABLE residents ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL');
  }
}

async function ensureDefaultData() {
  if (!db) return;

  try {
    // Ensure default admin exists
    const [adminRows] = await db.execute('SELECT COUNT(*) as count FROM admins WHERE username = ? OR email = ?', ['admin', 'admin@barangay.com']);
    if (adminRows[0].count === 0) {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('password', 10);
      await db.execute(
        'INSERT IGNORE INTO admins (username, email, password, full_name) VALUES (?, ?, ?, ?)',
        ['admin', 'admin@barangay.com', hashedPassword, 'System Administrator']
      );
      console.log('Default admin account created');
    }

    // Ensure sample residents exist (only if table is empty)
    const [residentRows] = await db.execute('SELECT COUNT(*) as count FROM residents');
    if (residentRows[0].count === 0) {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('password', 10);

      const sampleResidents = [
        ['Juan Dela Cruz', 'juan.delacruz@example.com', '+63 912 345 6789', 'Male', '123 Main Street, Barangay 1', 'Barangay 1', 'Regular Resident', '1990-01-15', 'CARD-29674-15719'],
        ['Maria Santos', 'maria.santos@example.com', '+63 917 555 1234', 'Female', '456 Oak Avenue, Barangay 2', 'Barangay 2', 'Senior Citizen', '1955-03-20', 'CARD-12345-67890'],
        ['Pedro Reyes', 'pedro.reyes@example.com', '+63 918 777 4321', 'Male', '789 Pine Road, Barangay 3', 'Barangay 3', 'PWD', '1985-07-10', 'CARD-54321-09876']
      ];

      for (const resident of sampleResidents) {
        await db.execute(
          'INSERT INTO residents (full_name, email, password, phone, gender, address, barangay, category, date_of_birth, rfid_card_number, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [...resident, hashedPassword, 'active']
        );
      }
      console.log('Sample resident accounts created');
    }
  } catch (error) {
    console.error('Error ensuring default data:', error);
  }
}

async function connectDB() {
  try {
    db = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'barangay_system',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    console.log('Connected to MySQL database pool');

    // Make db available to routes
    app.locals.db = db;
    await ensureOfficialsTable();
    await ensureAdminColumns();
    await ensureAttendanceSoftDeleteColumn();
    await ensureResidentColumns();
    await ensureResidentSoftDeleteColumn();
    await ensureDefaultData();
  } catch (error) {
    console.error('Database connection failed:', error);
    console.log('Server will not start because the database is required.');
    process.exit(1);
  }
}

// Routes
app.use('/api/auth', requireDatabase, require('./routes/auth'));
app.use('/api/residents', requireDatabase, require('./routes/residents'));
app.use('/api/attendance', requireDatabase, require('./routes/attendance'));
app.use('/api/work-hours', requireDatabase, require('./routes/work-hours'));
app.use('/api/qrcode', requireDatabase, require('./routes/qrcode'));
app.use('/api/services', requireDatabase, require('./routes/services'));
app.use('/api/officials', requireDatabase, require('./routes/officials'));
app.use('/api/admins', requireDatabase, authenticateToken, require('./routes/admins'));

// Health check
app.get('/api/health', (req, res) => {
  const dbStatus = req.app.locals.db ? 'connected' : 'disconnected';
  res.json({
    status: 'OK',
    message: 'Barangay Attendance System API is running',
    database: dbStatus
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

async function cleanupDeletedAttendance() {
  if (!db) return;

  try {
    const [result] = await db.execute(
      `DELETE FROM attendance WHERE deleted_at IS NOT NULL AND TIMESTAMPDIFF(DAY, deleted_at, NOW()) >= 30`
    );

    if (result.affectedRows > 0) {
      console.log(`Purged ${result.affectedRows} expired deleted attendance record(s)`);
    }
  } catch (error) {
    console.error('Failed to cleanup deleted attendance:', error);
  }
}

async function cleanupDeletedResidents() {
  if (!db) return;

  try {
    const [result] = await db.execute(
      `DELETE FROM residents WHERE deleted_at IS NOT NULL AND TIMESTAMPDIFF(DAY, deleted_at, NOW()) >= 30`
    );

    if (result.affectedRows > 0) {
      console.log(`Purged ${result.affectedRows} expired deleted resident record(s)`);
    }
  } catch (error) {
    console.error('Failed to cleanup deleted residents:', error);
  }
}

// Cleanup all expired soft-deleted records
async function cleanupExpiredRecords() {
  await cleanupDeletedAttendance();
  await cleanupDeletedResidents();
}

// Start server
async function startServer() {
  await connectDB();
  await cleanupExpiredRecords();
  setInterval(cleanupExpiredRecords, 12 * 60 * 60 * 1000); // every 12 hours

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();