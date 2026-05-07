-- Add utm_content column to submissions table for granular campaign tracking
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS utm_content text;
