const express = require('express');
const router = express.Router();

// Get all attendance records (excluding soft deleted items)
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [rows] = await db.execute(`
      SELECT a.*, r.full_name, r.rfid_card_number
      FROM attendance a
      JOIN residents r ON a.resident_id = r.id
      WHERE a.deleted_at IS NULL
      ORDER BY a.scan_time DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recently deleted attendance records (recoverable within 30 days)
router.get('/recently-deleted', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [rows] = await db.execute(`
      SELECT a.*, r.full_name, r.rfid_card_number
      FROM attendance a
      JOIN residents r ON a.resident_id = r.id
      WHERE a.deleted_at IS NOT NULL
        AND TIMESTAMPDIFF(DAY, a.deleted_at, NOW()) < 30
      ORDER BY a.deleted_at DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Get recently deleted attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attendance by resident ID
router.get('/resident/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    const [rows] = await db.execute(`
      SELECT a.*, r.full_name
      FROM attendance a
      JOIN residents r ON a.resident_id = r.id
      WHERE a.resident_id = ?
        AND a.deleted_at IS NULL
      ORDER BY a.scan_time DESC
    `, [id]);

    res.json(rows);
  } catch (error) {
    console.error('Get resident attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record attendance (Time In/Out)
router.post('/', async (req, res) => {
  try {
    const { resident_id, rfid_card_number, qr_code_data, scan_type } = req.body;

    if (!resident_id && !rfid_card_number && !qr_code_data) {
      return res.status(400).json({ error: 'Resident ID, RFID card number, or QR code data required' });
        // Check for duplicate scans within 2 minutes (prevent accidental/duplicate scans)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        let residentId = resident_id;
    
        if (!residentId) {
          let query = 'SELECT id FROM residents WHERE ';
          let params = [];

          if (rfid_card_number) {
            query += 'rfid_card_number = ?';
            params.push(rfid_card_number);
          } else if (qr_code_data) {
            try {
              const qrParsed = JSON.parse(qr_code_data);
              if (qrParsed.residentId) {
                query += 'id = ?';
                params.push(qrParsed.residentId);
              } else {
                return res.status(400).json({ error: 'Invalid QR code data' });
              }
            } catch (parseError) {
              return res.status(400).json({ error: 'Invalid QR code format' });
            }
          }

          const [residentRows] = await db.execute(query, params);
          if (residentRows.length === 0) {
            return res.status(404).json({ error: 'Resident not found' });
          }
          residentId = residentRows[0].id;
        }

        // Check for duplicate scans within 2 minutes
        const [recentScans] = await db.execute(`
          SELECT id, scan_type, scan_time FROM attendance
          WHERE resident_id = ?
            AND scan_time >= ?
            AND deleted_at IS NULL
          ORDER BY scan_time DESC LIMIT 1
        `, [residentId, twoMinutesAgo]);

        if (recentScans.length > 0) {
          const lastScan = recentScans[0];
          const timeSinceLastScan = Date.now() - new Date(lastScan.scan_time).getTime();
          if (timeSinceLastScan < 2 * 60 * 1000) {
            const secondsRemaining = Math.ceil((2 * 60 * 1000 - timeSinceLastScan) / 1000);
            return res.status(400).json({ 
              error: `Too fast! Please wait ${secondsRemaining} seconds before the next scan to prevent duplicates.`,
              cooldownSeconds: secondsRemaining
            });
          }
        }
    }

    const db = req.app.locals.db;

    if (!residentId) {
      let query = 'SELECT id FROM residents WHERE ';
      let params = [];

      if (rfid_card_number) {
        query += 'rfid_card_number = ?';
        params.push(rfid_card_number);
      } else if (qr_code_data) {
        try {
          const qrParsed = JSON.parse(qr_code_data);
          if (qrParsed.residentId) {
            query += 'id = ?';
            params.push(qrParsed.residentId);
          } else {
            return res.status(400).json({ error: 'Invalid QR code data' });
          }
        } catch (parseError) {
          return res.status(400).json({ error: 'Invalid QR code format' });
        }
      }

      const [residentRows] = await db.execute(query, params);
      if (residentRows.length === 0) {
        return res.status(404).json({ error: 'Resident not found' });
      }
      residentId = residentRows[0].id;
    }

    // Determine scan type from request or fallback to automatic detection
    let scanType = 'IN';
    const now = new Date();

    if (scan_type) {
      const normalizedScanType = String(scan_type).trim().toUpperCase();
      if (normalizedScanType === 'IN' || normalizedScanType === 'TIME IN') {
        scanType = 'IN';
      } else if (normalizedScanType === 'OUT' || normalizedScanType === 'TIME OUT') {
        scanType = 'OUT';
      } else {
        return res.status(400).json({ error: 'Invalid scan_type. Use IN or OUT.' });
      }
    } else {
      const [lastAttendance] = await db.execute(`
        SELECT scan_type FROM attendance
        WHERE resident_id = ?
          AND DATE(scan_time) = CURDATE()
          AND deleted_at IS NULL
          AND scan_type IN ('IN', 'OUT', 'Time In', 'Time Out')
        ORDER BY scan_time DESC LIMIT 1
      `, [residentId]);

      if (lastAttendance.length > 0) {
        const lastType = (lastAttendance[0].scan_type || '').trim();
        if (lastType === 'IN' || lastType === 'Time In') {
          scanType = 'OUT';
        } else if (lastType === 'OUT' || lastType === 'Time Out') {
          scanType = 'IN';
        } else {
          scanType = 'IN';
        }
      }
    }

    // Parse time settings
    const allowedTimeIn = req.body.allowedTimeIn || req.body.allowed_time_in || '09:00';
    const allowedTimeOut = req.body.allowedTimeOut || req.body.allowed_time_out || '17:00';

    const parseHM = (hm) => {
      const parts = String(hm).split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    };

    const allowedInMin = parseHM(allowedTimeIn);
    const allowedOutMin = parseHM(allowedTimeOut);
    const expectedWorkMinutes = allowedOutMin - allowedInMin;

    if (scanType === 'IN') {
      // Create new IN record with current time
      const [result] = await db.execute(
        'INSERT INTO attendance (resident_id, rfid_card_number, qr_code_data, scan_type, time_in) VALUES (?, ?, ?, ?, ?)',
        [residentId, rfid_card_number || null, qr_code_data || null, scanType, now]
      );

      // Determine if late
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      let lateStatus = '';
      if (currentMinutes > allowedInMin) {
        lateStatus = 'LATE';
      } else {
        lateStatus = 'ON_TIME';
      }

      // Update with late status
      await db.execute(
        'UPDATE attendance SET notes = ? WHERE id = ?',
        [lateStatus, result.insertId]
      );

      // Fetch and return the created record
      const [createdRows] = await db.execute(
        `SELECT a.id, a.scan_type, a.scan_time, a.time_in, a.rfid_card_number, a.notes, 
                a.work_hours, a.attendance_status, r.full_name
         FROM attendance a
         JOIN residents r ON a.resident_id = r.id
         WHERE a.id = ?`,
        [result.insertId]
      );

      res.status(201).json({
        message: 'Time In recorded successfully',
        status: lateStatus,
        attendance: createdRows[0] || {
          id: result.insertId,
          resident_id: residentId,
          scan_type: scanType,
          scan_time: now.toISOString(),
          time_in: now.toISOString(),
          notes: lateStatus
        }
      });

    } else if (scanType === 'OUT') {
      // Find latest IN record for today
      const [inRecords] = await db.execute(`
        SELECT id, time_in, scan_time FROM attendance
        WHERE resident_id = ?
          AND DATE(scan_time) = CURDATE()
          AND scan_type = 'IN'
          AND deleted_at IS NULL
        ORDER BY scan_time DESC LIMIT 1
      `, [residentId]);

      if (inRecords.length === 0) {
        return res.status(400).json({ error: 'No Time In recorded for today. Please Time In first.' });
      }

      const inRecord = inRecords[0];
      const timeIn = new Date(inRecord.time_in || inRecord.scan_time);
      const timeOut = now;

      // Calculate work hours
      const workMs = timeOut - timeIn;
      const workMinutes = Math.round(workMs / (1000 * 60));
      const workHours = parseFloat((workMinutes / 60).toFixed(2));

      // Determine attendance status based on work hours
      let attendanceStatus = 'ON_TIME';
      if (workMinutes < expectedWorkMinutes) {
        attendanceStatus = 'UNDERTIME';
      } else if (workMinutes > expectedWorkMinutes) {
        attendanceStatus = 'OVERTIME';
      }

      // Create OUT record
      const [result] = await db.execute(
        'INSERT INTO attendance (resident_id, rfid_card_number, qr_code_data, scan_type, time_out, work_hours, attendance_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [residentId, rfid_card_number || null, qr_code_data || null, scanType, timeOut, workHours, attendanceStatus]
      );

      // Also update the IN record with work hours and status
      await db.execute(
        'UPDATE attendance SET work_hours = ?, attendance_status = ?, time_out = ? WHERE id = ?',
        [workHours, attendanceStatus, timeOut, inRecord.id]
      );

      // Fetch and return the OUT record
      const [createdRows] = await db.execute(
        `SELECT a.id, a.scan_type, a.scan_time, a.time_out, a.rfid_card_number, a.notes, 
                a.work_hours, a.attendance_status, r.full_name
         FROM attendance a
         JOIN residents r ON a.resident_id = r.id
         WHERE a.id = ?`,
        [result.insertId]
      );

      res.status(201).json({
        message: 'Time Out recorded successfully',
        status: attendanceStatus,
        workHours: workHours,
        attendance: createdRows[0] || {
          id: result.insertId,
          resident_id: residentId,
          scan_type: scanType,
          scan_time: now.toISOString(),
          time_out: timeOut.toISOString(),
          work_hours: workHours,
          attendance_status: attendanceStatus
        }
      });
    }

  } catch (error) {
    console.error('Record attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attendance summary for a date range
router.get('/summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const db = req.app.locals.db;

    let query = `
      SELECT
        r.full_name,
        DATE(a.scan_time) as date,
        MIN(CASE WHEN a.scan_type = 'IN' THEN TIME(a.scan_time) END) as time_in,
        MAX(CASE WHEN a.scan_type = 'OUT' THEN TIME(a.scan_time) END) as time_out,
        COUNT(*) as total_scans
      FROM attendance a
      JOIN residents r ON a.resident_id = r.id
    `;

    let params = [];
    let conditions = ['a.deleted_at IS NULL'];

    if (start_date) {
      conditions.push('DATE(a.scan_time) >= ?');
      params.push(start_date);
    }

    if (end_date) {
      conditions.push('DATE(a.scan_time) <= ?');
      params.push(end_date);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY r.id, r.full_name, DATE(a.scan_time) ORDER BY date DESC, r.full_name';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete attendance record
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    const [result] = await db.execute(
      'UPDATE attendance SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Attendance record not found or already deleted' });
    }

    res.json({ message: 'Attendance record moved to Recently Deleted' });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Restore a soft deleted attendance record
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    const [result] = await db.execute(
      'UPDATE attendance SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Deleted attendance record not found or already restored' });
    }

    res.json({ message: 'Attendance record restored successfully' });
  } catch (error) {
    console.error('Restore attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;