# Work Hours & Status - Complete Implementation Guide

## Overview
The Work Hours field is now fully functional and automatically calculated. The system:
1. Records Time IN and Time OUT timestamps
2. Calculates work hours = (Time OUT - Time IN)
3. Compares to expected working hours (configured in Attendance Time Settings)
4. Automatically assigns status: **Late**, **Not Late**, **Undertime**, **Overtime**, or **On Time**

## How It Works

### Step 1: Configure Working Hours
**Location**: Attendance Section → "⏰ Attendance Time Settings"

```
Time In (Allowed From):  09:00
Time Out (Allowed Until): 17:00
Expected Work Duration: 8 hours
```

Save these settings. They apply to all employees for that day.

### Step 2: Time IN Recording
When employee/resident scans IN card:
- `time_in` = current timestamp
- If scanned **after** allowed time → Status: **🕐 Late**
- If scanned **before or at** allowed time → Status: **✓ On Time**
- `work_hours` = NULL (not yet calculated)

**Display in Log**: Shows Status badge based on arrival time

### Step 3: Time OUT Recording  
When employee/resident scans OUT card:
System automatically:
1. Finds the matching Time IN record from today
2. Calculates: `work_hours = (time_out - time_in) / 60 minutes`
3. Compares to expected hours (configured in Step 1):
   - Expected = allowedTimeOut minutes - allowedTimeIn minutes
   
4. **Assigns Status**:
   - **⏱️ Undertime** (Purple) → `work_hours < expected_hours`
   - **⏰ Overtime** (Yellow) → `work_hours > expected_hours`
   - **✓ On Time** (Green) → `work_hours = expected_hours`

5. Updates **both** IN and OUT records with:
   - `work_hours` = calculated value
   - `attendance_status` = determined status

**Display in Log**: Shows Work Hours (e.g., "7.5 hrs") and Status badge

### Example Scenario

**Configuration**:
- Time In: 09:00 AM
- Time Out: 05:00 PM
- Expected: 8 hours

**Employee Action**:
- 09:15 AM: Scans IN
  - Status: 🕐 Late (15 minutes late)
  - Work Hours: - (not yet calculated)

- 04:30 PM: Scans OUT (6 hours 15 minutes of work)
  - Work Hours: 6.25 hrs
  - Status: ⏱️ Undertime (worked 1.75 hours less than expected 8 hours)
  - Both IN and OUT records updated with this status

## Database Setup

### Option A: Automatic Migration (Recommended)
```bash
cd backend
node apply-migration.js
```

This will:
- Add missing columns (time_in, time_out, work_hours, attendance_status)
- Create necessary indexes
- Verify the schema

### Option B: Manual SQL Migration
Run in MySQL Workbench or terminal:

```sql
USE barangay_system;

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_in TIMESTAMP NULL AFTER scan_time;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_out TIMESTAMP NULL AFTER time_in;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS work_hours DECIMAL(5,2) AFTER time_out;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS attendance_status VARCHAR(20) AFTER work_hours;
ALTER TABLE attendance ADD INDEX IF NOT EXISTS idx_resident_id (resident_id);
```

### Verify Migration Worked
```sql
DESCRIBE attendance;
```

Should show these columns:
- `time_in` (TIMESTAMP)
- `time_out` (TIMESTAMP)
- `work_hours` (DECIMAL)
- `attendance_status` (VARCHAR)

## Frontend Display

### Attendance Log Table Columns
1. **#** - Row number
2. **Card Number** - RFID card identifier
3. **Name** - Employee/resident name
4. **Time** - Scan timestamp
5. **Type** - IN or OUT
6. **Work Hours** - Calculated hours (shows "-" for IN records until OUT is recorded)
7. **Status** - Color-coded badge:
   - 🕐 Late (red) - Late arrival on Time IN
   - ✓ On Time (green) - On time arrival on Time IN
   - ⏱️ Undertime (purple) - Worked less than expected
   - ⏰ Overtime (yellow) - Worked more than expected
   - ✓ On Time (green) - Worked exactly expected hours
8. **Action** - Delete button

### Filtered Views
All views now include Work Hours and Status:
- ✅ Today's Attendance
- ✅ Weekly Attendance
- ✅ Time In Records (Last 24 Hours)
- ✅ Time Out Records (Last 24 Hours)

