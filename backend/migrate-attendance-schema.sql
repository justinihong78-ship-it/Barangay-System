-- Migration script to add work hours and attendance status columns to attendance table
-- Run this if you already have the attendance table without these columns

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_in TIMESTAMP NULL AFTER scan_time;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_out TIMESTAMP NULL AFTER time_in;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS work_hours DECIMAL(5,2) AFTER time_out;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS attendance_status VARCHAR(20) AFTER work_hours;
ALTER TABLE attendance ADD INDEX IF NOT EXISTS idx_resident_id (resident_id);

-- Verify the columns were added
SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'attendance' AND TABLE_SCHEMA = DATABASE()
ORDER BY ORDINAL_POSITION;
