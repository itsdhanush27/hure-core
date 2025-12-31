// Debug Main Clinic Data
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function debugMain() {
    console.log('--- Finding "main clinic" location ---')
    // Fuzzy search for "main" or "Main"
    const { data: locations } = await supabase
        .from('clinic_locations')
        .select('*')
        .ilike('name', '%main%')

    if (!locations || locations.length === 0) {
        console.log('No location found with "main" in name')
        return
    }

    const mainLoc = locations[0]
    console.log(`Found Location: ${mainLoc.name} (${mainLoc.id})`)

    console.log('\n--- Checking External Locums for this Location ---')
    const { data: locums } = await supabase
        .from('external_locums')
        .select('id, name, location_id, schedule_block_id')
        .eq('location_id', mainLoc.id)

    console.log(`Found ${locums?.length || 0} locums assigned to this location`)
    if (locums?.length > 0) {
        console.table(locums.slice(0, 5))
    }

    console.log('\n--- Checking Attendance for this Location ---')
    const { data: attendance } = await supabase
        .from('attendance')
        .select('id, external_locum_id, location_id, locum_status')
        .eq('location_id', mainLoc.id)
        .not('external_locum_id', 'is', null)

    console.log(`Found ${attendance?.length || 0} attendance records with this location_id`)
    if (attendance?.length > 0) {
        console.table(attendance.slice(0, 5))
    }

    console.log('\n--- Checking "Lost" Attendance (Locums in this loc but attendance has NULL loc) ---')
    // Find attendance for locums that belong to this location, but the attendance record itself has wrong/null location
    if (locums && locums.length > 0) {
        const locumIds = locums.map(l => l.id)
        const { data: lostAtt } = await supabase
            .from('attendance')
            .select('id, external_locum_id, location_id, locum_status')
            .in('external_locum_id', locumIds)
            .neq('location_id', mainLoc.id) // Location mismatch
        // OR null

        // Handling OR is hard in supabase-js v1/v2 mixed syntax awareness.
        // Let's just fetch all by IDs and filter in JS
        const { data: allAttForLocums } = await supabase
            .from('attendance')
            .select('id, external_locum_id, location_id, locum_status, external_locums(name)')
            .in('external_locum_id', locumIds)

        const mismatches = allAttForLocums.filter(a => a.location_id !== mainLoc.id)
        console.log(`Found ${mismatches.length} mismatches where locum is in Main but attendance is NOT linked to Main`)
        if (mismatches.length > 0) {
            console.table(mismatches.slice(0, 5).map(m => ({
                id: m.id,
                locum: m.external_locums?.name,
                att_loc: m.location_id,
                expected: mainLoc.id
            })))
        }
    }
}

debugMain()
