
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAttendanceTable() {
    console.log('=== Testing Attendance Table for Locums ===\n');

    const clinicId = '57e4ed85-1f2f-42f5-b33e-f156382b3149';
    const today = '2025-12-31';

    // Query exactly like the backend does
    console.log('1. Querying attendance table for locum records:');
    const { data, error } = await supabase
        .from('attendance')
        .select('*, external_locums(name, role, phone)')
        .eq('clinic_id', clinicId)
        .not('external_locum_id', 'is', null)
        .gte('date', today)
        .lte('date', today);

    if (error) {
        console.log('ERROR:', error.message);
    } else {
        console.log('Found', data?.length || 0, 'locum attendance records');
        data?.forEach(r => {
            console.log(`  - ${r.external_locums?.name}: locum_status=${r.locum_status}, date=${r.date}, location_id=${r.location_id}`);
        });
    }

    // Check if there are any locum attendance records at all
    console.log('\n2. All locum attendance records (no date filter):');
    const { data: allData } = await supabase
        .from('attendance')
        .select('date, locum_status, external_locums(name)')
        .not('external_locum_id', 'is', null);

    console.log('Total locum attendance records:', allData?.length || 0);
    allData?.forEach(r => {
        console.log(`  - ${r.external_locums?.name}: ${r.locum_status} on ${r.date}`);
    });
}

testAttendanceTable();
