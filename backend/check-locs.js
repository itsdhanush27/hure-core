
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLocationIds() {
    console.log('=== Checking Location IDs in Attendance Records ===\n');

    // Get locum attendance records
    const { data, error } = await supabase
        .from('attendance')
        .select('id, date, locum_status, location_id, external_locum_id, external_locums(name)')
        .not('external_locum_id', 'is', null)
        .order('date', { ascending: false })
        .limit(10);

    if (error) {
        console.log('ERROR:', error.message);
        return;
    }

    console.log('Recent locum attendance records:');
    data?.forEach(r => {
        console.log(`  ${r.external_locums?.name || 'Unknown'}: locum_status=${r.locum_status}, location_id=${r.location_id || 'NULL'}, date=${r.date}`);
    });

    // Count NULL vs non-NULL location_ids
    const nullCount = data?.filter(r => !r.location_id).length || 0;
    const nonNullCount = data?.filter(r => r.location_id).length || 0;
    console.log(`\nNULL location_id: ${nullCount}`);
    console.log(`Non-NULL location_id: ${nonNullCount}`);

    // Get locations for reference
    const { data: locs } = await supabase.from('clinic_locations').select('id, name');
    console.log('\nAvailable locations:');
    locs?.forEach(l => console.log(`  ${l.name}: ${l.id}`));
}

checkLocationIds();
