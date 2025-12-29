import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware } from '../lib/auth.js'

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
router.post('/', authMiddleware, async (req, res) => {
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
router.post('/:blockId/assign', authMiddleware, async (req, res) => {
    try {
        const { blockId } = req.params
        const { userId, isExternal, externalName, externalPhone, externalNotes } = req.body

        const { data, error } = await supabaseAdmin
            .from('schedule_assignments')
            .insert({
                schedule_block_id: blockId,
                user_id: isExternal ? null : userId,
                is_external: isExternal || false,
                external_name: externalName,
                external_phone: externalPhone,
                external_notes: externalNotes
            })
            .select()
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

export default router
