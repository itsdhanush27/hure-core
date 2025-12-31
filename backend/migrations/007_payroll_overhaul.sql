-- Phase 5: Payroll & Leave Overhaul

-- 1. Leave Types
create table if not exists leave_types (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references clinics(id) on delete cascade,
  name text not null,
  is_paid boolean default true,
  allocation_type text check (allocation_type in ('annual', 'period')), 
  allowance_days numeric,
  created_at timestamptz default now()
);

-- 2. Payroll Runs
create table if not exists payroll_runs (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references clinics(id) on delete cascade,
  location_id uuid references clinic_locations(id) on delete set null, -- Nullable for 'All Locations' runs?
  start_date date not null,
  end_date date not null,
  month_units numeric default 30,
  marked_by_name text,
  status text default 'draft', -- 'draft', 'finalized'
  finalized_at timestamptz,
  finalized_by uuid, -- references auth.users(id)
  created_at timestamptz default now()
);

-- 3. Payroll Items
create table if not exists payroll_items (
  id uuid primary key default uuid_generate_v4(),
  payroll_run_id uuid references payroll_runs(id) on delete cascade,
  user_id uuid references users(id), -- Nullable for locums? or Locums have user_id?
  -- If Locums are in `external_locums`, we need a column for them or link via user_id if they have accounts?
  -- Current system: Locums have `external_locum_id`. They might NOT have `users` record.
  -- So we need `external_locum_id` column.
  external_locum_id uuid references external_locums(id),
  
  -- Snapshot Data
  name text,
  role text,
  pay_method text, -- 'fixed', 'prorated', 'daily'
  salary numeric,
  rate numeric,
  
  -- Units
  worked_units numeric default 0,
  paid_leave_units numeric default 0,
  unpaid_leave_units numeric default 0,
  absent_units numeric default 0,
  period_units numeric default 0,

  -- Financials
  payable_base numeric default 0,
  allowances_amount numeric default 0,
  gross_pay numeric default 0,

  -- Metadata
  allowances jsonb default '[]'::jsonb, -- Array of {amount, notes}
  is_paid boolean default false,
  paid_at timestamptz,
  paid_by text, -- Stamped name or UUID? text matches demo "Marked Paid By"

  created_at timestamptz default now()
);

-- 4. Update Users
alter table users add column if not exists pay_method text default 'fixed';
