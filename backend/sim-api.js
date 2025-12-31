
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function simulateAPIEndpoint() {
    console.log('=== SIMULATING API ENDPOINT ===\n');

    // Same params that the frontend sends
    const clinicId = '57e4ed85-1f2f-42f5-b33e-f156382b3149';
    const startDate = '2025-12-31';
    const endDate = '2025-12-31';
    const includeLocums = 'true';

    console.log('Params: clinicId=%s, startDate=%s, endDate=%s, includeLocums=%s',
        clinicId.substring(0, 8), startDate, endDate, includeLocums);

    // Staff query
    const { data: staffData } = await supabase
        .from('attendance')
        .select('*, users(first_name, last_name, job_title), clinic_locations(name)')
        .eq('clinic_id', clinicId)
        .is('external_locum_id', null)
        .gte('date', startDate)
        .lte('date', endDate);

    console.log('\nStaff records:', staffData?.length || 0);

    let allData = (staffData || []).map(a => ({ ...a, type: 'staff' }));

    // Locum query (EXACTLY as the code does it)
    if (includeLocums === 'true') {
        const { data: locumData, error: locumError } = await supabase
            .from('attendance')
            .select('*, external_locums(name, role, phone), clinic_locations(name)')
            .eq('clinic_id', clinicId)
            .not('external_locum_id', 'is', null)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });

        console.log('\nLocum query result:');
        console.log('  Error:', locumError || 'none');
        console.log('  Count:', locumData?.length || 0);

        if (locumData?.length > 0) {
            console.log('\n  Sample records:');
            locumData.slice(0, 5).forEach(a => {
                console.log(`    ${a.external_locums?.name}: status=${a.locum_status}`);
            });

            // Map them like the API does
            const locumRecords = locumData.map(a => ({
                id: a.id,
                type: 'locum',
                external_locum_id: a.external_locum_id,
                locum_name: a.external_locums?.name || 'External Locum',
                locum_role: a.external_locums?.role || 'Locum',
                status: a.locum_status,
                recorded: true
            }));

            allData = [...allData, ...locumRecords];
        }
    }

    console.log('\n=== FINAL RESULT ===');
    console.log('Total records:', allData.length);
    console.log('Staff:', allData.filter(a => a.type === 'staff').length);
    console.log('Locum:', allData.filter(a => a.type === 'locum').length);

    // Show the data structure that would be returned
    console.log('\nSample API response data:');
    allData.slice(0, 3).forEach(r => {
        console.log(JSON.stringify({ type: r.type, name: r.locum_name || r.users?.first_name, status: r.status || r.locum_status }, null, 2));
    });
}

simulateAPIEndpoint();
