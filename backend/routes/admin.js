import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware, superadminMiddleware } from '../lib/auth.js'

const router = express.Router()

// GET /api/admin/clinics - List all clinics
router.get('/clinics', authMiddleware, superadminMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('clinics')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch clinics' })
        }

        res.json({ clinics: data })
    } catch (err) {
        console.error('Get clinics error:', err)
        res.status(500).json({ error: 'Failed to fetch clinics' })
    }
})

// GET /api/admin/verifications/pending
router.get('/verifications/pending', authMiddleware, superadminMiddleware, async (req, res) => {
    try {
        // Get pending org verifications
        const { data: orgPending } = await supabaseAdmin
            .from('clinics')
            .select('id, name, email, org_verification_status, kra_pin, business_reg_no, created_at')
            .eq('org_verification_status', 'under_review')

        // Get pending facility verifications
        const { data: facilityPending } = await supabaseAdmin
            .from('clinic_locations')
            .select('id, name, clinic_id, license_no, licensing_body, facility_verification_status, clinics(name)')
            .eq('facility_verification_status', 'pending_review')

        const verifications = [
            ...(orgPending || []).map(c => ({ ...c, type: 'organization', clinic_name: c.name })),
            ...(facilityPending || []).map(l => ({ ...l, type: 'facility', clinic_name: l.clinics?.name }))
        ]

        res.json({ verifications })
    } catch (err) {
        console.error('Get pending verifications error:', err)
        res.status(500).json({ error: 'Failed to fetch verifications' })
    }
})

// PATCH /api/admin/clinics/:clinicId/org-verification - Approve/reject org
router.patch('/clinics/:clinicId/org-verification', authMiddleware, superadminMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { status, rejectionNotes } = req.body

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status must be approved or rejected' })
        }

        const updates = {
            org_verification_status: status,
            updated_at: new Date().toISOString()
        }

        if (status === 'rejected') {
            updates.org_rejection_notes = rejectionNotes
        } else {
            updates.status = 'active' // Activate clinic on approval
        }

        const { data, error } = await supabaseAdmin
            .from('clinics')
            .update(updates)
            .eq('id', clinicId)
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to update verification' })
        }

        res.json({ success: true, clinic: data })
    } catch (err) {
        console.error('Update org verification error:', err)
        res.status(500).json({ error: 'Failed to update verification' })
    }
})

// PATCH /api/admin/locations/:locationId/facility-verification
router.patch('/locations/:locationId/facility-verification', authMiddleware, superadminMiddleware, async (req, res) => {
    try {
        const { locationId } = req.params
        const { status, rejectionNotes } = req.body

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status must be approved or rejected' })
        }

        const updates = {
            facility_verification_status: status,
            updated_at: new Date().toISOString()
        }

        if (status === 'rejected') {
            updates.facility_rejection_notes = rejectionNotes
        }

        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .update(updates)
            .eq('id', locationId)
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to update verification' })
        }

        res.json({ success: true, location: data })
    } catch (err) {
        console.error('Update facility verification error:', err)
        res.status(500).json({ error: 'Failed to update verification' })
    }
})

export default router
