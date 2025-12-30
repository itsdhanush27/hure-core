
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugSchedule() {
    console.log('--- Fetching Schedule ---')
    // Use the exact query from clinics.js
    const { data, error } = await supabase
        .from('schedule_blocks')
        .select('*, clinic_locations(name), schedule_assignments(id, user_id, is_external, external_name, users(first_name, last_name))')
        .limit(5)

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log(JSON.stringify(data, null, 2))
}

debugSchedule()
