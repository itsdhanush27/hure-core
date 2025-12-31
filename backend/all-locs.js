
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAllLocations() {
    console.log('=== All Locations and IDs ===\n');

    // Get all locations
    const { data: locations } = await supabase.from('clinic_locations').select('id, name, clinic_id');
    console.log('Locations in system:');
    locations?.forEach(l => {
        console.log(`  "${l.name}": ${l.id}`);
    });

    // Get attendance records with full location details
    const { data: attendance } = await supabase
        .from('external_locum_attendance')
        .select('location_id, date, status, external_locums(name)');

    console.log('\nAttendance records:');
    attendance?.forEach(a => {
        const loc = locations?.find(l => l.id === a.location_id);
        console.log(`  ${a.external_locums?.name}: saved with location "${loc?.name || 'NULL'}" (${a.location_id})`);
    });

    // If user selects "mosomi branch", what ID would be sent?
    const mosomiBranch = locations?.find(l => l.name?.toLowerCase().includes('mosomi'));
    console.log('\nMosomi branch location ID:', mosomiBranch?.id);

    // Are there any attendance records that would match mosomi branch?
    const matchingRecords = attendance?.filter(a => a.location_id === mosomiBranch?.id);
    console.log('Attendance records matching mosomi branch:', matchingRecords?.length);
}

checkAllLocations();
