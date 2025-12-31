
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function checkSchema() {
    const logFile = path.join(__dirname, 'schema.txt')
    const log = (msg) => {
        console.log(msg)
        fs.appendFileSync(logFile, msg + '\n')
    }
    fs.writeFileSync(logFile, '')

    log('--- Checking Schema ---')
    const tables = ['users', 'leave_requests', 'leave_types', 'external_locums', 'payroll_runs', 'payroll_items', 'allowances']

    for (const table of tables) {
        log(`\nTable: ${table}`)
        const { data, error } = await supabase.from(table).select('*').limit(1)
        if (error) {
            log(`  Status: ${error.message}`)
        } else {
            log(`  Status: Exists`)
            if (data && data.length > 0) {
                log(`  Columns: ${Object.keys(data[0]).join(', ')}`)
            } else {
                log(`  (Table empty, cannot list columns via select)`)
            }
        }
    }
}

checkSchema()
