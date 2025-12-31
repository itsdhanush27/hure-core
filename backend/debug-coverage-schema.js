
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
    console.log('Checking external_coverage schema...');

    // 1. Try to fetch one row (if exists) or just check error
    const { data, error } = await supabase
        .from('external_coverage')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Query Error:', error.message);
    } else {
        console.log('Query Success. Data:', data);
        if (data.length === 0) {
            console.log('Table is empty. Trying to insert a dummy record to see constraints/columns is risky without knowing columns.');
            // Since it's empty, I can't see keys. 
            // But if specific select failed before, maybe I can try selecting specific columns to confirm they exist?

            // Try check if 'external_locum_id' exists
            const { error: colError } = await supabase
                .from('external_coverage')
                .select('external_locum_id')
                .limit(1);

            if (colError) {
                console.log('Column external_locum_id likely DOES NOT exist:', colError.message);

                // Try 'locum_id'
                const { error: colError2 } = await supabase
                    .from('external_coverage')
                    .select('locum_id')
                    .limit(1);
                if (colError2) console.log('Column locum_id likely DOES NOT exist:', colError2.message);
                else console.log('Column locum_id EXISTS.');
            } else {
                console.log('Column external_locum_id EXISTS.');
            }
        } else {
            console.log('Keys:', Object.keys(data[0]));
        }
    }
}

checkSchema();
