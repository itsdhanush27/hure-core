-- Migration: Add location_id to external_locums table and fix attendance data
-- Run this in Supabase SQL Editor

-- 1. Add the location_id column to external_locums
ALTER TABLE public.external_locums 
ADD COLUMN IF NOT EXISTS location_id uuid NULL;

-- 2. Add foreign key constraint
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'external_locums_location_id_fkey') THEN 
        ALTER TABLE public.external_locums 
        ADD CONSTRAINT external_locums_location_id_fkey 
        FOREIGN KEY (location_id) REFERENCES clinic_locations (id);
    END IF; 
END $$;

-- 3. Create index for location queries
CREATE INDEX IF NOT EXISTS idx_external_locums_location 
ON public.external_locums USING btree (location_id);

-- 4. Backfill external_locums.location_id from schedule_blocks
UPDATE public.external_locums el
SET location_id = sb.location_id
FROM public.schedule_blocks sb
WHERE el.schedule_block_id = sb.id
AND el.location_id IS NULL;

-- 5. Backfill attendance.location_id from external_locums (CRITICAL for filters to work)
UPDATE public.attendance a
SET location_id = el.location_id
FROM public.external_locums el
WHERE a.external_locum_id = el.id
AND (a.location_id IS NULL OR a.location_id != el.location_id)
AND el.location_id IS NOT NULL;

-- 6. Verify the count of fixed records
SELECT 
    (SELECT count(*) FROM public.external_locums WHERE location_id IS NOT NULL) as locums_with_location,
    (SELECT count(*) FROM public.attendance WHERE external_locum_id IS NOT NULL AND location_id IS NOT NULL) as attendance_with_location;
