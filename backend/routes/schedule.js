import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware, requirePermission } from '../lib/auth.js'

const router = express.Router({ mergeParams: true })

// GET /api/clinics/:clinicId/schedule
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { locationId, startDate, endDate } = req.query

        let query = supabaseAdmin
            .from('schedule_blocks')
            .select('*, clinic_locations(name), schedule_assignments(*, users(first_name, last_name))')
            .eq('clinic_id', clinicId)
            .order('date', { ascending: true })

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
            return res.status(500).json({ error: 'Failed to fetch schedule' })
        }

        res.json({ data })
    } catch (err) {
        console.error('Get schedule error:', err)
        res.status(500).json({ error: 'Failed to fetch schedule' })
    }
})

// POST /api/clinics/:clinicId/schedule - Create schedule block
router.post('/', authMiddleware, requirePermission('manage_schedule'), async (req, res) => {
    try {
        const { clinicId } = req.params
        const { locationId, date, startTime, endTime, roleRequired, headcountRequired, notes } = req.body

        if (!locationId || !date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Location, date, start time, and end time required' })
        }

        const { data, error } = await supabaseAdmin
            .from('schedule_blocks')
            .insert({
                clinic_id: clinicId,
                location_id: locationId,
                date,
                start_time: startTime,
                end_time: endTime,
                role_required: roleRequired,
                headcount_required: headcountRequired || 1,
                notes
            })
            .select()
            .single()

        if (error) {
            console.error('Create schedule error:', error)
            return res.status(500).json({ error: 'Failed to create schedule' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Create schedule error:', err)
        res.status(500).json({ error: 'Failed to create schedule' })
    }
})

// POST /api/clinics/:clinicId/schedule/:blockId/assign - Assign staff to shift
router.post('/:blockId/assign', authMiddleware, requirePermission('manage_schedule'), async (req, res) => {
    try {
        const { blockId } = req.params
        const { userId, isExternal, externalName, externalPhone, externalNotes } = req.body

        // Check if shift is in the past
        const { data: shift } = await supabaseAdmin
            .from('schedule_blocks')
            .select('date, start_time')
            .eq('id', blockId)
            .single()

        if (shift) {
            const shiftDateTime = new Date(`${shift.date}T${shift.start_time}`)
            const now = new Date()
            if (shiftDateTime < now) {
                return res.status(400).json({ error: 'Cannot assign to past shifts' })
            }
        }

        const { data, error } = await supabaseAdmin
            .from('schedule_assignments')
            .insert({
                schedule_block_id: blockId,
                user_id: isExternal ? null : userId,
                is_external: isExternal || false,
                external_name: externalName,
                external_phone: externalPhone,
                external_notes: externalNotes,
                status: 'pending'  // Requires employee to accept
            })
            .select('*, users(first_name, last_name, job_title)')
            .single()

        if (error) {
            console.error('Assign shift error:', error)
            return res.status(500).json({ error: 'Failed to assign shift' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Assign shift error:', err)
        res.status(500).json({ error: 'Failed to assign shift' })
    }
})

// DELETE /api/clinics/:clinicId/schedule/:blockId - Delete schedule block
router.delete('/:blockId', authMiddleware, requirePermission('manage_schedule'), async (req, res) => {
    try {
        const { clinicId, blockId } = req.params

        // 1. Get all external locums for this shift
        const { data: locums } = await supabaseAdmin
            .from('external_locums')
            .select('id')
            .eq('schedule_block_id', blockId)

        const locumIds = (locums || []).map(l => l.id)

        if (locumIds.length > 0) {
            // 2. Delete attendance for these locums
            await supabaseAdmin
                .from('attendance')
                .delete()
                .in('external_locum_id', locumIds)

            // 3. Delete payroll records for these locums
            await supabaseAdmin
                .from('payroll_records')
                .delete()
                .in('external_locum_id', locumIds)

            // 4. Delete the external locums
            await supabaseAdmin
                .from('external_locums')
                .delete()
                .eq('schedule_block_id', blockId)
        }

        // 5. Delete any assignments
        await supabaseAdmin
            .from('schedule_assignments')
            .delete()
            .eq('schedule_block_id', blockId)

        // 6. Then delete the shift
        const { error } = await supabaseAdmin
            .from('schedule_blocks')
            .delete()
            .eq('id', blockId)
            .eq('clinic_id', clinicId)

        if (error) {
            console.error('Delete shift error:', error)
            return res.status(500).json({ error: 'Failed to delete shift' })
        }

        console.log('✅ Shift deleted:', blockId)
        res.json({ success: true, message: 'Shift deleted successfully' })
    } catch (err) {
        console.error('Delete shift error:', err)
        res.status(500).json({ error: 'Failed to delete shift' })
    }
})

// DELETE /api/clinics/:clinicId/schedule/assignments/:assignmentId - Unassign staff
router.delete('/assignments/:assignmentId', authMiddleware, requirePermission('manage_schedule'), async (req, res) => {
    try {
        const { assignmentId } = req.params

        const { error } = await supabaseAdmin
            .from('schedule_assignments')
            .delete()
            .eq('id', assignmentId)

        if (error) {
            console.error('Unassign shift error:', error)
            return res.status(500).json({ error: 'Failed to unassign staff' })
        }

        console.log('✅ Staff unassigned from shift:', assignmentId)
        res.json({ success: true, message: 'Staff unassigned successfully' })
    } catch (err) {
        console.error('Unassign shift error:', err)
        res.status(500).json({ error: 'Failed to unassign staff' })
    }
})

// ============================================
// EXTERNAL LOCUM ENDPOINTS
// ============================================

// GET /api/clinics/:clinicId/schedule/:blockId/locums - Get external locums for a shift
router.get('/:blockId/locums', authMiddleware, async (req, res) => {
    try {
        const { clinicId, blockId } = req.params

        const { data, error } = await supabaseAdmin
            .from('external_locums')
            .select('*, supervisor:users!external_locums_supervisor_id_fkey(first_name, last_name)')
            .eq('clinic_id', clinicId)
            .eq('schedule_block_id', blockId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Get locums error:', error)
            return res.status(500).json({ error: 'Failed to fetch locums' })
        }

        res.json({ data: data || [] })
    } catch (err) {
        console.error('Get locums error:', err)
        res.status(500).json({ error: 'Failed to fetch locums' })
    }
})

// POST /api/clinics/:clinicId/schedule/:blockId/locums - Add external locum to shift
router.post('/:blockId/locums', authMiddleware, requirePermission('manage_schedule'), async (req, res) => {
    try {
        const { clinicId, blockId } = req.params
        const { name, phone, role, dailyRate, supervisorId, notes } = req.body

        if (!name) {
            return res.status(400).json({ error: 'Locum name is required' })
        }

        // Get shift details including location_id and check if past
        const { data: shift } = await supabaseAdmin
            .from('schedule_blocks')
            .select('role_required, location_id, date, start_time')
            .eq('id', blockId)
            .single()

        if (shift) {
            const shiftDateTime = new Date(`${shift.date}T${shift.start_time}`)
            const now = new Date()
            if (shiftDateTime < now) {
                return res.status(400).json({ error: 'Cannot assign to past shifts' })
            }
        }

        const { data, error } = await supabaseAdmin
            .from('external_locums')
            .insert({
                clinic_id: clinicId,
                schedule_block_id: blockId,
                location_id: shift?.location_id, // Store location directly
                name,
                phone: phone || null,
                role: role || shift?.role_required || 'General',
                daily_rate: dailyRate || 0,
                supervisor_id: supervisorId || null,
                notes: notes || null,
                created_by: req.user.userId
            })
            .select('*, supervisor:users!external_locums_supervisor_id_fkey(first_name, last_name)')
            .single()

        if (error) {
            console.error('Add locum error:', error)
            return res.status(500).json({ error: 'Failed to add locum' })
        }

        console.log('✅ External locum added:', name, 'to shift', blockId)
        res.json({ success: true, data })
    } catch (err) {
        console.error('Add locum error:', err)
        res.status(500).json({ error: 'Failed to add locum' })
    }
})

// DELETE /api/clinics/:clinicId/schedule/:blockId/locums/:locumId - Remove external locum
router.delete('/:blockId/locums/:locumId', authMiddleware, requirePermission('manage_schedule'), async (req, res) => {
    try {
        const { clinicId, locumId } = req.params

        // First, delete any attendance records for this locum
        await supabaseAdmin
            .from('attendance')
            .delete()
            .eq('external_locum_id', locumId)
            .eq('clinic_id', clinicId)

        // Delete any payroll records for this locum (both tables just in case)
        await supabaseAdmin
            .from('payroll_records')
            .delete()
            .eq('external_locum_id', locumId)
            .eq('clinic_id', clinicId)

        await supabaseAdmin
            .from('payroll_items')
            .delete()
            .eq('external_locum_id', locumId)

        // Then delete the locum record
        const { error } = await supabaseAdmin
            .from('external_locums')
            .delete()
            .eq('id', locumId)
            .eq('clinic_id', clinicId)

        if (error) {
            console.error('Delete locum error:', error)
            return res.status(500).json({ error: 'Failed to remove locum' })
        }

        console.log('✅ External locum removed:', locumId)
        res.json({ success: true, message: 'Locum removed successfully' })
    } catch (err) {
        console.error('Delete locum error:', err)
        res.status(500).json({ error: 'Failed to remove locum' })
    }
})

// DELETE /api/clinics/:clinicId/schedule/:blockId/locums - Clear all locums from shift
router.delete('/:blockId/locums', authMiddleware, requirePermission('manage_schedule'), async (req, res) => {
    try {
        const { clinicId, blockId } = req.params

        const { error } = await supabaseAdmin
            .from('external_locums')
            .delete()
            .eq('clinic_id', clinicId)
            .eq('schedule_block_id', blockId)

        if (error) {
            console.error('Clear locums error:', error)
            return res.status(500).json({ error: 'Failed to clear locums' })
        }

        console.log('✅ All locums cleared from shift:', blockId)
        res.json({ success: true, message: 'All locums cleared' })
    } catch (err) {
        console.error('Clear locums error:', err)
        res.status(500).json({ error: 'Failed to clear locums' })
    }
})

export default router
