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
        const { first_name, last_name, email, phone, job_title, location_id, employment_type, pay_rate, system_role, permissions } = req.body

        if (!email || !first_name || !last_name) {
            return res.status(400).json({ error: 'Email, first name, and last name required' })
        }

        // Check plan limit
        const { data: clinic } = await supabaseAdmin
            .from('clinics')
            .select('plan_key, name')
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
            .eq('email', email)
            .maybeSingle()

        if (existing) {
            return res.status(400).json({ error: 'Staff member with this email already exists' })
        }

        // Generate invite token
        const crypto = await import('crypto')
        const inviteToken = crypto.randomBytes(32).toString('hex')

        // Determine pay_type
        const payType = employment_type === 'casual' ? 'daily' : 'salary'

        // Create staff member
        const { data, error } = await supabaseAdmin
            .from('users')
            .insert({
                clinic_id: clinicId,
                location_id: location_id || null,
                email,
                first_name,
                last_name,
                phone,
                job_title,
                pay_type: payType,
                pay_rate: pay_rate ? parseFloat(pay_rate) : null,
                hire_date: req.body.hire_date || new Date().toISOString().split('T')[0],
                role: 'staff',
                permission_role: system_role === 'ADMIN' ? 'Shift Manager' : 'Staff', // Default admin to Shift Manager if generic ADMIN passed
                permissions: system_role === 'ADMIN' && permissions ? permissions : null, // Store custom permissions for ADMIN
                account_type: 'staff',
                password_hash: null,
                is_active: false,
                invite_token: inviteToken,
                invite_status: 'pending'
            })
            .select()
            .single()

        if (error) {
            console.error('Create staff error:', error)
            return res.status(500).json({ error: 'Failed to create staff' })
        }

        // Send invite email
        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite?token=${inviteToken}`

        try {
            const { sendEmail } = await import('../lib/email.js')
            await sendEmail({
                to: email,
                subject: `You're invited to join ${clinic?.name || 'HURE'}`,
                htmlContent: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #0d9488;">Welcome to HURE!</h2>
                        <p>Hi ${first_name},</p>
                        <p>You've been invited to join <strong>${clinic?.name || 'the organization'}</strong> as a <strong>${job_title}</strong>.</p>
                        <p>Click the button below to create your account and set your password:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${inviteLink}" style="background-color: #0d9488; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                Accept Invitation
                            </a>
                        </div>
                        <p style="color: #666; font-size: 12px;">Or copy this link: ${inviteLink}</p>
                    </div>
                `,
                textContent: `You've been invited to join ${clinic?.name}. Accept here: ${inviteLink}`
            })
        } catch (emailErr) {
            console.error('Failed to send invite email:', emailErr)
            // Don't fail the request, just log it
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Create staff error:', err)
        res.status(500).json({ error: 'Failed to create staff' })
    }
})

// PATCH /api/clinics/:clinicId/staff/:userId - Update staff member
router.patch('/:userId', authMiddleware, async (req, res) => {
    try {
        const { clinicId, userId } = req.params
        const updates = req.body

        const allowedFields = ['first_name', 'last_name', 'phone', 'job_title', 'location_id', 'pay_type', 'pay_rate', 'is_active', 'hire_date', 'email', 'permission_role', 'permissions', 'system_role']
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

// PATCH /api/clinics/:clinicId/staff/:userId/role - Update staff role (Specific endpoint)
router.patch('/:userId/role', authMiddleware, async (req, res) => {
    try {
        const { clinicId, userId } = req.params
        const { role } = req.body // Expects permission_role value

        if (!role) {
            return res.status(400).json({ error: 'Role is required' })
        }

        const { data, error } = await supabaseAdmin
            .from('users')
            .update({
                permission_role: role,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .eq('clinic_id', clinicId)
            .select()
            .single()

        if (error) {
            console.error('Role update error:', error)
            return res.status(500).json({ error: 'Failed to update role' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Role update error:', err)
        res.status(500).json({ error: 'Failed to update role' })
    }
})

// PATCH /api/clinics/:clinicId/staff/:userId/status - Update staff status
router.patch('/:userId/status', authMiddleware, async (req, res) => {
    try {
        const { clinicId, userId } = req.params
        const { isActive } = req.body

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ error: 'Status (isActive) must be a boolean' })
        }

        const { data, error } = await supabaseAdmin
            .from('users')
            .update({
                is_active: isActive,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .eq('clinic_id', clinicId)
            .select()
            .single()

        if (error) {
            console.error('Status update error:', error)
            return res.status(500).json({ error: 'Failed to update status' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Status update error:', err)
        res.status(500).json({ error: 'Failed to update status' })
    }
})

// DELETE /api/clinics/:clinicId/staff/:userId - Delete staff member
router.delete('/:userId', authMiddleware, async (req, res) => {
    try {
        const { clinicId, userId } = req.params

        const { error } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', userId)
            .eq('clinic_id', clinicId)

        if (error) {
            console.error('Delete staff error:', error)
            return res.status(500).json({ error: 'Failed to delete staff' })
        }

        res.json({ success: true, message: 'Staff deleted successfully' })
    } catch (err) {
        console.error('Delete staff error:', err)
        res.status(500).json({ error: 'Failed to delete staff' })
    }
})

export default router
