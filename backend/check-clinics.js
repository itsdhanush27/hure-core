
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkClinicIds() {
    console.log('=== Clinic ID Check ===\n');

    // Get all attendance records
    const { data: attRecords } = await supabase
        .from('external_locum_attendance')
        .select('id, external_locum_id, clinic_id, date, status');

    console.log('All attendance records:');
    attRecords?.forEach(r => {
        console.log(`  clinic_id: ${r.clinic_id}`);
        console.log(`  external_locum_id: ${r.external_locum_id}`);
        console.log(`  date: ${r.date}`);
        console.log(`  status: ${r.status}`);
        console.log('');
    });

    // Get all clinics
    const { data: clinics } = await supabase.from('clinics').select('id, name');
    console.log('\nAll clinics in system:');
    clinics?.forEach(c => {
        console.log(`  ${c.name}: ${c.id}`);
    });

    // Get all external_locums with their clinic IDs
    const { data: locums } = await supabase.from('external_locums').select('id, name, clinic_id');
    console.log('\nAll external locums:');
    locums?.forEach(l => {
        console.log(`  ${l.name}: clinic_id=${l.clinic_id}`);
    });
}

checkClinicIds();
