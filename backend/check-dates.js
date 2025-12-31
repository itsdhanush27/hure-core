
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDates() {
    console.log('=== CHECKING DATES ===\n');

    const clinicId = '57e4ed85-1f2f-42f5-b33e-f156382b3149';

    // Get all unique dates with locum attendance
    const { data, error } = await supabase
        .from('attendance')
        .select('date, external_locum_id, locum_status')
        .eq('clinic_id', clinicId)
        .not('external_locum_id', 'is', null)
        .order('date', { ascending: false });

    if (error) {
        console.log('Error:', error);
        return;
    }

    console.log('All locum attendance records by date:');
    const dateGroups = {};
    data?.forEach(r => {
        if (!dateGroups[r.date]) dateGroups[r.date] = [];
        dateGroups[r.date].push(r.locum_status);
    });

    Object.entries(dateGroups).forEach(([date, statuses]) => {
        console.log(`  ${date}: ${statuses.length} records - ${statuses.join(', ')}`);
    });

    // Check today
    const today = new Date().toISOString().split('T')[0];
    console.log('\nToday\'s date:', today);
    console.log('Records for today:', dateGroups[today]?.length || 0);
}

checkDates();
