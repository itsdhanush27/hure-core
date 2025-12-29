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

// ============================================
// TRANSACTIONS (using clinics as proxy)
// ============================================

// GET /api/admin/transactions - Get all clinic registrations as transactions
router.get('/transactions', authMiddleware, superadminMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('clinics')
            .select('id, name, email, plan_key, status, created_at, updated_at')
            .order('created_at', { ascending: false })

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch transactions' })
        }

        // Format as transactions
        const transactions = (data || []).map(c => ({
            id: c.id,
            clinic_name: c.name,
            email: c.email,
            type: 'subscription',
            plan: c.plan_key || 'none',
            amount: getPlanAmount(c.plan_key),
            status: c.status === 'active' ? 'completed' : 'pending',
            created_at: c.created_at
        }))

        res.json({ transactions })
    } catch (err) {
        console.error('Get transactions error:', err)
        res.status(500).json({ error: 'Failed to fetch transactions' })
    }
})

// Helper to get plan amount
function getPlanAmount(planKey) {
    const amounts = {
        essential: 8000,
        professional: 15000,
        enterprise: 25000,
        care_standard: 10000,
        care_professional: 18000,
        care_enterprise: 30000
    }
    return amounts[planKey] || 0
}

// ============================================
// SUBSCRIPTIONS
// ============================================

// GET /api/admin/subscriptions - Get all active subscriptions
router.get('/subscriptions', authMiddleware, superadminMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('clinics')
            .select('id, name, email, plan_key, status, created_at, updated_at')
            .not('plan_key', 'is', null)
            .order('created_at', { ascending: false })

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch subscriptions' })
        }

        const subscriptions = (data || []).map(c => ({
            id: c.id,
            clinic_name: c.name,
            email: c.email,
            plan: c.plan_key,
            amount: getPlanAmount(c.plan_key),
            status: c.status,
            start_date: c.created_at,
            // Calculate next renewal (30 days from creation for demo)
            renewal_date: new Date(new Date(c.created_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }))

        res.json({ subscriptions })
    } catch (err) {
        console.error('Get subscriptions error:', err)
        res.status(500).json({ error: 'Failed to fetch subscriptions' })
    }
})

// PATCH /api/admin/subscriptions/:id - Update subscription status
router.patch('/subscriptions/:id', authMiddleware, superadminMiddleware, async (req, res) => {
    try {
        const { id } = req.params
        const { status, plan_key } = req.body

        const updates = { updated_at: new Date().toISOString() }
        if (status) updates.status = status
        if (plan_key) updates.plan_key = plan_key

        const { data, error } = await supabaseAdmin
            .from('clinics')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to update subscription' })
        }

        res.json({ success: true, subscription: data })
    } catch (err) {
        console.error('Update subscription error:', err)
        res.status(500).json({ error: 'Failed to update subscription' })
    }
})

// ============================================
// PROMOS
// ============================================

// GET /api/admin/promos - Get all promo codes
router.get('/promos', authMiddleware, superadminMiddleware, async (req, res) => {
    try {
        // Check if promos table exists, if not return empty array
        const { data, error } = await supabaseAdmin
            .from('promos')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            // Table might not exist, return empty array
            console.log('Promos table may not exist:', error.message)
            return res.json({ promos: [] })
        }

        res.json({ promos: data || [] })
    } catch (err) {
        console.error('Get promos error:', err)
        res.json({ promos: [] })
    }
})

// POST /api/admin/promos - Create promo code
router.post('/promos', authMiddleware, superadminMiddleware, async (req, res) => {
    try {
        const { code, discount_percent, expires_at, max_uses, description } = req.body

        const { data, error } = await supabaseAdmin
            .from('promos')
            .insert({
                code: code.toUpperCase(),
                discount_percent,
                expires_at,
                max_uses: max_uses || null,
                uses_count: 0,
                description,
                is_active: true,
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (error) {
            console.error('Create promo error:', error)
            return res.status(500).json({ error: 'Failed to create promo. Table may not exist.' })
        }

        res.json({ success: true, promo: data })
    } catch (err) {
        console.error('Create promo error:', err)
        res.status(500).json({ error: 'Failed to create promo' })
    }
})

// DELETE /api/admin/promos/:id - Delete promo code
router.delete('/promos/:id', authMiddleware, superadminMiddleware, async (req, res) => {
    try {
        const { id } = req.params

        const { error } = await supabaseAdmin
            .from('promos')
            .delete()
            .eq('id', id)

        if (error) {
            return res.status(500).json({ error: 'Failed to delete promo' })
        }

        res.json({ success: true })
    } catch (err) {
        console.error('Delete promo error:', err)
        res.status(500).json({ error: 'Failed to delete promo' })
    }
})

// ============================================
// AUDIT LOG
// ============================================

// GET /api/admin/audit - Get audit log entries
router.get('/audit', authMiddleware, superadminMiddleware, async (req, res) => {
    try {
        // Try to fetch from audit_log table
        const { data: auditData, error: auditError } = await supabaseAdmin
            .from('audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)

        if (!auditError && auditData) {
            return res.json({ events: auditData })
        }

        // Fallback: Synthesize audit log from clinics activity
        const { data: clinics } = await supabaseAdmin
            .from('clinics')
            .select('id, name, email, status, org_verification_status, created_at, updated_at')
            .order('created_at', { ascending: false })
            .limit(50)

        const events = (clinics || []).flatMap(c => {
            const evts = [{
                id: `${c.id}-created`,
                event_type: 'clinic_registered',
                description: `New clinic registered: ${c.name}`,
                clinic_id: c.id,
                created_at: c.created_at
            }]
            if (c.org_verification_status === 'approved') {
                evts.push({
                    id: `${c.id}-approved`,
                    event_type: 'org_verified',
                    description: `Organization verified: ${c.name}`,
                    clinic_id: c.id,
                    created_at: c.updated_at
                })
            }
            return evts
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        res.json({ events })
    } catch (err) {
        console.error('Get audit log error:', err)
        res.status(500).json({ error: 'Failed to fetch audit log' })
    }
})

// ============================================
// SITE CONTENT
// ============================================

// GET /api/admin/content - Get site content settings
router.get('/content', authMiddleware, superadminMiddleware, async (req, res) => {
    try {
        // Try to fetch from site_content table
        const { data, error } = await supabaseAdmin
            .from('site_content')
            .select('*')

        if (error) {
            // Table doesn't exist, return defaults
            return res.json({
                content: {
                    hero_title: 'Streamline Your Workforce Operations',
                    hero_subtitle: 'Complete staff management solution for your organization.',
                    pricing_essential: 8000,
                    pricing_professional: 15000,
                    pricing_enterprise: 25000
                }
            })
        }

        // Convert array to object
        const content = {}
        for (const item of (data || [])) {
            content[item.key] = item.value
        }

        res.json({ content })
    } catch (err) {
        console.error('Get site content error:', err)
        res.json({ content: {} })
    }
})

// PATCH /api/admin/content - Update site content
router.patch('/content', authMiddleware, superadminMiddleware, async (req, res) => {
    try {
        const updates = req.body

        // Upsert each key-value pair
        for (const [key, value] of Object.entries(updates)) {
            await supabaseAdmin
                .from('site_content')
                .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        }

        res.json({ success: true })
    } catch (err) {
        console.error('Update site content error:', err)
        res.status(500).json({ error: 'Failed to update content' })
    }
})

export default router
