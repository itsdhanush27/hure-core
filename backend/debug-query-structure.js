
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkQueryStructure() {
    // Pick a known locum ID or fetch one
    const { data: locum } = await supabase
        .from('external_locums')
        .select('id')
        .limit(1)
        .single();

    if (!locum) {
        console.log('No external locums found to test.');
        return;
    }

    console.log(`Testing query for locum: ${locum.id}`);

    const { data, error } = await supabase
        .from('external_locums')
        .select('*, schedule_blocks!inner(start_time, end_time, location_id)')
        .eq('id', locum.id)
        .single();

    if (error) {
        console.error('Query error:', error);
    } else {
        console.log('Query Result Structure:');
        console.log(JSON.stringify(data, null, 2));

        console.log('--------------------------------');
        console.log('Type of schedule_blocks:', Array.isArray(data.schedule_blocks) ? 'Array' : 'Object');
        console.log('Location ID access:', data.schedule_blocks?.location_id);
    }
}

checkQueryStructure();
