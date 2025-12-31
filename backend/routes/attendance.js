import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware } from '../lib/auth.js'

// UPDATED: 2025-12-31 16:30 - Fixed locum attendance display
const router = express.Router({ mergeParams: true })

// GET /api/clinics/:clinicId/attendance
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { locationId, startDate, endDate, includeLocums } = req.query

        console.log('=== ATTENDANCE GET v3 ===')
        console.log('clinicId:', clinicId)
        console.log('includeLocums:', includeLocums)

        // Fetch staff attendance (exclude locums)
        let staffQuery = supabaseAdmin
            .from('attendance')
            .select('*, users:user_id(first_name, last_name, job_title), clinic_locations(name)')
            .eq('clinic_id', clinicId)
            .is('external_locum_id', null)
            .order('date', { ascending: false })

        if (locationId && locationId !== 'all') {
            staffQuery = staffQuery.eq('location_id', locationId)
        }
        if (startDate) {
            staffQuery = staffQuery.gte('date', startDate)
        }
        if (endDate) {
            staffQuery = staffQuery.lte('date', endDate)
        }

        const { data: staffData, error: staffError } = await staffQuery

        if (staffError) {
            return res.status(500).json({ error: 'Failed to fetch attendance' })
        }

        let allData = (staffData || []).map(a => ({ ...a, type: 'staff' }))
        let debugInfo = { staffCount: staffData?.length || 0, locumCount: 0, locumError: null }

        // Fetch locum attendance
        if (includeLocums === 'true') {
            console.log(`Fetching locums for clinicId: ${clinicId}`)

            // Query attendance table - assuming location_id is now correctly populated by migration
            let locumQuery = supabaseAdmin
                .from('attendance')
                .select('*, external_locums(name, role, phone, location_id), clinic_locations(name)')
                .eq('clinic_id', clinicId)
                .not('external_locum_id', 'is', null)
                .order('date', { ascending: false })

            if (locationId && locationId !== 'all') {
                console.log(`Applying location filter: ${locationId}`)
                locumQuery = locumQuery.eq('location_id', locationId)
            }

            if (startDate) {
                locumQuery = locumQuery.gte('date', startDate)
            }
            if (endDate) {
                locumQuery = locumQuery.lte('date', endDate)
            }

            const { data: locumData, error: locumError } = await locumQuery

            console.log('Locum query count:', locumData?.length || 0)
            if (locumError) {
                console.error('Error fetching locum attendance:', locumError)
                debugInfo.locumError = locumError.message
            }

            if (!locumError && locumData) {
                const locumRecords = locumData.map(a => ({
                    ...a,
                    type: 'locum',
                    external_locum_id: a.external_locum_id,
                    locum_id: a.external_locum_id,
                    locum_name: a.external_locums?.name || 'External Locum',
                    locum_role: a.external_locums?.role || 'Locum',
                    locum_phone: a.external_locums?.phone,
                    status: a.locum_status,
                    locum_status: a.locum_status,
                    recorded: true
                }))
                allData = [...allData, ...locumRecords]
            }
        }

        res.json({ data: allData, debug: debugInfo, _version: 'v3_locum_fix' })
    } catch (err) {
        console.error('Get attendance error:', err)
        res.status(500).json({
            error: 'Failed to fetch attendance',
            details: err.message,
            stack: err.stack
        })
    }
})

