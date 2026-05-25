-- Add position column to residents table if it doesn't exist
ALTER TABLE residents ADD COLUMN position VARCHAR(100) AFTER category;
