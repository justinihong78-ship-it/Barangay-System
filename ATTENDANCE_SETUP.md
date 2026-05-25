# Attendance Work Hours & Status - Setup Instructions

## What Changed
Added `work_hours` and `attendance_status` tracking to attendance records:
- **work_hours**: Decimal(5,2) - Actual hours worked (calculated from Time In to Time Out)
- **attendance_status**: VARCHAR(20) - UNDERTIME, OVERTIME, or ON_TIME
- **time_in**: TIMESTAMP - When employee clocked in
- **time_out**: TIMESTAMP - When employee clocked out

## Database Setup

### Option 1: Apply Migration (Recommended for existing database)
Run the migration script to add columns to existing attendance table:

```sql
-- Copy and run in MySQL Workbench or command line:
USE barangay_system;

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_in TIMESTAMP NULL AFTER scan_time;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_out TIMESTAMP NULL AFTER time_in;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS work_hours DECIMAL(5,2) AFTER time_out;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS attendance_status VARCHAR(20) AFTER work_hours;
ALTER TABLE attendance ADD INDEX IF NOT EXISTS idx_resident_id (resident_id);
```

Or run the prepared migration file:
```bash
mysql -u root -p barangay_system < backend/migrate-attendance-schema.sql
```

### Option 2: Fresh Database
If starting fresh, just run the updated `backend/database.sql` which includes the new columns.

## How It Works

### When Time IN is recorded:
- `time_in` = current timestamp
- Stores whether clocked in on time or late in `notes` field

### When Time OUT is recorded:
- `time_out` = current timestamp
- `work_hours` = calculated from (time_out - time_in) / 60 minutes
- `attendance_status` = determined by comparing work_hours to expected hours:
  - UNDERTIME: worked less than expected hours
  - OVERTIME: worked more than expected hours
  - ON_TIME: worked exactly expected hours
- Both IN and OUT records get updated with these values

## Frontend Display

### Main Attendance Log Table Columns:
1. # (index)
2. Card Number
3. Name
4. Time
5. Type (IN/OUT)
6. Work Hours (e.g., "7.5 hrs")
7. Status (badge with color coding):
   - 🟣 Undertime (purple)
   - 🟡 Overtime (yellow)
   - 🟢 On Time (green)
   - 🔴 Late (red) - legacy status for late arrivals
8. Action (Delete button)

### Downloads
CSV exports now include: Card Number, Name, Time, Type, Work Hours, Status

## Testing

1. **Configure working hours** in "Attendance Time Settings":
   - Set Time In (e.g., 9:00 AM)
   - Set Time Out (e.g., 5:00 PM)
   - Click "Save Settings"

2. **Record attendance**:
   - Clock in an employee (status: Late/On Time based on arrival time)
   - Clock out the same employee
   - System auto-calculates work hours and determines Undertime/Overtime/On Time

3. **Verify display**:
   - Check the attendance log for the new Work Hours column
   - Check the Status badge for the correct status
   - Download CSV to verify exported columns

## Notes
- Work hours are only calculated on Time OUT
- IN records don't show work hours until the employee clocks out
- Status is based on actual work duration vs configured hours (not clock times)
- For example: If configured 9 AM-5 PM (8 hours):
  - 8.5 hours worked = OVERTIME
  - 7.5 hours worked = UNDERTIME
  - 8 hours worked = ON_TIME
