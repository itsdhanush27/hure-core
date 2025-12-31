
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAttendanceFlow() {
    console.log('=== Testing Full Attendance Flow ===\n');

    // Get clinic and locum info
    const { data: locums } = await supabase.from('external_locums').select('id, name, clinic_id');
    const clinicId = locums?.[0]?.clinic_id;
    const locumId = locums?.[0]?.id;
    const locumName = locums?.[0]?.name;

    console.log('Using clinic:', clinicId);
    console.log('Test locum:', locumName, '- ID:', locumId?.substring(0, 8));

    // 1. Check what's in external_locum_attendance for this clinic and today
    const today = '2025-12-31';
    console.log('\n1. Checking external_locum_attendance for clinic:', clinicId?.substring(0, 8), 'date:', today);

    const { data: attData, error: attError } = await supabase
        .from('external_locum_attendance')
        .select('*, external_locums(name, role, phone), clinic_locations(name)')
        .eq('clinic_id', clinicId)
        .gte('date', today)
        .lte('date', today);

    if (attError) {
        console.log('ERROR:', attError.message);
    } else {
        console.log('Records found:', attData?.length || 0);
        attData?.forEach(a => {
            console.log(`  - external_locum_id: ${a.external_locum_id}`);
            console.log(`    name: ${a.external_locums?.name}`);
            console.log(`    status: ${a.status}`);
            console.log(`    date: ${a.date}`);
        });
    }

    // 2. List all external_locums and check if their IDs match what's in attendance
    console.log('\n2. All external locums in system:');
    locums?.forEach(l => {
        console.log(`  - ${l.name}: ${l.id}`);
    });

    // 3. Check if IDs match
    console.log('\n3. ID Matching check:');
    const attendanceLocumIds = new Set(attData?.map(a => a.external_locum_id) || []);
    locums?.forEach(l => {
        const hasAttendance = attendanceLocumIds.has(l.id);
        console.log(`  ${l.name}: attendance recorded = ${hasAttendance}`);
    });
}

testAttendanceFlow();