// POST /api/clinics/:clinicId/attendance/locum - Record locum attendance
router.post('/locum', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { externalLocumId, date, status, hoursWorked } = req.body

        if (!externalLocumId || !date || !status) {
            return res.status(400).json({ error: 'Locum ID, date, and status required' })
        }

        const { data: locum } = await supabaseAdmin
            .from('external_locums')
            .select('*, schedule_blocks!inner(start_time, end_time)')
            .eq('id', externalLocumId)
            .single()

        if (!locum) {
            return res.status(404).json({ error: 'Locum not found' })
        }

        // Use direct location_id or fallback to schedule block
        const locationId = locum.location_id || locum.schedule_blocks?.location_id

        let hours = hoursWorked
        if (!hours && locum?.schedule_blocks) {
            const start = new Date(`2000-01-01T${locum.schedule_blocks.start_time}`)
            const end = new Date(`2000-01-01T${locum.schedule_blocks.end_time}`)
            hours = (end - start) / (1000 * 60 * 60)
        }

        const { data: existing } = await supabaseAdmin
            .from('attendance')
            .select('id')
            .eq('external_locum_id', externalLocumId)
            .eq('date', date)
            .maybeSingle()

        let data, error

        if (existing) {
            const result = await supabaseAdmin
                .from('attendance')
                .update({
                    locum_status: status,
                    total_hours: status === 'WORKED' ? (hours || 8) : 0,
                    status: status === 'WORKED' ? 'present_full' : 'absent'
                })
                .eq('id', existing.id)
                .select('*, external_locums(name, role, phone)')
                .single()
            data = result.data
            error = result.error
        } else {
            const result = await supabaseAdmin
                .from('attendance')
                .insert({
                    clinic_id: clinicId,
                    location_id: locationId,
                    external_locum_id: externalLocumId,
                    date,
                    attendance_type: 'confirmation',
                    locum_status: status,
                    total_hours: status === 'WORKED' ? (hours || 8) : 0,
                    status: status === 'WORKED' ? 'present_full' : 'absent'
                })
                .select('*, external_locums(name, role, phone)')
                .single()
            data = result.data
            error = result.error
        }

        if (error) {
            console.error('Record locum attendance error:', error)
            return res.status(500).json({ error: 'Failed to record locum attendance', details: error.message })
        }

        // Record in external_coverage for payroll
        await supabaseAdmin
            .from('external_coverage')
            .upsert({
                clinic_id: clinicId,
                location_id: locationId,
                external_name: locum.name,
                role: locum.role,
                date,
                status: status,
                hours_worked: status === 'WORKED' ? (hours || 8) : 0,
                agreed_pay: 0,
                payroll_status: 'pending'
            }, {
                onConflict: 'clinic_id,external_name,date',
                ignoreDuplicates: true
            })

        console.log('✅ Locum attendance recorded:', externalLocumId, status)
        res.json({ success: true, data })
    } catch (err) {
        console.error('Record locum attendance error:', err)
        res.status(500).json({ error: 'Failed to record locum attendance' })
    }
})

// POST /api/clinics/:clinicId/attendance/clock-in
router.post('/clock-in', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { userId, locationId } = req.body
        const today = new Date().toISOString().split('T')[0]

        const { data: existing } = await supabaseAdmin
            .from('attendance')
            .select('id')
            .eq('user_id', userId)
            .eq('date', today)
            .single()

        if (existing) {
            return res.status(400).json({ error: 'Already clocked in today' })
        }

        const { data, error } = await supabaseAdmin
            .from('attendance')
            .insert({
                clinic_id: clinicId,
                location_id: locationId,
                user_id: userId,
                date: today,
                clock_in: new Date().toISOString()
            })
            .select()
            .single()

        if (error) {
            console.error('Clock in error:', error)
            return res.status(500).json({ error: 'Failed to clock in' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Clock in error:', err)
        res.status(500).json({ error: 'Failed to clock in' })
    }
})

// POST /api/clinics/:clinicId/attendance/clock-out
router.post('/clock-out', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { userId } = req.body
        const today = new Date().toISOString().split('T')[0]

        const { data: existing } = await supabaseAdmin
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today)
            .single()

        if (!existing) {
            return res.status(400).json({ error: 'No clock-in found for today' })
        }

        if (existing.clock_out) {
            return res.status(400).json({ error: 'Already clocked out today' })
        }

        const clockOut = new Date()
        const clockIn = new Date(existing.clock_in)
        const totalHours = (clockOut - clockIn) / (1000 * 60 * 60)

        let status = 'present_full'
        if (totalHours < 1) {
            status = 'absent'
        } else if (totalHours < 4) {
            status = 'present_partial'
        }

        const { data, error } = await supabaseAdmin
            .from('attendance')
            .update({
                clock_out: clockOut.toISOString(),
                total_hours: totalHours.toFixed(2),
                status
            })
            .eq('id', existing.id)
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to clock out' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Clock out error:', err)
        res.status(500).json({ error: 'Failed to clock out' })
    }
})

// PATCH /api/clinics/:clinicId/attendance/:id/review
router.patch('/:id/review', authMiddleware, async (req, res) => {
    try {
        const { clinicId, id } = req.params
        const { status, notes } = req.body

        const { data, error } = await supabaseAdmin
            .from('attendance')
            .update({
                status: status || undefined,
                notes,
                is_reviewed: true,
                reviewed_by: req.user.userId,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('clinic_id', clinicId)
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to review attendance' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Review attendance error:', err)
        res.status(500).json({ error: 'Failed to review attendance' })
    }
})

export default router
