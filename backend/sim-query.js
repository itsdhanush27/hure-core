
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function simulateBackendQuery() {
    console.log('=== Simulating Backend Query ===\n');

    // These are the params the backend receives
    const clinicId = '57e4ed85-1f2f-42f5-b33e-f156382b3149';
    const startDate = '2025-12-31';
    const endDate = '2025-12-31';

    // Get locations to test with
    const { data: locations } = await supabase.from('clinic_locations').select('id, name');

    console.log('1. Query WITHOUT location filter:');
    const { data: noLocationFilter, error: e1 } = await supabase
        .from('external_locum_attendance')
        .select('*, external_locums(name, role, phone), clinic_locations(name)')
        .eq('clinic_id', clinicId)
        .gte('date', startDate)
        .lte('date', endDate);

    console.log('Results:', noLocationFilter?.length || 0);
    if (e1) console.log('Error:', e1.message);
    noLocationFilter?.forEach(r => {
        console.log(`  - ${r.external_locums?.name}: ${r.status}`);
    });

    // Test with each location
    for (const loc of (locations || [])) {
        console.log(`\n2. Query WITH locationId=${loc.name}:`);
        const { data: withLocation, error: e2 } = await supabase
            .from('external_locum_attendance')
            .select('*, external_locums(name)')
            .eq('clinic_id', clinicId)
            .eq('location_id', loc.id)
            .gte('date', startDate)
            .lte('date', endDate);

        console.log('Results:', withLocation?.length || 0);
        if (e2) console.log('Error:', e2.message);
    }

    // Check actual location_id values in attendance
    console.log('\n3. Checking location_id values in attendance records:');
    const { data: allAtt } = await supabase
        .from('external_locum_attendance')
        .select('location_id, external_locums(name)');

    allAtt?.forEach(a => {
        const matchingLoc = locations?.find(l => l.id === a.location_id);
        console.log(`  ${a.external_locums?.name}: location=${matchingLoc?.name || 'NULL'} (${a.location_id})`);
    });
}

simulateBackendQuery();
