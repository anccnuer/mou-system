-- Database migration for System Hono API
-- Run this to initialize the database schema

-- Create resources table
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create index on created_at for faster queries
CREATE INDEX IF NOT EXISTS idx_resources_created_at ON resources(created_at);

-- Insert sample data (optional)
INSERT INTO resources (name, description) VALUES
  ('Sample Resource 1', 'This is a sample resource for testing'),
  ('Sample Resource 2', 'Another sample resource');
