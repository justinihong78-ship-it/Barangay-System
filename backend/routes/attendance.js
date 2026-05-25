const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

const calculateAttendanceStatus = (record) => {
  const scanType = String(record.scan_type || '').trim().toUpperCase();

  if (scanType === 'IN' || scanType === 'TIME IN') {
    return 'In';
  }

  if (scanType === 'OUT' || scanType === 'TIME OUT') {
    // For Time Out, always return "Out" status
    return 'Out';
  }

  return record.attendance_status || 'Out';
};

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

// Get recently deleted records (within 30 days) - MUST come before /:id routes
router.get('/deleted/recent', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [rows] = await db.execute(`
      SELECT a.*, r.full_name, r.rfid_card_number
      FROM attendance a
      JOIN residents r ON a.resident_id = r.id
      WHERE a.deleted_at IS NOT NULL
        AND a.deleted_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY a.deleted_at DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Get deleted attendance error:', error);
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
    const db = req.app.locals.db;

    if (!resident_id && !rfid_card_number && !qr_code_data) {
      return res.status(400).json({ error: 'Resident ID, RFID card number, or QR code data required' });
    }

    // Find resident if not provided
    let residentId = resident_id;
    if (!residentId) {
      let query = 'SELECT id FROM residents WHERE ';
      let params = [];

      if (rfid_card_number) {
        query += 'LOWER(rfid_card_number) = LOWER(?)';
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
    const scanTime = now;

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

    // Smart duplicate prevention: Only block exact duplicates (same scan type within 30 seconds)
    // This prevents accidental double-scans while allowing normal IN→OUT transitions
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const [recentScans] = await db.execute(`
      SELECT id, scan_type, scan_time FROM attendance
      WHERE resident_id = ?
        AND scan_time >= ?
        AND deleted_at IS NULL
      ORDER BY scan_time DESC LIMIT 1
    `, [residentId, thirtySecondsAgo]);

    if (recentScans.length > 0) {
      const lastScan = recentScans[0];
      const lastScanType = (lastScan.scan_type || '').trim();
      const isSameScanType = (lastScanType === 'IN' && scanType === 'IN') || 
                             (lastScanType === 'OUT' && scanType === 'OUT');
      
      if (isSameScanType) {
        // Silently return success without recording to prevent accidental duplicate scans
        // This prevents error messages from interrupting the workflow
        return res.status(201).json({
          message: 'Attendance recorded',
          isDuplicate: true,
          attendance: {
            id: lastScan.id,
            resident_id: residentId,
            scan_type: scanType,
            scan_time: new Date(lastScan.scan_time).toISOString(),
            attendance_status: 'DUPLICATE_PREVENTED'
          }
        });
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
        'INSERT INTO attendance (resident_id, rfid_card_number, qr_code_data, scan_type, scan_time, time_in, attendance_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [residentId, rfid_card_number || null, qr_code_data || null, scanType, scanTime, scanTime, 'In']
      );

      // For Time IN, status is always "In"
      const attendanceStatus = 'In';

      // No need to update, already set to 'In' on INSERT

      // Fetch and return the created record
      const [createdRows] = await db.execute(
        `SELECT a.id, a.scan_type, a.scan_time, a.time_in, a.time_out, 
                a.rfid_card_number, a.work_hours, a.attendance_status, r.full_name
         FROM attendance a
         JOIN residents r ON a.resident_id = r.id
         WHERE a.id = ?`,
        [result.insertId]
      );

      const attendanceRecord = createdRows[0] || {
        id: result.insertId,
        resident_id: residentId,
        scan_type: scanType,
        scan_time: now.toISOString(),
        time_in: now.toISOString(),
        rfid_card_number: rfid_card_number || null,
        work_hours: null,
        attendance_status: attendanceStatus,
        full_name: ''
      };

      res.status(201).json({
        message: 'Time In recorded successfully',
        operation_type: 'IN',
        status: attendanceStatus,
        attendance: attendanceRecord
      });

      // If this resident holds a position, mark them active and broadcast
      try {
        const [rrows] = await db.execute('SELECT id, position, full_name FROM residents WHERE id = ?', [residentId]);
        if (rrows.length > 0 && rrows[0].position) {
          await db.execute('UPDATE residents SET status = ? WHERE id = ?', ['active', residentId]);
          if (req.app && req.app.locals && typeof req.app.locals.broadcastOfficialStatus === 'function') {
            req.app.locals.broadcastOfficialStatus({ id: residentId, status: 'Active', position: rrows[0].position, name: rrows[0].full_name });
          }
        }
      } catch (e) {
        console.warn('Failed to update resident status on Time In:', e.message || e);
      }

    } else if (scanType === 'OUT') {
      // Find latest IN record for today to calculate work hours
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

      // For Time Out, status is always "Out" regardless of work hours
      const attendanceStatus = 'Out';

      // Create a NEW separate OUT record (don't update the IN record)
      const [result] = await db.execute(
        'INSERT INTO attendance (resident_id, rfid_card_number, qr_code_data, scan_type, scan_time, time_out, work_hours, attendance_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [residentId, rfid_card_number || null, qr_code_data || null, scanType, scanTime, timeOut, workHours, attendanceStatus]
      );

      // Fetch and return the created OUT record
      const [createdRows] = await db.execute(
        `SELECT a.id, a.scan_type, a.scan_time, a.time_in, a.time_out,
                a.rfid_card_number, a.work_hours, a.attendance_status, r.full_name
         FROM attendance a
         JOIN residents r ON a.resident_id = r.id
         WHERE a.id = ?`,
        [result.insertId]
      );

      const attendanceRecord = createdRows[0] || {
        id: result.insertId,
        resident_id: residentId,
        scan_type: 'OUT',
        scan_time: timeOut.toISOString(),
        time_in: null,
        time_out: timeOut.toISOString(),
        rfid_card_number: rfid_card_number || null,
        work_hours: workHours,
        attendance_status: attendanceStatus,
        full_name: ''
      };

      res.status(201).json({
        message: 'Time Out recorded successfully',
        operation_type: 'OUT',
        status: attendanceStatus,
        workHours: workHours,
        attendance: attendanceRecord
      });

      // If this resident holds a position, mark them inactive and broadcast
      try {
        const [rrows] = await db.execute('SELECT id, position, full_name FROM residents WHERE id = ?', [residentId]);
        if (rrows.length > 0 && rrows[0].position) {
          await db.execute('UPDATE residents SET status = ? WHERE id = ?', ['inactive', residentId]);
          if (req.app && req.app.locals && typeof req.app.locals.broadcastOfficialStatus === 'function') {
            req.app.locals.broadcastOfficialStatus({ id: residentId, status: 'Inactive', position: rrows[0].position, name: rrows[0].full_name });
          }
        }
      } catch (e) {
        console.warn('Failed to update resident status on Time Out:', e.message || e);
      }
    }

  } catch (error) {
    console.error('Record attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update attendance record (allow adjusting time_out and recalculating status)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { time_out, attendance_status, allowedTimeIn = '09:00', allowedTimeOut = '17:00' } = req.body;
    const db = req.app.locals.db;

    // Fetch the attendance record
    const [rows] = await db.execute(`SELECT * FROM attendance WHERE id = ? AND deleted_at IS NULL`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Attendance record not found' });

    const record = rows[0];

    // If attendance_status is provided, update it directly
    if (attendance_status) {
      await db.execute(
        `UPDATE attendance SET attendance_status = ? WHERE id = ?`,
        [attendance_status, id]
      );
    } else if (time_out) {
      // Only update time_out and recalc work_hours/status
      const newTimeOut = new Date(time_out);

      // Find latest IN record for the resident today
      const [inRecords] = await db.execute(`
        SELECT id, time_in, scan_time FROM attendance
        WHERE resident_id = ?
          AND DATE(scan_time) = CURDATE()
          AND scan_type = 'IN'
          AND deleted_at IS NULL
        ORDER BY scan_time DESC LIMIT 1
      `, [record.resident_id]);

      let workHours = null;
      let calculatedStatus = record.attendance_status || 'Out';

      if (inRecords.length > 0) {
        const inRecord = inRecords[0];
        const timeIn = new Date(inRecord.time_in || inRecord.scan_time);
        const timeOut = newTimeOut;

        const workMs = timeOut - timeIn;
        const workMinutes = Math.round(workMs / (1000 * 60));
        workHours = parseFloat((workMinutes / 60).toFixed(2));

        // Parse allowed times to minutes
        const parseHM = (hm) => {
          const parts = String(hm).split(':');
          const h = parseInt(parts[0], 10) || 0;
          const m = parseInt(parts[1], 10) || 0;
          return h * 60 + m;
        };

        const allowedInMin = parseHM(allowedTimeIn);
        const allowedOutMin = parseHM(allowedTimeOut);
        const scheduledMinutes = allowedOutMin - allowedInMin;
        const scheduledHours = parseFloat((scheduledMinutes / 60).toFixed(2));

        if (workHours < scheduledHours) calculatedStatus = 'Undertime';
        else if (workHours > scheduledHours) calculatedStatus = 'Overtime';
        else calculatedStatus = 'Out';
      }

      // Update the record
      await db.execute(
        `UPDATE attendance SET time_out = ?, work_hours = ?, attendance_status = ? WHERE id = ?`,
        [newTimeOut, workHours, calculatedStatus, id]
      );
    }

    // Return updated record
    const [updated] = await db.execute(
      `SELECT a.id, a.scan_type, a.scan_time, a.time_in, a.time_out, a.rfid_card_number, a.work_hours, a.attendance_status, r.full_name
       FROM attendance a
       JOIN residents r ON a.resident_id = r.id
       WHERE a.id = ?`,
      [id]
    );

    res.json({ message: 'Attendance updated', attendance: updated[0] });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Soft delete attendance record (recovery within 30 days)
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

    res.json({ message: 'Attendance record deleted (recoverable for 30 days)' });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Restore deleted attendance record
router.patch('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    const [result] = await db.execute(
      'UPDATE attendance SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Deleted record not found' });
    }

    // Fetch restored record
    const [restored] = await db.execute(
      `SELECT a.*, r.full_name
       FROM attendance a
       JOIN residents r ON a.resident_id = r.id
       WHERE a.id = ?`,
      [id]
    );

    const attendanceRecord = restored[0];
    if (!attendanceRecord) {
      return res.status(404).json({ error: 'Restored record not found' });
    }

    const currentStatus = String(attendanceRecord.attendance_status || '').trim();
    if (!currentStatus) {
      const derivedStatus = calculateAttendanceStatus(attendanceRecord);
      await db.execute(
        'UPDATE attendance SET attendance_status = ? WHERE id = ?',
        [derivedStatus, id]
      );
      attendanceRecord.attendance_status = derivedStatus;
    }

    res.json({ message: 'Attendance record restored', attendance: attendanceRecord });
  } catch (error) {
    console.error('Restore attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Restore all deleted records within 30 days
router.patch('/restore/all', async (req, res) => {
  try {
    const db = req.app.locals.db;

    const [result] = await db.execute(`
      UPDATE attendance
      SET deleted_at = NULL,
          attendance_status = CASE
            WHEN TRIM(IFNULL(attendance_status, '')) = '' AND scan_type IN ('IN', 'Time In') THEN 'In'
            WHEN TRIM(IFNULL(attendance_status, '')) = '' AND scan_type IN ('OUT', 'Time Out') AND work_hours IS NOT NULL AND work_hours < 8 THEN 'Undertime'
            WHEN TRIM(IFNULL(attendance_status, '')) = '' AND scan_type IN ('OUT', 'Time Out') AND work_hours IS NOT NULL AND work_hours > 8 THEN 'Overtime'
            WHEN TRIM(IFNULL(attendance_status, '')) = '' AND scan_type IN ('OUT', 'Time Out') THEN 'Out'
            ELSE attendance_status
          END
      WHERE deleted_at IS NOT NULL
        AND deleted_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    res.json({ 
      message: 'All deleted records restored',
      restoredCount: result.affectedRows
    });
  } catch (error) {
    console.error('Restore all attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Permanently delete attendance record (skip recovery period)
router.delete('/:id/permanent', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    const [result] = await db.execute(
      'DELETE FROM attendance WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    res.json({ message: 'Attendance record permanently deleted' });
  } catch (error) {
    console.error('Permanent delete attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Permanently delete all soft-deleted records older than 30 days (auto-cleanup)
router.delete('/cleanup/expired', async (req, res) => {
  try {
    const db = req.app.locals.db;

    const [result] = await db.execute(`
      DELETE FROM attendance 
      WHERE deleted_at IS NOT NULL 
        AND deleted_at <= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    res.json({ 
      message: 'Expired deleted records permanently removed',
      deletedCount: result.affectedRows
    });
  } catch (error) {
    console.error('Cleanup expired attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Permanently delete all soft-deleted records (admin action)
router.delete('/permanent/all', async (req, res) => {
  try {
    const db = req.app.locals.db;

    const [result] = await db.execute(`
      DELETE FROM attendance 
      WHERE deleted_at IS NOT NULL
    `);

    res.json({ 
      message: 'All deleted records permanently removed',
      deletedCount: result.affectedRows
    });
  } catch (error) {
    console.error('Permanent delete all attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



module.exports = router;
