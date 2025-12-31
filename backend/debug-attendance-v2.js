
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAttendance() {
    const clinicId = '57e4ed85-1f2f-42f5-b33e-f156382b3149';
    const date = '2025-12-31';

    console.log(`Checking attendance (v2) for clinic: ${clinicId} on ${date}`);

    const { data: attendance, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('date', date);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`ATTENDANCE_COUNT: ${attendance.length}`);
        attendance.forEach(a => {
            console.log(JSON.stringify(a, null, 0));
        });
    }
}

checkAttendance();
