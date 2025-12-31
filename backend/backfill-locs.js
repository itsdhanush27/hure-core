
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillLocationIds() {
    console.log('=== Backfilling location_id for locum attendance records ===\n');

    // Get all locum attendance records with NULL location_id
    const { data: records, error } = await supabase
        .from('attendance')
        .select('id, external_locum_id, location_id')
        .not('external_locum_id', 'is', null)
        .is('location_id', null);

    if (error) {
        console.error('Error fetching records:', error.message);
        return;
    }

    console.log(`Found ${records?.length || 0} records with NULL location_id`);

    for (const record of (records || [])) {
        // Get the locum's schedule block location_id
        const { data: locum } = await supabase
            .from('external_locums')
            .select('id, name, schedule_blocks(location_id)')
            .eq('id', record.external_locum_id)
            .single();

        const locationId = locum?.schedule_blocks?.location_id;

        if (locationId) {
            // Update the attendance record
            const { error: updateError } = await supabase
                .from('attendance')
                .update({ location_id: locationId })
                .eq('id', record.id);

            if (updateError) {
                console.log(`  ❌ Failed to update ${locum?.name}: ${updateError.message}`);
            } else {
                console.log(`  ✅ Updated ${locum?.name} with location_id: ${locationId.substring(0, 8)}...`);
            }
        } else {
            console.log(`  ⚠️ No location_id found for locum ${locum?.name}`);
        }
    }

    console.log('\n=== Backfill complete ===');
}

backfillLocationIds();
