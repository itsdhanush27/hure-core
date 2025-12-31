
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

    console.log(`Checking attendance for clinic: ${clinicId} on ${date}`);

    // 1. Fetch attendance records
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
            console.log(`ATT: ${a.id.substring(0, 8)} | LocumID: ${a.external_locum_id?.substring(0, 8)} | LocID: ${a.location_id} | Stat: ${a.locum_status}`);
        });
    }

    // 2. Fetch external locums for that date (via schedule blocks)
    // First get blocks for that date
    const { data: blocks } = await supabase
        .from('schedule_blocks')
        .select('id, location_id')
        .eq('clinic_id', clinicId)
        .eq('date', date);

    const blockIds = (blocks || []).map(b => b.id);
    console.log(`Found ${blockIds.length} blocks for this date.`);

    if (blockIds.length > 0) {
        const { data: locums } = await supabase
            .from('external_locums')
            .select('*')
            .in('schedule_block_id', blockIds);

        console.log(`Found ${locums?.length} external locums scheduled.`);
        locums?.forEach(l => {
            console.log(`- ID: ${l.id}, Name: ${l.name}, BlockID: ${l.schedule_block_id}`);
        });
    }
}

checkAttendance();
