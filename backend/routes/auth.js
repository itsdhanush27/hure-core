import express from 'express'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../lib/supabase.js'
import { generateToken } from '../lib/auth.js'

const router = express.Router()

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Email/username and password required' })
        }

        // Find user by email or username
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*, clinics!inner(id, name, status, plan_key, org_verification_status)')
            .or(`email.eq.${identifier},username.eq.${identifier}`)
            .single()

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid credentials' })
        }

        // Check password
        if (!user.password_hash) {
            return res.status(401).json({ error: 'Password not set. Please contact admin.' })
        }

        const validPassword = await bcrypt.compare(password, user.password_hash)
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' })
        }

        // Check clinic status
        if (user.clinics?.status === 'suspended') {
            return res.status(403).json({ error: 'Your organization has been suspended' })
        }

        // Update last login
        await supabaseAdmin
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', user.id)

        // Generate token
        const token = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            clinicId: user.clinic_id
        })

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                clinicId: user.clinic_id,
                clinicName: user.clinics?.name
            }
        })
    } catch (err) {
        console.error('Login error:', err)
        res.status(500).json({ error: 'Login failed' })
    }
})

// GET /api/auth/invite/:token - Validate invite token
router.get('/invite/:token', async (req, res) => {
    try {
        const { token } = req.params

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('id, email, first_name, last_name, job_title, invite_status, clinic_id, clinics(name)')
            .eq('invite_token', token)
            .single()

        if (error || !user) {
            return res.status(404).json({ error: 'Invalid or expired invite link' })
        }

        if (user.invite_status === 'accepted') {
            return res.status(400).json({ error: 'This invite has already been used' })
        }

        res.json({
            valid: true,
            user: {
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                jobTitle: user.job_title,
                clinicName: user.clinics?.name
            }
        })
    } catch (err) {
        console.error('Invite validation error:', err)
        res.status(500).json({ error: 'Failed to validate invite' })
    }
})

// POST /api/auth/invite/:token/accept - Accept invite and set password
router.post('/invite/:token/accept', async (req, res) => {
    try {
        const { token } = req.params
        const { password } = req.body

        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' })
        }

        // Find user by invite token
        const { data: user, error: findError } = await supabaseAdmin
            .from('users')
            .select('id, email, first_name, last_name, role, clinic_id, invite_status')
            .eq('invite_token', token)
            .single()

        if (findError || !user) {
            return res.status(404).json({ error: 'Invalid or expired invite link' })
        }

        if (user.invite_status === 'accepted') {
            return res.status(400).json({ error: 'This invite has already been used' })
        }

        // Hash password and activate user
        const passwordHash = await bcrypt.hash(password, 10)

        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                password_hash: passwordHash,
                is_active: true,
                invite_status: 'accepted',
                invite_token: null,  // Clear token after use
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id)

        if (updateError) {
            console.error('User update error:', updateError)
            return res.status(500).json({ error: 'Failed to activate account' })
        }

        // Generate login token
        const authToken = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            clinicId: user.clinic_id
        })

        console.log('✅ Invite accepted for:', user.email)

        res.json({
            success: true,
            token: authToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                clinicId: user.clinic_id
            }
        })
    } catch (err) {
        console.error('Accept invite error:', err)
        res.status(500).json({ error: 'Failed to accept invite' })
    }
})

export default router
