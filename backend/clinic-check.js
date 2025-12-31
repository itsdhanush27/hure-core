
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkClinicIdIssue() {
    console.log('=== Clinic ID Deep Check ===\n');

    // Get all attendance records
    const { data: attendance } = await supabase
        .from('external_locum_attendance')
        .select('clinic_id, location_id, external_locums(name, clinic_id)');

    console.log('Attendance records clinic IDs:');
    attendance?.forEach(a => {
        console.log(`  ${a.external_locums?.name}:`);
        console.log(`    attendance.clinic_id: ${a.clinic_id}`);
        console.log(`    locum.clinic_id: ${a.external_locums?.clinic_id}`);
        console.log(`    match: ${a.clinic_id === a.external_locums?.clinic_id}`);
    });

    // Get all clinics to show valid options
    const { data: clinics } = await supabase.from('clinics').select('id, name');
    console.log('\nAll clinic IDs in system:');
    clinics?.forEach(c => {
        console.log(`  ${c.name}: ${c.id}`);
    });

    // Check locations' clinic_ids too
    const { data: locations } = await supabase.from('clinic_locations').select('id, name, clinic_id');
    console.log('\nLocation clinic_ids:');
    locations?.forEach(l => {
        console.log(`  ${l.name}: clinic_id=${l.clinic_id}`);
    });
}

checkClinicIdIssue();
