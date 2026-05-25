const express = require('express');
const router = express.Router();

// Get all services
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [rows] = await db.execute(
      'SELECT * FROM services ORDER BY requested_at DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Add new service
router.post('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { resident_name, service_type, details, status = 'Pending' } = req.body;

    if (!resident_name || !service_type || !details) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [result] = await db.execute(
      'INSERT INTO services (resident_name, service_type, details, status) VALUES (?, ?, ?, ?)',
      [resident_name, service_type, details, status]
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Service added successfully'
    });
  } catch (error) {
    console.error('Error adding service:', error);
    res.status(500).json({ error: 'Failed to add service' });
  }
});

// Update service status
router.put('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const { status, notes } = req.body;

    let query = 'UPDATE services SET status = ?';
    let params = [status];

    if (status === 'Completed') {
      query += ', completed_at = CURRENT_TIMESTAMP';
    }

    if (notes) {
      query += ', notes = ?';
      params.push(notes);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await db.execute(query, params);

    res.json({ message: 'Service updated successfully' });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// Delete service
router.delete('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    await db.execute('DELETE FROM services WHERE id = ?', [id]);

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// Get service statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const db = req.app.locals.db;

    const [completed] = await db.execute(
      'SELECT COUNT(*) as count FROM services WHERE status = "Completed"'
    );

    const [pending] = await db.execute(
      'SELECT COUNT(*) as count FROM services WHERE status IN ("Pending", "In Progress")'
    );

    const [total] = await db.execute(
      'SELECT COUNT(*) as count FROM services'
    );

    res.json({
      servicesAvailed: completed[0].count,
      serviceRequests: pending[0].count,
      totalServices: total[0].count
    });
  } catch (error) {
    console.error('Error fetching service stats:', error);
    res.status(500).json({ error: 'Failed to fetch service statistics' });
  }
});

module.exports = router;