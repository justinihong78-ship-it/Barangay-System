const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Generate QR code for resident
async function generateQRCode(residentId, rfidCardNumber) {
  const qrData = JSON.stringify({
    residentId,
    rfidCardNumber,
    timestamp: new Date().toISOString()
  });

  const qrCodePath = path.join(__dirname, '../uploads', `qr_${residentId}.png`);

  try {
    await QRCode.toFile(qrCodePath, qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return `/uploads/qr_${residentId}.png`;
  } catch (error) {
    console.error('QR code generation error:', error);
    throw error;
  }
}

// Get all residents (excluding soft deleted)
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [rows] = await db.execute(
      'SELECT * FROM residents WHERE deleted_at IS NULL ORDER BY created_at DESC'
    );

    res.json(rows);
  } catch (error) {
    console.error('Get residents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recently deleted residents (recoverable within 30 days)
router.get('/recently-deleted/all', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [rows] = await db.execute(`
      SELECT * FROM residents
      WHERE deleted_at IS NOT NULL
        AND TIMESTAMPDIFF(DAY, deleted_at, NOW()) < 30
      ORDER BY deleted_at DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Get recently deleted residents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Soft delete all active residents
router.delete('/delete/all', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [result] = await db.execute(
      'UPDATE residents SET deleted_at = NOW() WHERE deleted_at IS NULL'
    );

    res.json({ message: `${result.affectedRows} residents soft deleted and recoverable for 30 days` });
  } catch (error) {
    console.error('Delete all residents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Restore all soft deleted residents
router.patch('/restore/all', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [result] = await db.execute(
      'UPDATE residents SET deleted_at = NULL WHERE deleted_at IS NOT NULL'
    );

    res.json({ message: `${result.affectedRows} residents restored successfully` });
  } catch (error) {
    console.error('Restore all residents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Permanently delete all soft deleted residents
router.delete('/permanent/all', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [result] = await db.execute(
      'DELETE FROM residents WHERE deleted_at IS NOT NULL'
    );

    res.json({ message: `${result.affectedRows} residents permanently deleted` });
  } catch (error) {
    console.error('Permanently delete all residents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Permanently delete a single soft-deleted resident
router.delete('/:id/permanent', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    // Try to fetch resident to get qr path for cleanup
    const [rows] = await db.execute('SELECT * FROM residents WHERE id = ? AND deleted_at IS NOT NULL', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Resident not found or not deleted' });
    }

    const resident = rows[0];

    // Delete DB record
    const [result] = await db.execute('DELETE FROM residents WHERE id = ? AND deleted_at IS NOT NULL', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Resident not found or not deleted' });
    }

    // Remove associated QR file if exists
    try {
      if (resident.qr_code_path) {
        const qrFile = path.join(__dirname, '..', resident.qr_code_path);
        if (fs.existsSync(qrFile)) {
          fs.unlinkSync(qrFile);
        }
      }
    } catch (e) {
      console.warn('Failed to remove resident QR file:', e);
    }

    res.json({ message: 'Resident permanently deleted' });
  } catch (error) {
    console.error('Permanently delete resident error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get resident by ID (exclude soft deleted)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    const [rows] = await db.execute('SELECT * FROM residents WHERE id = ? AND deleted_at IS NULL', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Resident not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get resident error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new resident
router.post('/', async (req, res) => {
  try {
    let { full_name, gender, address, category, date_of_birth, rfid_card_number, email, password, phone, position, civil_status, barangay } = req.body;

    const normalizedGender = typeof gender === 'string'
      ? gender.trim().toLowerCase()
      : '';

    const genderMap = {
      male: 'Male',
      female: 'Female',
      other: 'Other'
    };

    const genderValue = genderMap[normalizedGender];

    // Provide specific error messages for each missing field
    if (!full_name) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (!genderValue) {
      return res.status(400).json({ error: 'Please select a valid gender' });
    }
    if (!address) {
      return res.status(400).json({ error: 'Address or barangay location is required' });
    }
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (!date_of_birth) {
      return res.status(400).json({ error: 'Date of birth is required' });
    }

    const db = req.app.locals.db;
    
    // Check if position is already taken (only if position is provided)
    if (position) {
      const [existingPosition] = await db.execute(
        'SELECT id FROM residents WHERE position = ? AND status != ? AND deleted_at IS NULL LIMIT 1',
        [position.trim(), 'inactive']
      );
      if (existingPosition && existingPosition.length > 0) {
        return res.status(409).json({ error: `The position "${position}" is already occupied by another resident. Please choose a different position or wait until the position becomes available.` });
      }
    }

    const actualPassword = password || uuidv4();
    const hashedPassword = await bcrypt.hash(actualPassword, 10);

    const normalizedAddress = address.trim();
    const normalizedBarangay = barangay || normalizedAddress;
    const normalizedEmail = email ? email.trim() : `resident-${Date.now()}@noemail.local`;

    // Insert resident
    const [result] = await db.execute(
      'INSERT INTO residents (full_name, email, password, phone, gender, address, barangay, category, position, civil_status, date_of_birth, rfid_card_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [full_name.trim(), normalizedEmail, hashedPassword, phone || null, genderValue, normalizedAddress, normalizedBarangay, category, position || null, civil_status || null, date_of_birth, rfid_card_number]
    );

    const residentId = result.insertId;

    // Generate QR code
    let qrCodePath = null;
    try {
      qrCodePath = await generateQRCode(residentId, rfid_card_number);

      // Update resident with QR code path
      await db.execute(
        'UPDATE residents SET qr_code_path = ? WHERE id = ?',
        [qrCodePath, residentId]
      );
    } catch (qrError) {
      console.error('QR code generation failed:', qrError);
      // Continue without QR code for now
    }

    // Create attendance log entry for RFID registration
    try {
      await db.execute(
        'INSERT INTO attendance (resident_id, rfid_card_number, scan_type, scan_time, time_in, attendance_status) VALUES (?, ?, ?, NOW(), NOW(), ?)',
        [residentId, rfid_card_number || null, 'RFID_REGISTRATION', 'RFID Registered']
      );
    } catch (logError) {
      console.error('Failed to create RFID registration log entry:', logError);
      // Continue without log entry
    }

    res.status(201).json({
      message: 'Resident created successfully',
      resident: {
        id: residentId,
        full_name,
        email,
        gender,
        address,
        barangay: normalizedBarangay,
        category,
        position,
        civil_status,
        date_of_birth,
        rfid_card_number,
        qr_code_path: qrCodePath
      }
    });
  } catch (error) {
    console.error('Create resident error:', error);
    res.status(500).json({ error: 'Internal server error. Please check the server logs.' });
  }
});

// Update resident
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, gender, address, barangay, category, date_of_birth, rfid_card_number, email, password, status, position, civil_status } = req.body;

    const db = req.app.locals.db;

    // Check if position is being changed and if new position is already taken
    if (position) {
      const [existingPosition] = await db.execute(
        'SELECT id FROM residents WHERE position = ? AND id != ? AND status != ? AND deleted_at IS NULL LIMIT 1',
        [position.trim(), id, 'inactive']
      );
      if (existingPosition && existingPosition.length > 0) {
        return res.status(409).json({ error: `The position "${position}" is already occupied by another resident. Please choose a different position.` });
      }
    }

    let query;
    let updateValues;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = 'UPDATE residents SET full_name = ?, email = ?, password = ?, gender = ?, address = ?, barangay = ?, category = ?, position = ?, civil_status = ?, date_of_birth = ?, rfid_card_number = ?, status = ? WHERE id = ?';
      updateValues = [full_name, email, hashedPassword, gender, address, barangay || null, category, position || null, civil_status || null, date_of_birth, rfid_card_number, status, id];
    } else {
      query = 'UPDATE residents SET full_name = ?, email = ?, gender = ?, address = ?, barangay = ?, category = ?, position = ?, civil_status = ?, date_of_birth = ?, rfid_card_number = ?, status = ? WHERE id = ?';
      updateValues = [full_name, email, gender, address, barangay || null, category, position || null, civil_status || null, date_of_birth, rfid_card_number, status, id];
    }

    const [result] = await db.execute(query, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Resident not found' });
    }

    // Regenerate QR code if RFID changed
    if (rfid_card_number) {
      try {
        const qrCodePath = await generateQRCode(id, rfid_card_number);
        await db.execute(
          'UPDATE residents SET qr_code_path = ? WHERE id = ?',
          [qrCodePath, id]
        );
      } catch (qrError) {
        console.error('QR code regeneration failed:', qrError);
      }
    }

    res.json({ message: 'Resident updated successfully' });
  } catch (error) {
    console.error('Update resident error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete resident (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    const [result] = await db.execute(
      'UPDATE residents SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Resident not found or already deleted' });
    }

    res.json({ message: 'Resident soft deleted and recoverable for 30 days' });
  } catch (error) {
    console.error('Delete resident error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Restore a soft deleted resident
router.patch('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    const [result] = await db.execute(
      'UPDATE residents SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Resident not found or not deleted' });
    }

    res.json({ message: 'Resident restored successfully' });
  } catch (error) {
    console.error('Restore resident error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get resident by RFID or QR code data
router.post('/find', async (req, res) => {
  try {
    const { rfid_card_number, qr_data } = req.body;
    const db = req.app.locals.db;

    let query = 'SELECT * FROM residents WHERE ';
    let params = [];

    if (rfid_card_number) {
      query += 'rfid_card_number = ?';
      params.push(rfid_card_number);
    } else if (qr_data) {
      // Parse QR data to get resident ID
      try {
        const qrParsed = JSON.parse(qr_data);
        if (qrParsed.residentId) {
          query += 'id = ?';
          params.push(qrParsed.residentId);
        } else {
          return res.status(400).json({ error: 'Invalid QR code data' });
        }
      } catch (parseError) {
        return res.status(400).json({ error: 'Invalid QR code format' });
      }
    } else {
      return res.status(400).json({ error: 'RFID card number or QR data required' });
    }

    const [rows] = await db.execute(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Resident not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Find resident error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resident login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = req.app.locals.db;
    const [rows] = await db.execute('SELECT * FROM residents WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const resident = rows[0];
    const passwordMatch = await bcrypt.compare(password, resident.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      resident: {
        id: resident.id,
        full_name: resident.full_name,
        email: resident.email,
        rfid_card_number: resident.rfid_card_number,
        status: resident.status,
        qr_code_path: resident.qr_code_path
      }
    });
  } catch (error) {
    console.error('Resident login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;