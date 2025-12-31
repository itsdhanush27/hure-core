
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function locationCheck() {
    console.log('=== Location Filter Check ===\n');

    // Get all attendance with location details
    const { data: attRecords } = await supabase
        .from('external_locum_attendance')
        .select('id, external_locum_id, location_id, status, external_locums(name)');

    console.log('Attendance records with location_id:');
    attRecords?.forEach(r => {
        console.log(`  ${r.external_locums?.name}: location_id = ${r.location_id || 'NULL'}`);
    });

    // Get all locations
    const { data: locations } = await supabase.from('clinic_locations').select('id, name');
    console.log('\nAll locations:');
    locations?.forEach(l => {
        console.log(`  ${l.name}: ${l.id}`);
    });

    // Simulate query WITH location filter
    if (attRecords?.length > 0 && locations?.length > 0) {
        const firstLocationId = locations[0].id;
        console.log(`\nSimulating query with locationId=${firstLocationId}:`);

        const { data: filtered, error } = await supabase
            .from('external_locum_attendance')
            .select('*, external_locums(name)')
            .eq('location_id', firstLocationId);

        console.log('Filtered results:', filtered?.length || 0);

        // Also check NULL location_id case
        console.log('\nRecords with NULL location_id:');
        const nullLocations = attRecords?.filter(r => !r.location_id);
        console.log('Count:', nullLocations?.length || 0);
    }
}

locationCheck();
