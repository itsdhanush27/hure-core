
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function discoverColumns() {
    console.log('--- Discovering Columns ---');
    const clinicId = '57e4ed85-1f2f-42f5-b33e-f156382b3149';

    // Get a valid location
    const { data: loc } = await supabase.from('clinic_locations').select('id').eq('clinic_id', clinicId).limit(1).single();
    const locationId = loc?.id;
    console.log('Using Location:', locationId);

    // Attempt: Insert clinic_id + location_id + date
    console.log('Attempting insert with date...');
    const { data, error } = await supabase
        .from('external_coverage')
        .insert({
            clinic_id: clinicId,
            location_id: locationId,
            date: '2025-12-31',
            external_name: 'Test Locum'
        })
        .select();

    if (error) {
        const msg = error.message;
        const match = msg.match(/null value in column "([^"]+)"/);
        if (match) {
            console.log('MISSING COLUMN:', match[1]);
        } else {
            console.log('Insert Error (Short):', msg.substring(0, 100));
        }
    } else {
        console.log('Insert Success! Keys:', Object.keys(data[0]));
        await supabase.from('external_coverage').delete().eq('id', data[0].id);
    }
}

discoverColumns();
