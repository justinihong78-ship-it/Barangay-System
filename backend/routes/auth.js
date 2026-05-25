const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Login route
router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!password || (!username && !email)) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const db = req.app.locals.db;
    const [rows] = await db.execute(
      'SELECT * FROM admins WHERE username = ? OR email = ?',
      [username || email, email || username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = rows[0];
    const isValidPassword = await bcrypt.compare(password, admin.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // mark admin as active
    try {
      await db.execute('UPDATE admins SET status = ? WHERE id = ?', ['Active', admin.id]);
    } catch (e) {
      console.warn('Failed to update admin status on login:', e.message || e);
    }

    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        full_name: admin.full_name,
        status: 'Active'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout route - requires valid token
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const adminId = req.user && req.user.id;
    if (!adminId) return res.status(400).json({ error: 'Invalid token payload' });
    await db.execute('UPDATE admins SET status = ? WHERE id = ?', ['Inactive', adminId]);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register new admin (open endpoint for signup)
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name, phone, address, barangay, date_of_birth, position } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Username, email, password, and full name are required' });
    }

    const db = req.app.locals.db;
    const [existing] = await db.execute(
      'SELECT username, email FROM admins WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      const existingUser = existing[0];
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'The email address is already registered and cannot be used again.' });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ error: 'The username is already registered and cannot be used again.' });
      }
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.execute(
      'INSERT INTO admins (username, email, password, full_name, phone, address, barangay, date_of_birth, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, full_name, phone || null, address || null, barangay || null, date_of_birth || null, position || null]
    );

    res.status(201).json({ message: 'Admin created successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get all admins
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [positionColumn] = await db.execute("SHOW COLUMNS FROM admins LIKE 'position'");
    const fields = [
      'id',
      'username',
      'email',
      'full_name',
      'phone',
      'address',
      'barangay',
      'date_of_birth'
    ];

    if (positionColumn.length > 0) {
      fields.push('position');
    }

    fields.push('created_at');

    const [rows] = await db.execute(`SELECT ${fields.join(', ')} FROM admins ORDER BY created_at DESC`);
    res.json(rows);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update admin details
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, full_name, phone, address, barangay, date_of_birth, position } = req.body;

    if (!username || !email || !full_name) {
      return res.status(400).json({ error: 'Username, email, and full name are required' });
    }

    const db = req.app.locals.db;
    const [result] = await db.execute(
      'UPDATE admins SET username = ?, email = ?, full_name = ?, phone = ?, address = ?, barangay = ?, date_of_birth = ?, position = ? WHERE id = ?',
      [username, email, full_name, phone || null, address || null, barangay || null, date_of_birth || null, position || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json({ message: 'Admin updated successfully' });
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete admin (requires authentication)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    const [result] = await db.execute('DELETE FROM admins WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Find account by email for forgot-password flow
router.post('/find-account', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = req.app.locals.db;
    const [adminRows] = await db.execute('SELECT id, username, email, full_name FROM admins WHERE email = ?', [email]);
    if (adminRows.length > 0) {
      return res.json({ type: 'admin', account: adminRows[0] });
    }

    const [residentRows] = await db.execute('SELECT id, full_name, email, rfid_card_number FROM residents WHERE email = ?', [email]);
    if (residentRows.length > 0) {
      return res.json({ type: 'resident', account: residentRows[0] });
    }

    res.status(404).json({ error: 'Account not found' });
  } catch (error) {
    console.error('Find account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password for admin or resident
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, new_password } = req.body;
    if (!email || !new_password) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    const db = req.app.locals.db;
    const hashedPassword = await bcrypt.hash(new_password, 10);

    const [adminRows] = await db.execute('SELECT id FROM admins WHERE email = ?', [email]);
    if (adminRows.length > 0) {
      await db.execute('UPDATE admins SET password = ? WHERE email = ?', [hashedPassword, email]);
      return res.json({ message: 'Password updated successfully' });
    }

    const [residentRows] = await db.execute('SELECT id FROM residents WHERE email = ?', [email]);
    if (residentRows.length > 0) {
      await db.execute('UPDATE residents SET password = ? WHERE email = ?', [hashedPassword, email]);
      return res.json({ message: 'Password updated successfully' });
    }

    res.status(404).json({ error: 'Account not found' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;