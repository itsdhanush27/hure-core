import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware, requirePermission } from '../lib/auth.js'

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

        // Date validation: end date must be >= start date
        if (new Date(endDate) < new Date(startDate)) {
            return res.status(400).json({ error: 'End date must be on or after start date' })
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

// GET /api/clinics/:clinicId/leave/types
router.get('/types', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { data, error } = await supabaseAdmin
            .from('leave_types')
            .select('*')
            .eq('clinic_id', clinicId)
            .order('name')

        if (error) throw error
        res.json({ data })
    } catch (err) {
        console.error('Fetch leave types error:', err)
        res.status(500).json({ error: 'Failed to fetch leave types' })
    }
})

// POST /api/clinics/:clinicId/leave/types
router.post('/types', authMiddleware, requirePermission('approve_leave'), async (req, res) => {
    try {
        const { clinicId } = req.params
        const { name, isPaid, days } = req.body

        const { data, error } = await supabaseAdmin
            .from('leave_types')
            .insert({
                clinic_id: clinicId,
                name,
                is_paid: isPaid,
                allowance_days: days,
                allocation_type: 'annual' // Simplified for now
            })
            .select()
            .single()

        if (error) throw error
        res.json({ success: true, data })
    } catch (err) {
        console.error('Create leave type error:', err)
        res.status(500).json({ error: 'Failed to create leave type' })
    }
})

// PATCH /api/clinics/:clinicId/leave/types/:id - Update leave type
router.patch('/types/:id', authMiddleware, requirePermission('approve_leave'), async (req, res) => {
    try {
        const { clinicId, id } = req.params
        const { name, isPaid, days } = req.body

        const updateData = {}
        if (name !== undefined) updateData.name = name
        if (isPaid !== undefined) updateData.is_paid = isPaid
        if (days !== undefined) updateData.allowance_days = Number(days)

        const { data, error } = await supabaseAdmin
            .from('leave_types')
            .update(updateData)
            .eq('id', id)
            .eq('clinic_id', clinicId)
            .select()
            .single()

        if (error) throw error
        res.json({ data })
    } catch (err) {
        console.error('Update leave type error:', err)
        res.status(500).json({ error: 'Failed to update leave type' })
    }
})

// DELETE /api/clinics/:clinicId/leave/types/:id
router.delete('/types/:id', authMiddleware, requirePermission('approve_leave'), async (req, res) => {
    try {
        const { clinicId, id } = req.params
        const { error } = await supabaseAdmin
            .from('leave_types')
            .delete()
            .eq('id', id)
            .eq('clinic_id', clinicId)

        if (error) throw error
        res.json({ success: true })
    } catch (err) {
        console.error('Delete leave type error:', err)
        res.status(500).json({ error: 'Failed to delete leave type' })
    }
})

export default router

// Force restart
