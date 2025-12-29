import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware } from '../lib/auth.js'
import { checkStaffLimit } from '../lib/plans.js'

const router = express.Router({ mergeParams: true })

// GET /api/clinics/:clinicId/staff
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { locationId } = req.query

        let query = supabaseAdmin
            .from('users')
            .select('*, clinic_locations(name, city)')
            .eq('clinic_id', clinicId)
            .neq('role', 'owner') // Don't show owner in staff list
            .order('created_at', { ascending: false })

        if (locationId && locationId !== 'all') {
            query = query.eq('location_id', locationId)
        }

        const { data, error } = await query

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch staff' })
        }

        res.json({ data })
    } catch (err) {
        console.error('Get staff error:', err)
        res.status(500).json({ error: 'Failed to fetch staff' })
    }
})

// POST /api/clinics/:clinicId/staff
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { email, firstName, lastName, phone, jobTitle, locationId, payType, payRate } = req.body

        if (!email || !firstName || !lastName) {
            return res.status(400).json({ error: 'Email, first name, and last name required' })
        }

        // Check plan limit
        const { data: clinic } = await supabaseAdmin
            .from('clinics')
            .select('plan_key')
            .eq('id', clinicId)
            .single()

        const { count: staffCount } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .neq('role', 'owner')

        if (!checkStaffLimit(clinic?.plan_key, staffCount || 0)) {
            return res.status(403).json({
                error: 'Staff limit reached. Upgrade your plan to add more staff.'
            })
        }

        // Check if email exists in clinic
        const { data: existing } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('clinic_id', clinicId)
            .eq('email', email)
            .single()

        if (existing) {
            return res.status(400).json({ error: 'Staff member with this email already exists' })
        }

        const { data, error } = await supabaseAdmin
            .from('users')
            .insert({
                clinic_id: clinicId,
                location_id: locationId,
                email,
                first_name: firstName,
                last_name: lastName,
                phone,
                job_title: jobTitle,
                pay_type: payType,
                pay_rate: payRate,
                role: 'staff',
                account_type: 'staff'
            })
            .select()
            .single()

        if (error) {
            console.error('Create staff error:', error)
            return res.status(500).json({ error: 'Failed to create staff' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Create staff error:', err)
        res.status(500).json({ error: 'Failed to create staff' })
    }
})

// PATCH /api/clinics/:clinicId/staff/:userId
router.patch('/:userId', authMiddleware, async (req, res) => {
    try {
        const { clinicId, userId } = req.params
        const updates = req.body

        const allowedFields = ['first_name', 'last_name', 'phone', 'job_title', 'location_id', 'pay_type', 'pay_rate', 'is_active']
        const filteredUpdates = {}
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                filteredUpdates[field] = updates[field]
            }
        }

        filteredUpdates.updated_at = new Date().toISOString()

        const { data, error } = await supabaseAdmin
            .from('users')
            .update(filteredUpdates)
            .eq('id', userId)
            .eq('clinic_id', clinicId)
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to update staff' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Update staff error:', err)
        res.status(500).json({ error: 'Failed to update staff' })
    }
})

export default router
