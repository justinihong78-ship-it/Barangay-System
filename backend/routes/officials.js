const express = require('express');
const router = express.Router();

// Return officials from employees (residents with position) when available, falling back to officials table

// Get all officials
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    // Prefer residents with a non-null position (employees management)
    const [residents] = await db.execute(
      `SELECT id, NULL as avatar, full_name as name, position, NULL as term, phone as contact, email, status
       FROM residents
       WHERE position IS NOT NULL AND TRIM(position) <> ''
       ORDER BY full_name ASC`
    );

    if (residents.length > 0) {
      return res.json(residents);
    }

    // Fallback to legacy officials table
    const [rows] = await db.execute(
      'SELECT id, avatar, name, position, term, contact, email, status FROM officials ORDER BY name ASC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Get officials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SSE stream for official status updates
router.get('/stream', async (req, res) => {
  try {
    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.write('\n');

    const clients = req.app.locals.sseClients;
    clients.push(res);

    req.on('close', () => {
      const idx = clients.indexOf(res);
      if (idx !== -1) clients.splice(idx, 1);
    });
  } catch (error) {
    console.error('Officials stream error:', error);
    res.status(500).end();
  }
});

// Create a new official
router.post('/', async (req, res) => {
  try {
    const { avatar, name, position, term, contact, email, status } = req.body;
    if (!name || !position || !term || !contact || !email) {
      return res.status(400).json({ error: 'Name, position, term, contact, and email are required' });
    }

    const db = req.app.locals.db;
    const [result] = await db.execute(
      'INSERT INTO officials (avatar, name, position, term, contact, email, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [avatar || (name.charAt(0).toUpperCase()), name, position, term, contact, email, status || 'Active']
    );

    res.status(201).json({ id: result.insertId, message: 'Official created successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Official with this email already exists' });
    }
    console.error('Create official error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an official
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { avatar, name, position, term, contact, email, status } = req.body;

    if (!name || !position || !term || !contact || !email) {
      return res.status(400).json({ error: 'Name, position, term, contact, and email are required' });
    }

    const db = req.app.locals.db;
    const [result] = await db.execute(
      'UPDATE officials SET avatar = ?, name = ?, position = ?, term = ?, contact = ?, email = ?, status = ? WHERE id = ?',
      [avatar || (name.charAt(0).toUpperCase()), name, position, term, contact, email, status || 'Active', id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Official not found' });
    }

    res.json({ message: 'Official updated successfully' });
  } catch (error) {
    console.error('Update official error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an official
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    const [result] = await db.execute('DELETE FROM officials WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Official not found' });
    }

    res.json({ message: 'Official deleted successfully' });
  } catch (error) {
    console.error('Delete official error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
