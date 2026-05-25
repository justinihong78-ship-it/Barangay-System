const express = require('express');
const router = express.Router();

/**
 * Calculate work hours, late, undertime, and overtime for a given day
 * Assumes work hours are 8 hours per day (e.g., 9 AM to 5 PM)
 */
function calculateWorkHours(timeIn, timeOut, lateThreshold = 15) {
  if (!timeIn || !timeOut) return null;

  const timeInDate = new Date(`2000-01-01 ${timeIn}`);
  const timeOutDate = new Date(`2000-01-01 ${timeOut}`);

  // If time out is earlier than time in, assume it's the next day
  if (timeOutDate < timeInDate) {
    timeOutDate.setDate(timeOutDate.getDate() + 1);
  }

  const diffMs = timeOutDate - timeInDate;
  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours = totalMinutes / 60;

  // Standard work hours (8 hours = 480 minutes)
  const standardMinutes = 8 * 60;
  const standardHours = 8;

  // Expected time in (9:00 AM)
  const expectedTimeInDate = new Date(`2000-01-01 09:00`);
  const expectedTimeInMinutes = expectedTimeInDate.getHours() * 60 + expectedTimeInDate.getMinutes();

  // Calculate late arrival
  const actualTimeInMinutes = timeInDate.getHours() * 60 + timeInDate.getMinutes();
  const lateMinutes = Math.max(0, actualTimeInMinutes - expectedTimeInMinutes);
  const isLate = lateMinutes > lateThreshold;

  // Calculate undertime and overtime
  let undertime = 0;
  let overtime = 0;

  if (totalMinutes < standardMinutes) {
    undertime = standardMinutes - totalMinutes;
  } else if (totalMinutes > standardMinutes) {
    overtime = totalMinutes - standardMinutes;
  }

  return {
    timeIn,
    timeOut,
    totalMinutes,
    totalHours: parseFloat(totalHours.toFixed(2)),
    lateMinutes: isLate ? lateMinutes : 0,
    isLate,
    undertime,
    overtime,
    remarks: isLate ? `Late by ${lateMinutes} minutes` : 'On time'
  };
}

// Get work hours calculation for a specific date
router.get('/calculate/:residentId/:date', async (req, res) => {
  try {
    const { residentId, date } = req.params;
    const db = req.app.locals.db;

    const [records] = await db.execute(`
      SELECT 
        DATE(scan_time) as scan_date,
        TIME(MIN(CASE WHEN scan_type IN ('IN', 'Time In') THEN scan_time END)) as time_in,
        TIME(MAX(CASE WHEN scan_type IN ('OUT', 'Time Out') THEN scan_time END)) as time_out
      FROM attendance
      WHERE resident_id = ? AND DATE(scan_time) = ? AND deleted_at IS NULL
      GROUP BY DATE(scan_time)
    `, [residentId, date]);

    if (records.length === 0) {
      return res.json({
        date,
        message: 'No attendance records found for this date'
      });
    }

    const record = records[0];
    const workHours = calculateWorkHours(record.time_in, record.time_out);

    res.json({
      date,
      ...workHours
    });
  } catch (error) {
    console.error('Calculate work hours error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get work hours summary for a date range
router.get('/summary/:residentId', async (req, res) => {
  try {
    const { residentId } = req.params;
    const { start_date, end_date } = req.query;
    const db = req.app.locals.db;

    let query = `
      SELECT 
        resident_id,
        DATE(scan_time) as scan_date,
        TIME(MIN(CASE WHEN scan_type IN ('IN', 'Time In') THEN scan_time END)) as time_in,
        TIME(MAX(CASE WHEN scan_type IN ('OUT', 'Time Out') THEN scan_time END)) as time_out
      FROM attendance
      WHERE resident_id = ? AND deleted_at IS NULL
    `;

    let params = [residentId];

    if (start_date) {
      query += ` AND DATE(scan_time) >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND DATE(scan_time) <= ?`;
      params.push(end_date);
    }

    query += ` GROUP BY resident_id, DATE(scan_time) ORDER BY scan_date DESC`;

    const [records] = await db.execute(query, params);

    const summary = records.map(record => {
      const workHours = calculateWorkHours(record.time_in, record.time_out) || {
        totalMinutes: 0,
        totalHours: 0,
        lateMinutes: 0,
        isLate: false,
        undertime: 0,
        overtime: 0,
        remarks: record.time_in && !record.time_out ? 'Missing time out' : 'Incomplete record'
      };

      return {
        date: record.scan_date,
        timeIn: record.time_in,
        timeOut: record.time_out,
        ...workHours
      };
    });

    // Calculate totals
    const totalMinutes = summary.reduce((sum, day) => sum + (day.totalMinutes || 0), 0);
    const totalLateMinutes = summary.reduce((sum, day) => sum + (day.lateMinutes || 0), 0);
    const totalUndertimeMinutes = summary.reduce((sum, day) => sum + (day.undertime || 0), 0);
    const totalOvertimeMinutes = summary.reduce((sum, day) => sum + (day.overtime || 0), 0);
    const lateCount = summary.filter(day => day.isLate).length;

    res.json({
      residentId,
      startDate: start_date,
      endDate: end_date,
      totalDays: summary.length,
      dailyRecords: summary,
      totals: {
        totalMinutes,
        totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
        totalLateMinutes,
        totalLateCount: lateCount,
        totalUndertimeMinutes,
        totalOvertimeMinutes,
        averageHoursPerDay: summary.length > 0 ? parseFloat((totalMinutes / summary.length / 60).toFixed(2)) : 0
      }
    });
  } catch (error) {
    console.error('Get work hours summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
