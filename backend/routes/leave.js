import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware } from '../lib/auth.js'

const router = express.Router({ mergeParams: true })

// GET /api/clinics/:clinicId/leave
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { status } = req.query

        let query = supabaseAdmin
            .from('leave_requests')
            .select('*, users(first_name, last_name, job_title)')
            .eq('clinic_id', clinicId)
            .order('created_at', { ascending: false })

        if (status) {
            query = query.eq('status', status)
        }

        const { data, error } = await query

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch leave requests' })
        }

        res.json({ data })
    } catch (err) {
        console.error('Get leave error:', err)
        res.status(500).json({ error: 'Failed to fetch leave requests' })
    }
})

// POST /api/clinics/:clinicId/leave - Create leave request
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { userId, leaveType, startDate, endDate, reason } = req.body

        if (!userId || !leaveType || !startDate || !endDate) {
            return res.status(400).json({ error: 'User ID, leave type, start date, and end date required' })
        }

        const { data, error } = await supabaseAdmin
            .from('leave_requests')
            .insert({
                clinic_id: clinicId,
                user_id: userId,
                leave_type: leaveType,
                start_date: startDate,
                end_date: endDate,
                reason,
                status: 'pending'
            })
            .select()
            .single()

        if (error) {
            console.error('Create leave error:', error)
            return res.status(500).json({ error: 'Failed to create leave request' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Create leave error:', err)
        res.status(500).json({ error: 'Failed to create leave request' })
    }
})

// PATCH /api/clinics/:clinicId/leave/:id - Approve/reject leave
router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        const { clinicId, id } = req.params
        const { status, rejectionNotes } = req.body

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status must be approved or rejected' })
        }

        const { data, error } = await supabaseAdmin
            .from('leave_requests')
            .update({
                status,
                rejection_notes: status === 'rejected' ? rejectionNotes : null,
                reviewed_by: req.user.userId,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('clinic_id', clinicId)
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to update leave request' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Update leave error:', err)
        res.status(500).json({ error: 'Failed to update leave request' })
    }
})

export default router
