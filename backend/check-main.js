
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMainAttendance() {
    console.log('=== Checking MAIN attendance table ===\n');

    // Check for locum records in main attendance table
    const { data, error } = await supabase
        .from('attendance')
        .select('id, external_locum_id, date, locum_status, status, external_locums(name)')
        .not('external_locum_id', 'is', null);

    if (error) {
        console.log('ERROR:', error.message);
    } else {
        console.log('Locum records in MAIN attendance table:', data?.length || 0);
        data?.forEach(r => {
            console.log(`  - ${r.external_locums?.name}: locum_status=${r.locum_status}, status=${r.status}, date=${r.date}`);
        });
    }

    // Also check if there's ANY data in main attendance
    const { data: allData } = await supabase.from('attendance').select('id, user_id, external_locum_id');
    console.log('\nTotal records in attendance table:', allData?.length || 0);
    console.log('Staff records:', allData?.filter(r => r.user_id && !r.external_locum_id).length || 0);
    console.log('Locum records:', allData?.filter(r => r.external_locum_id).length || 0);
}

checkMainAttendance();
