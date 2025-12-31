
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

async function fixAttendanceLocations() {
    console.log('Fetching attendance records with NULL location_id...');

    // 1. Get bad records
    const { data: records, error } = await supabase
        .from('attendance')
        .select(`
            id, 
            external_locum_id,
            external_locums (
                schedule_block_id,
                schedule_blocks (
                    location_id
                )
            )
        `)
        .is('location_id', null)
        .not('external_locum_id', 'is', null);

    if (error) {
        console.error('Error fetching records:', error);
        return;
    }

    console.log(`Found ${records.length} records to fix.`);

    for (const record of records) {
        const locum = record.external_locums;
        if (locum && locum.schedule_blocks && locum.schedule_blocks.location_id) {
            const correctLocationId = locum.schedule_blocks.location_id;
            console.log(`Fixing attendance ${record.id}: Setting location to ${correctLocationId}`);

            const { error: updateError } = await supabase
                .from('attendance')
                .update({ location_id: correctLocationId })
                .eq('id', record.id);

            if (updateError) {
                console.error(`Failed to update ${record.id}:`, updateError);
            } else {
                console.log(`✅ Fixed record ${record.id}`);
            }
        } else {
            console.warn(`Could not resolve location for attendance ${record.id}`);
        }
    }

    console.log('Done.');
}

fixAttendanceLocations();
