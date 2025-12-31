
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deepInspect() {
    console.log('--- Column Check ---');

    // Check external_locum_id
    const { error: err1 } = await supabase.from('external_coverage').select('external_locum_id').limit(1);
    console.log('external_locum_id:', err1 ? 'FAIL (' + err1.message + ')' : 'OK');

    // Check locum_id
    const { error: err2 } = await supabase.from('external_coverage').select('locum_id').limit(1);
    console.log('locum_id:', err2 ? 'FAIL (' + err2.message + ')' : 'OK');
}

deepInspect();
