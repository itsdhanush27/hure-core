import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware } from '../lib/auth.js'
import { checkLocationLimit } from '../lib/plans.js'

const router = express.Router({ mergeParams: true })

// GET /api/clinics/:clinicId/locations
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params

        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .select('*')
            .eq('clinic_id', clinicId)
            .order('is_primary', { ascending: false })

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch locations' })
        }

        res.json({ data })
    } catch (err) {
        console.error('Get locations error:', err)
        res.status(500).json({ error: 'Failed to fetch locations' })
    }
})

// POST /api/clinics/:clinicId/locations
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { name, city, address, phone } = req.body

        if (!name) {
            return res.status(400).json({ error: 'Location name required' })
        }

        // Check plan limit
        const { data: clinic } = await supabaseAdmin
            .from('clinics')
            .select('plan_key')
            .eq('id', clinicId)
            .single()

        const { count: locationCount } = await supabaseAdmin
            .from('clinic_locations')
            .select('*', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)

        if (!checkLocationLimit(clinic?.plan_key, locationCount || 0)) {
            return res.status(403).json({
                error: 'Location limit reached. Upgrade your plan to add more locations.'
            })
        }

        // Check if first location
        const isFirst = locationCount === 0

        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .insert({
                clinic_id: clinicId,
                name,
                city,
                address,
                phone,
                is_primary: isFirst,
                facility_verification_status: 'draft'
            })
            .select()
            .single()

        if (error) {
            console.error('Create location error:', error)
            return res.status(500).json({ error: 'Failed to create location' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Create location error:', err)
        res.status(500).json({ error: 'Failed to create location' })
    }
})

// PATCH /api/clinics/:clinicId/locations/:locationId
router.patch('/:locationId', authMiddleware, async (req, res) => {
    try {
        const { clinicId, locationId } = req.params
        const updates = req.body

        const allowedFields = ['name', 'city', 'address', 'phone', 'license_no', 'licensing_body', 'license_expiry']
        const filteredUpdates = {}
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                filteredUpdates[field] = updates[field]
            }
        }

        if (Object.keys(filteredUpdates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' })
        }

        filteredUpdates.updated_at = new Date().toISOString()

        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .update(filteredUpdates)
            .eq('id', locationId)
            .eq('clinic_id', clinicId)
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to update location' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Update location error:', err)
        res.status(500).json({ error: 'Failed to update location' })
    }
})

// POST /api/clinics/:clinicId/locations/:locationId/verify - Submit facility verification
router.post('/:locationId/verify', authMiddleware, async (req, res) => {
    try {
        const { clinicId, locationId } = req.params
        const { license_no, licensing_body, license_expiry } = req.body

        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .update({
                license_no,
                licensing_body,
                license_expiry,
                facility_verification_status: 'pending_review',
                updated_at: new Date().toISOString()
            })
            .eq('id', locationId)
            .eq('clinic_id', clinicId)
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to submit verification' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Submit facility verification error:', err)
        res.status(500).json({ error: 'Failed to submit verification' })
    }
})

export default router