### Download/Export
CSV downloads now include columns:
- Card Number
- Name
- Time
- Type
- Work Hours (e.g., "7.5 hrs")
- Status (e.g., "Undertime")

## API Endpoints

### POST /api/attendance (Record Attendance)
**Request**:
```json
{
  "rfid_card_number": "CARD-29674-15719",
  "scan_type": "IN",
  "allowedTimeIn": "09:00",
  "allowedTimeOut": "17:00"
}
```

**Response for Time IN**:
```json
{
  "message": "Time In recorded successfully",
  "status": "LATE",
  "attendance": {
    "id": 1,
    "scan_type": "IN",
    "scan_time": "2026-05-18T09:15:00.000Z",
    "time_in": "2026-05-18T09:15:00.000Z",
    "work_hours": null,
    "attendance_status": "",
    "full_name": "Juan Dela Cruz"
  }
}
```

**Response for Time OUT**:
```json
{
  "message": "Time Out recorded successfully",
  "status": "UNDERTIME",
  "workHours": 6.25,
  "attendance": {
    "id": 2,
    "scan_type": "OUT",
    "scan_time": "2026-05-18T16:30:00.000Z",
    "time_out": "2026-05-18T16:30:00.000Z",
    "work_hours": 6.25,
    "attendance_status": "UNDERTIME",
    "full_name": "Juan Dela Cruz"
  }
}
```

### GET /api/attendance (Get All Records)
Returns all attendance records with:
- `time_in` - Clock in timestamp
- `time_out` - Clock out timestamp
- `work_hours` - Calculated hours (DECIMAL)
- `attendance_status` - Status string (UNDERTIME, OVERTIME, ON_TIME, etc.)

## Testing Checklist

- [ ] Database migration applied successfully
- [ ] Backend running without errors
- [ ] Frontend loads attendance page
- [ ] Configure time settings (e.g., 9:00 AM to 5:00 PM)
- [ ] Save time settings - see success message
- [ ] Clock in employee - see Late/On Time status
- [ ] Clock out same employee - see work hours calculated
- [ ] Verify status shows as Undertime/Overtime/On Time
- [ ] Test download CSV includes all columns
- [ ] View filtered records (Today, Weekly) show work hours
- [ ] Delete and restore records work correctly

## Troubleshooting

### Work Hours Show as "-" or Null
**Cause**: Time IN record doesn't have a corresponding Time OUT yet
**Solution**: Ensure employee clocks out. Work hours only calculate on OUT.

### Status Not Updating
**Cause**: Browser cache or columns not in database
**Solution**: 
1. Run database migration: `node apply-migration.js`
2. Restart backend: `node server.js`
3. Hard refresh browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### All Records Show as "Not Late"
**Cause**: Time settings not saved or database columns not added
**Solution**: 
1. Apply database migration
2. Go to Attendance > Time Settings
3. Configure and save time settings
4. Test with new attendance scan

### Download CSV Missing Columns
**Cause**: Frontend not updated
**Solution**: 
1. Hard refresh browser cache
2. Verify frontend files updated
3. Check browser console for errors

## Advanced: Manual Status Recalculation

If you need to recalculate work hours for past records:

```sql
-- Calculate work hours for all OUT records
UPDATE attendance a
SET work_hours = ROUND(
  TIMESTAMPDIFF(MINUTE, 
    (SELECT scan_time FROM attendance WHERE resident_id = a.resident_id AND scan_type = 'IN' AND DATE(scan_time) = DATE(a.scan_time) LIMIT 1),
    a.scan_time
  ) / 60.0,
  2
)
WHERE scan_type = 'OUT' AND work_hours IS NULL;

-- Calculate status based on work hours (adjust expected_hours as needed)
UPDATE attendance
SET attendance_status = CASE
  WHEN work_hours < 8 THEN 'UNDERTIME'
  WHEN work_hours > 8 THEN 'OVERTIME'
  ELSE 'ON_TIME'
END
WHERE attendance_status IS NULL AND work_hours IS NOT NULL;
```

## Performance Notes

- Indexes added for faster queries: `idx_scan_time`, `idx_deleted_at`, `idx_resident_id`
- Work hours stored as DECIMAL(5,2) for accuracy (supports up to 999.99 hours)
- Status stored as VARCHAR(20) for flexibility and performance
