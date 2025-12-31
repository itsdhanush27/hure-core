
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testQuery() {
    console.log('=== Testing EXACT backend query ===\n');

    const clinicId = '57e4ed85-1f2f-42f5-b33e-f156382b3149';
    const today = '2025-12-31';

    // Get locations first
    const { data: locations } = await supabase.from('clinic_locations').select('id, name').eq('clinic_id', clinicId);
    console.log('Locations:');
    locations?.forEach(l => console.log(`  ${l.name}: ${l.id}`));

    // Find mosomi branch
    const mosomiBranch = locations?.find(l => l.name?.toLowerCase().includes('mosomi'));
    console.log('\nMosomi Branch ID:', mosomiBranch?.id);

    // Test query WITHOUT location filter
    console.log('\n1. Query WITHOUT location filter:');
    const { data: noFilter, error: e1 } = await supabase
        .from('attendance')
        .select('id, external_locum_id, locum_status, date, location_id, external_locums(name)')
        .eq('clinic_id', clinicId)
        .not('external_locum_id', 'is', null)
        .gte('date', today)
        .lte('date', today);

    console.log('Results:', noFilter?.length || 0);
    if (e1) console.log('Error:', e1.message);
    noFilter?.forEach(r => console.log(`  ${r.external_locums?.name}: status=${r.locum_status}, loc=${r.location_id?.substring(0, 8)}`));

    // Test query WITH mosomi branch location filter
    if (mosomiBranch) {
        console.log('\n2. Query WITH mosomi branch filter:');
        const { data: withFilter, error: e2 } = await supabase
            .from('attendance')
            .select('id, external_locum_id, locum_status, date, location_id, external_locums(name)')
            .eq('clinic_id', clinicId)
            .eq('location_id', mosomiBranch.id)
            .not('external_locum_id', 'is', null)
            .gte('date', today)
            .lte('date', today);

        console.log('Results:', withFilter?.length || 0);
        if (e2) console.log('Error:', e2.message);
        withFilter?.forEach(r => console.log(`  ${r.external_locums?.name}: status=${r.locum_status}`));
    }

    // Check unique location_ids in locum attendance
    console.log('\n3. Location IDs in locum attendance records for today:');
    const locIds = new Set(noFilter?.map(r => r.location_id) || []);
    console.log('Unique location_ids:', [...locIds]);
}

testQuery();
