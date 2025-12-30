
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugUsers() {
    console.log('--- Fetching Users ---')
    const { data: users, error } = await supabase
        .from('users')
        .select('id, email, username, role, permission_role, clinic_id')

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log(JSON.stringify(users, null, 2))
}

debugUsers()
