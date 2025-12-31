// Debug script to check locum location IDs
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

async function checkData() {
    console.log('--- Checking External Locums with Locations ---')
    const { data: locums, error: locumError } = await supabase
        .from('external_locums')
        .select('id, name, location_id, location:clinic_locations(name)')
        .limit(10)

    if (locumError) console.error(locumError)
    else console.table(locums.map(l => ({
        name: l.name,
        loc_id: l.location_id,
        loc_name: l.location?.name || 'NULL'
    })))

    console.log('\n--- Checking Attendance Records for Locums ---')
    const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select('id, external_locum_id, location_id, locum_status, location:clinic_locations(name), external_locums(name)')
        .not('external_locum_id', 'is', null)
        .order('date', { ascending: false })
        .limit(10)

    if (attError) console.error(attError)
    else console.table(attendance.map(a => ({
        locum: a.external_locums?.name,
        status: a.locum_status,
        att_loc_id: a.location_id,
        att_loc_name: a.location?.name || 'NULL'
    })))

    // Check specific location match
    if (locums.length > 0 && locums[0].location_id) {
        const testLocId = locums[0].location_id
        console.log(`\n--- Testing Filter for Location: ${testLocId} (${locums[0].location?.name}) ---`)

        const { count, error } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('location_id', testLocId)
            .not('external_locum_id', 'is', null)

        console.log(`Found ${count} attendance records for this location`)
    }
}

checkData()
