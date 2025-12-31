
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function locationMismatch() {
    console.log('=== Location Mismatch Check ===\n');

    // Get all locations
    const { data: locations } = await supabase.from('clinic_locations').select('*');
    console.log('All locations:');
    locations?.forEach(l => {
        console.log(`  ${l.name}: id=${l.id}`);
    });

    // Get attendance location_ids
    const { data: attendance } = await supabase.from('external_locum_attendance').select('location_id, external_locums(name)');
    console.log('\nAttendance location_ids:');
    attendance?.forEach(a => {
        console.log(`  ${a.external_locums?.name}: location_id=${a.location_id}`);
    });

    // Check if they match
    console.log('\nLocation ID matching:');
    attendance?.forEach(a => {
        const match = locations?.find(l => l.id === a.location_id);
        console.log(`  ${a.external_locums?.name}: matches "${match?.name || 'NONE'}"`);
        if (!match) {
            console.log(`    ⚠️ location_id ${a.location_id} NOT FOUND in locations!`);
        }
    });
}

locationMismatch();
