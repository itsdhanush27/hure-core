// Debug script to reproduce 500 error
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testQuery() {
    console.log('--- Testing STAFF Attendance Query ---')
    const clinicId = '57e4ed85-1f2f-42f5-b33e-f156382b3149' // From logs

    try {
        const { data, error } = await supabase
            .from('attendance')
            .select('*, users:user_id(first_name, last_name, job_title), clinic_locations(name)')
            .eq('clinic_id', clinicId)
            .is('external_locum_id', null)
            .limit(5)

        if (error) {
            console.error('STAFF QUERY ERROR:', error)
        } else {
            console.log('Staff Query success! Records:', data.length)
        }
    } catch (err) {
        console.error('EXCEPTION:', err)
    }
}

testQuery()
