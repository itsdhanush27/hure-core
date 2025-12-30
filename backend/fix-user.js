
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixUser() {
    console.log('--- Fixing User "test" ---')

    // Find user
    const { data: user, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('username', 'test')
        .single()

    if (findError || !user) {
        console.error('User "test" not found:', findError)
        return
    }

    console.log('Found user:', user.email, user.role)

    // Update role
    const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({ role: 'owner', permission_role: 'owner' })
        .eq('id', user.id)
        .select()
        .single()

    if (updateError) {
        console.error('Update failed:', updateError)
    } else {
        console.log('✅ User updated successfully:', updated.role)
    }
}

fixUser()
