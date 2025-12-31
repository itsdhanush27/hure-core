
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fullDebug() {
    console.log('=== FULL COMPREHENSIVE DEBUG ===\n');

    const clinicId = '57e4ed85-1f2f-42f5-b33e-f156382b3149';
    const today = '2025-12-31';

    // 1. All locum attendance records for this clinic
    console.log('1. ALL locum attendance records for this clinic:');
    const { data: allLocum, error: e1 } = await supabase
        .from('attendance')
        .select('id, external_locum_id, locum_status, date, location_id')
        .eq('clinic_id', clinicId)
        .not('external_locum_id', 'is', null);

    console.log('Count:', allLocum?.length || 0);
    if (e1) console.log('Error:', e1);
    allLocum?.slice(0, 5).forEach(r => {
        console.log(`  id: ${r.id.substring(0, 8)}, locum_id: ${r.external_locum_id?.substring(0, 8)}, status: ${r.locum_status}, date: ${r.date}, loc: ${r.location_id?.substring(0, 8)}`);
    });

    // 2. Today's locum attendance
    console.log('\n2. TODAY\'s locum attendance:');
    const { data: todayLocum, error: e2 } = await supabase
        .from('attendance')
        .select('id, external_locum_id, locum_status, date, location_id')
        .eq('clinic_id', clinicId)
        .not('external_locum_id', 'is', null)
        .eq('date', today);

    console.log('Count:', todayLocum?.length || 0);
    if (e2) console.log('Error:', e2);
    todayLocum?.forEach(r => {
        console.log(`  id: ${r.id.substring(0, 8)}, locum_id: ${r.external_locum_id?.substring(0, 8)}, status: ${r.locum_status}, date: ${r.date}`);
    });

    // 3. Check if external_locums join works
    console.log('\n3. Query with external_locums join:');
    const { data: withJoin, error: e3 } = await supabase
        .from('attendance')
        .select('id, external_locum_id, locum_status, date, external_locums(name, role)')
        .eq('clinic_id', clinicId)
        .not('external_locum_id', 'is', null)
        .eq('date', today);

    console.log('Count:', withJoin?.length || 0);
    if (e3) console.log('Error:', e3);
    withJoin?.forEach(r => {
        console.log(`  ${r.external_locums?.name}: status=${r.locum_status}`);
    });

    // 4. What external locums exist for today's shifts?
    console.log('\n4. External locums from schedule for today:');
    const { data: scheduleLocums } = await supabase
        .from('external_locums')
        .select('id, name, schedule_block_id, schedule_blocks(date, clinic_id)')
        .eq('clinic_id', clinicId);

    console.log('Total locums:', scheduleLocums?.length || 0);
    scheduleLocums?.forEach(l => {
        console.log(`  ${l.name}: block_date=${l.schedule_blocks?.date}`);
    });
}

fullDebug();
