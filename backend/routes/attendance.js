import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware } from '../lib/auth.js'

const router = express.Router({ mergeParams: true })

// GET /api/clinics/:clinicId/attendance
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { locationId, startDate, endDate } = req.query

        let query = supabaseAdmin
            .from('attendance')
            .select('*, users(first_name, last_name, job_title), clinic_locations(name)')
            .eq('clinic_id', clinicId)
            .order('date', { ascending: false })

        if (locationId && locationId !== 'all') {
            query = query.eq('location_id', locationId)
        }

        if (startDate) {
            query = query.gte('date', startDate)
        }

        if (endDate) {
            query = query.lte('date', endDate)
        }

        const { data, error } = await query

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch attendance' })
        }

        res.json({ data })
    } catch (err) {
        console.error('Get attendance error:', err)
        res.status(500).json({ error: 'Failed to fetch attendance' })
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
