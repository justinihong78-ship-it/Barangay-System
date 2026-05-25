const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// Get all admins
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [rows] = await db.execute(
      'SELECT id, username, email, full_name, phone, address, barangay, date_of_birth, created_at FROM admins ORDER BY created_at DESC'
    );

    res.json(rows);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    const [rows] = await db.execute(
      'SELECT id, username, email, full_name, phone, address, barangay, date_of_birth, created_at FROM admins WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new admin
router.post('/', async (req, res) => {
  try {
    const { username, email, password, full_name, phone, address, barangay, date_of_birth } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const db = req.app.locals.db;
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.execute(
      'INSERT INTO admins (username, email, password, full_name, phone, address, barangay, date_of_birth) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, full_name, phone || null, address || null, barangay || null, date_of_birth || null]
    );

    res.status(201).json({ message: 'Admin created successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      console.error('Create admin error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Update admin
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, full_name, address, barangay } = req.body;

    const db = req.app.locals.db;

    let query = 'UPDATE admins SET username = ?, email = ?, full_name = ?';
    let params = [username, email, full_name];

    if (address !== undefined) {
      query += ', address = ?';
      params.push(address || null);
    }
    if (barangay !== undefined) {
      query += ', barangay = ?';
      params.push(barangay || null);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(id);

    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json({ message: 'Admin updated successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      console.error('Update admin error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete admin
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

// Change password
router.put('/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    const db = req.app.locals.db;

    // Verify current password
    const [rows] = await db.execute('SELECT password FROM admins WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const isValidPassword = await bcrypt.compare(current_password, rows[0].password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db.execute('UPDATE admins SET password = ? WHERE id = ?', [hashedPassword, id]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;