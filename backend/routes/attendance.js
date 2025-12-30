import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware } from '../lib/auth.js'

const router = express.Router({ mergeParams: true })

// GET /api/clinics/:clinicId/attendance
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { locationId, startDate, endDate, includeLocums } = req.query

        // Fetch staff attendance (exclude locums)
        let staffQuery = supabaseAdmin
            .from('attendance')
            .select('*, users(first_name, last_name, job_title), clinic_locations(name)')
            .eq('clinic_id', clinicId)
            .is('external_locum_id', null) // Only staff records
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

        // Fetch locum attendance if requested
        if (includeLocums === 'true') {
            let locumQuery = supabaseAdmin
                .from('attendance')
                .select('*, external_locums(name, role, phone), clinic_locations(name)')
                .eq('clinic_id', clinicId)
                .not('external_locum_id', 'is', null) // Only locum records
                .order('date', { ascending: false })

            if (locationId && locationId !== 'all') {
                locumQuery = locumQuery.eq('location_id', locationId)
            }
            if (startDate) {
                locumQuery = locumQuery.gte('date', startDate)
            }
            if (endDate) {
                locumQuery = locumQuery.lte('date', endDate)
            }

            const { data: locumData, error: locumError } = await locumQuery

            if (!locumError && locumData) {
                const locumRecords = locumData.map(a => ({
                    ...a,
                    type: 'locum',
                    locum_name: a.external_locums?.name || 'External Locum',
                    locum_role: a.external_locums?.role || 'Locum'
                }))
                allData = [...allData, ...locumRecords]
            }
        }

        res.json({ data: allData })
    } catch (err) {
        console.error('Get attendance error:', err)
        res.status(500).json({ error: 'Failed to fetch attendance' })
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

        // Get locum details including shift for location and duration
        const { data: locum } = await supabaseAdmin
            .from('external_locums')
            .select('*, schedule_blocks(start_time, end_time, location_id)')
            .eq('id', externalLocumId)
            .single()

        if (!locum) {
            return res.status(404).json({ error: 'Locum not found' })
        }

        // Calculate default hours from shift if not provided
        let hours = hoursWorked
        if (!hours && locum?.schedule_blocks) {
            const start = new Date(`2000-01-01T${locum.schedule_blocks.start_time}`)
            const end = new Date(`2000-01-01T${locum.schedule_blocks.end_time}`)
            hours = (end - start) / (1000 * 60 * 60)
        }

        const { data, error } = await supabaseAdmin
            .from('attendance')
            .insert({
                clinic_id: clinicId,
                location_id: locum.schedule_blocks?.location_id, // Get from shift
                external_locum_id: externalLocumId,
                date,
                attendance_type: 'confirmation',
                locum_status: status, // 'WORKED' | 'NO_SHOW'
                total_hours: status === 'WORKED' ? (hours || 8) : 0,
                status: status === 'WORKED' ? 'present_full' : 'absent'
            })
            .select()
            .single()

        if (error) {
            console.error('Record locum attendance error:', error)
            return res.status(500).json({ error: 'Failed to record locum attendance' })
        }

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

        // Check if already clocked in
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

        // Find today's record
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

        // Determine status
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

// PATCH /api/clinics/:clinicId/attendance/:id/review - Mark as reviewed
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
