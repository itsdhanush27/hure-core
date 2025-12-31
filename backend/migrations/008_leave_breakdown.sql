-- Add breakdown column to payroll_items
-- Stores JSON map of Leave Type Name -> Units (e.g. {"Sick Leave": 1.0})
alter table payroll_items add column if not exists breakdown jsonb default '{}'::jsonb;
