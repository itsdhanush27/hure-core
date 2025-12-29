import express from 'express'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../lib/supabase.js'
import { generateToken } from '../lib/auth.js'
import { sendOTPEmail } from '../lib/email.js'

const router = express.Router()

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

// POST /api/onboard/register - Create new clinic + owner
router.post('/register', async (req, res) => {
    try {
        const { orgName, contactName, email, phone, password } = req.body

        if (!orgName || !contactName || !email || !password) {
            return res.status(400).json({ error: 'All fields required' })
        }

        // Check if email exists
        const { data: existing } = await supabaseAdmin
            .from('clinics')
            .select('id')
            .eq('email', email)
            .single()

        if (existing) {
            return res.status(400).json({ error: 'Email already registered' })
        }

        // Hash password
        const salt = await bcrypt.genSalt(10)
        const passwordHash = await bcrypt.hash(password, salt)

        // Create clinic (no default plan - user must select)
        const { data: clinic, error: clinicError } = await supabaseAdmin
            .from('clinics')
            .insert({
                name: orgName,
                email,
                phone,
                contact_name: contactName,
                status: 'pending_verification',
                org_verification_status: 'pending',
                plan_key: null  // User must select a plan
            })
            .select()
            .single()

        if (clinicError) {
            console.error('Clinic creation error:', clinicError)
            return res.status(500).json({ error: 'Failed to create organization' })
        }

        // Create owner user
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .insert({
                clinic_id: clinic.id,
                email,
                username: email.split('@')[0],
                password_hash: passwordHash,
                first_name: contactName.split(' ')[0],
                last_name: contactName.split(' ').slice(1).join(' '),
                phone,
                role: 'owner',
                account_type: 'owner'
            })
            .select()
            .single()

        if (userError) {
            console.error('User creation error:', userError)
            // Rollback clinic
            await supabaseAdmin.from('clinics').delete().eq('id', clinic.id)
            return res.status(500).json({ error: 'Failed to create user' })
        }

        res.json({
            success: true,
            clinicId: clinic.id,
            userId: user.id,
            message: 'Account created. Please verify your email.'
        })
    } catch (err) {
        console.error('Registration error:', err)
        res.status(500).json({ error: 'Registration failed' })
    }
})

// POST /api/onboard/verify-email - Send OTP
router.post('/verify-email', async (req, res) => {
    try {
        const { clinicId, email, orgName } = req.body

        if (!clinicId || !email) {
            return res.status(400).json({ error: 'Clinic ID and email required' })
        }

        const otp = generateOTP()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

        // Store OTP
        await supabaseAdmin.from('otp_codes').insert({
            clinic_id: clinicId,
            email,
            code: otp,
            expires_at: expiresAt.toISOString()
        })

        // Send email via Brevo
        const emailResult = await sendOTPEmail(email, otp, orgName)

        if (!emailResult.success && !emailResult.dev) {
            console.error('Email send failed:', emailResult.error)
        }

        // Also log to console for development
        console.log(`📧 OTP for ${email}: ${otp}`)

        res.json({
            success: true,
            message: 'Verification code sent to your email',
            // For development only - remove in production
            devOtp: process.env.NODE_ENV === 'development' ? otp : undefined
        })
    } catch (err) {
        console.error('Send OTP error:', err)
        res.status(500).json({ error: 'Failed to send verification code' })
    }
})

// POST /api/onboard/verify-otp - Verify email
router.post('/verify-otp', async (req, res) => {
    try {
        const { clinicId, code } = req.body

        if (!clinicId || !code) {
            return res.status(400).json({ error: 'Clinic ID and code required' })
        }

        // Find valid OTP
        const { data: otp, error } = await supabaseAdmin
            .from('otp_codes')
            .select('*')
            .eq('clinic_id', clinicId)
            .eq('code', code)
            .eq('used', false)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (error || !otp) {
            return res.status(400).json({ error: 'Invalid or expired code' })
        }

        // Mark OTP as used
        await supabaseAdmin
            .from('otp_codes')
            .update({ used: true })
            .eq('id', otp.id)

        // Update clinic email_verified
        await supabaseAdmin
            .from('clinics')
            .update({ email_verified: true })
            .eq('id', clinicId)

        // Get user for token
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('clinic_id', clinicId)
            .eq('role', 'owner')
            .single()

        const token = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            clinicId: user.clinic_id
        })

        res.json({
            success: true,
            message: 'Email verified successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                clinicId: user.clinic_id
            }
        })
    } catch (err) {
        console.error('Verify OTP error:', err)
        res.status(500).json({ error: 'Verification failed' })
    }
})

export default router
