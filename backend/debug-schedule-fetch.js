
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fetchSchedule() {
    // Clinic ID from user context: 57e4ed85-1f2f-42f5-b33e-f156382b3149
    const clinicId = '57e4ed85-1f2f-42f5-b33e-f156382b3149';

    // Simulate the query used in clinics.js
    console.log(`Fetching schedule for clinic: ${clinicId}`);

    // Replicate the query from backend/routes/clinics.js
    let query = supabase
        .from('schedule_blocks')
        .select('*, clinic_locations(name), schedule_assignments(*, users(first_name, last_name))')
        .eq('clinic_id', clinicId);

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching schedule:', error);
    } else {
        console.log('Schedule data fetched successfully.');
        if (data && data.length > 0) {
            // Find a block with assignments
            const blockWithAssignments = data.find(b => b.schedule_assignments && b.schedule_assignments.length > 0);

            if (blockWithAssignments) {
                const assignment = blockWithAssignments.schedule_assignments[0];
                console.log('IS_ARRAY:', Array.isArray(assignment.users));
            } else {
                console.log('No blocks with assignments found.');
            }
        } else {
            console.log('No schedule data found.');
        }
    }
}

fetchSchedule();
