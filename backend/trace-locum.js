// Trace Locum Data
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function traceLocum() {
    const fs = await import('fs')
    const logFile = path.join(__dirname, 'trace.txt')
    const log = (msg) => {
        console.log(msg)
        fs.appendFileSync(logFile, msg + '\n')
    }

    // Clear log
    fs.writeFileSync(logFile, '')

    log('--- Tracing "doctor locum" ---')

    // 1. Find the locum
    const { data: locums, error } = await supabase
        .from('external_locums')
        .select('*')
        .ilike('name', '%doctor locum%')

    if (error) {
        log('Error finding locum: ' + JSON.stringify(error))
        return
    }

    if (!locums || locums.length === 0) {
        log('No locum found with name "doctor locum"')
        return
    }

    log(`Found ${locums.length} locums.`)

    for (const locum of locums) {
        log(`\nLocum: ${locum.name} (ID: ${locum.id})`)
        log(`  Current Locum Location ID: ${locum.location_id}`)
        log(`  Schedule Block ID:   ${locum.schedule_block_id}`)

        if (locum.schedule_block_id) {
            const { data: block } = await supabase
                .from('schedule_blocks')
                .select('*, clinic_locations(name)')
                .eq('id', locum.schedule_block_id)
                .single()

            log(`  Linked Block:`)
            log(`    ID: ${block?.id}`)
            log(`    Location ID: ${block?.location_id}`)
            log(`    Location Name: ${block?.clinic_locations?.name}`)
        } else {
            log('  -> NO SCHEDULE BLOCK LINKED')
        }

        // Check attendance
        const { data: att } = await supabase
            .from('attendance')
            .select('*')
            .eq('external_locum_id', locum.id)

        log(`  Attendance Records: ${att?.length}`)
        if (att?.length > 0) {
            log(`  First Att Location ID: ${att[0].location_id}`)
        }
    }
}

traceLocum()
