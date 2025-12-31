
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSpecificRecord() {
    const locumId = '1436fc9b-aa46-46a7-bd61-e0f09af14d91';
    console.log(`Checking records for Locum ID: ${locumId}`);

    // 1. Check Attendance
    const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .eq('external_locum_id', locumId);

    if (attError) {
        console.error('Attendance Query Error:', attError.message);
    } else {
        console.log(`Attendance Records Found: ${attendance.length}`);
        attendance.forEach(a => {
            console.log(JSON.stringify(a, null, 2));
        });
    }

    // 2. Check External Coverage
    const { data: coverage, error: covError } = await supabase
        .from('external_coverage')
        .select('*')
        .eq('external_locum_id', locumId);

    if (covError) {
        console.error('Coverage Query Error:', covError.message);
    } else {
        console.log(`Coverage Records Found: ${coverage.length}`);
        coverage.forEach(c => {
            console.log(JSON.stringify(c, null, 2));
        });
    }
}

checkSpecificRecord();
