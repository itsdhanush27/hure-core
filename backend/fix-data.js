// Fix Data Consistency Script
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function fixData() {
    console.log('--- STARTING DATA FIX ---')

    // 1. Fetch locums with missing location_id
    // Actually, let's just fetch ALL locums to be safe and double check
    const { data: locums, error: locErr } = await supabase
        .from('external_locums')
        .select(`
            id, 
            name, 
            location_id, 
            schedule_block_id, 
            schedule_blocks (
                location_id,
                clinic_locations (name)
            )
        `)

    if (locErr) {
        console.error('Error fetching locums:', locErr)
        return
    }

    console.log(`Checking ${locums.length} external locums...`)

    let updatedCount = 0

    for (const locum of locums) {
        const blockLocId = locum.schedule_blocks?.location_id
        const blockLocName = locum.schedule_blocks?.clinic_locations?.name

        if (blockLocId && locum.location_id !== blockLocId) {
            console.log(`Fixing locum: ${locum.name} (${locum.id})`)
            console.log(`   Current Loc: ${locum.location_id}`)
            console.log(`   Target Loc:  ${blockLocId} (${blockLocName})`)

            const { error: updateErr } = await supabase
                .from('external_locums')
                .update({ location_id: blockLocId })
                .eq('id', locum.id)

            if (updateErr) console.error('   Update failed:', updateErr)
            else updatedCount++
        }
    }
    console.log(`Updated ${updatedCount} locums with correct location_id.`)

    // 2. Fix ATTENDANCE records
    console.log('\n--- Checking Attendance Records ---')
    // Fetch all attendance for locums
    const { data: attendance, error: attErr } = await supabase
        .from('attendance')
        .select(`
            id,
            external_locum_id,
            location_id,
            external_locums (
                location_id,
                name
            )
        `)
        .not('external_locum_id', 'is', null)

    if (attErr) {
        console.error('Error fetching attendance:', attErr)
        return
    }

    console.log(`Checking ${attendance.length} attendance records...`)
    let attUpdatedCount = 0

    for (const record of attendance) {
        const locumLocId = record.external_locums?.location_id

        if (locumLocId && record.location_id !== locumLocId) {
            console.log(`Fixing attendance for: ${record.external_locums?.name}`)
            console.log(`   Current Att Loc: ${record.location_id}`)
            console.log(`   Target Loc:      ${locumLocId}`)

            const { error: upErr } = await supabase
                .from('attendance')
                .update({ location_id: locumLocId })
                .eq('id', record.id)

            if (upErr) console.error('   Update failed:', upErr)
            else attUpdatedCount++
        }
    }
    console.log(`Updated ${attUpdatedCount} attendance records.`)
    console.log('--- DONE ---')
}

fixData()
