
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugPersistence() {
    console.log('=== Debug Attendance Persistence ===\n');

    // 1. Check what's in external_locum_attendance
    console.log('1. Records in external_locum_attendance:');
    const { data: attRecords, error: attError } = await supabase
        .from('external_locum_attendance')
        .select('id, external_locum_id, clinic_id, date, status');

    if (attError) {
        console.error('Error:', attError.message);
    } else {
        console.log('Count:', attRecords?.length || 0);
        attRecords?.forEach(r => {
            console.log(`  - locum: ${r.external_locum_id?.substring(0, 8)}, clinic: ${r.clinic_id?.substring(0, 8)}, date: ${r.date}, status: ${r.status}`);
        });
    }

    // 2. Check external_locums to get their IDs
    console.log('\n2. External locums:');
    const { data: locums } = await supabase
        .from('external_locums')
        .select('id, name, clinic_id');

    locums?.forEach(l => {
        console.log(`  - ${l.name}: id=${l.id?.substring(0, 8)}, clinic=${l.clinic_id?.substring(0, 8)}`);
    });

    // 3. Check if clinic_id matches between locums and attendance
    console.log('\n3. Clinic ID comparison:');
    const locumClinicIds = new Set(locums?.map(l => l.clinic_id));
    const attClinicIds = new Set(attRecords?.map(r => r.clinic_id));
    console.log('Locum clinic IDs:', [...locumClinicIds]);
    console.log('Attendance clinic IDs:', [...attClinicIds]);

    // 4. Try the exact query the backend uses
    console.log('\n4. Testing backend GET query:');
    const clinicId = locums?.[0]?.clinic_id;
    const today = '2025-12-31';

    if (clinicId) {
        const { data: testData, error: testError } = await supabase
            .from('external_locum_attendance')
            .select('*, external_locums(name, role, phone), clinic_locations(name)')
            .eq('clinic_id', clinicId)
            .gte('date', today)
            .lte('date', today);

        console.log('Query with clinic_id:', clinicId.substring(0, 8));
        console.log('Results:', testData?.length || 0);
        if (testError) console.error('Error:', testError.message);
        testData?.forEach(r => {
            console.log(`  - ${r.external_locums?.name}: status=${r.status}`);
        });
    }
}

debugPersistence();
