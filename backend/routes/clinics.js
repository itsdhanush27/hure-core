import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware } from '../lib/auth.js'

const router = express.Router()

// GET /api/clinics/:clinicId/settings
router.get('/:clinicId/settings', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params

        // Get clinic
        const { data: clinic, error: clinicError } = await supabaseAdmin
            .from('clinics')
            .select('*')
            .eq('id', clinicId)
            .single()

        if (clinicError || !clinic) {
            return res.status(404).json({ error: 'Clinic not found' })
        }

        // Get locations
        const { data: locations } = await supabaseAdmin
            .from('clinic_locations')
            .select('*')
            .eq('clinic_id', clinicId)
            .order('is_primary', { ascending: false })

        res.json({
            clinic,
            locations: locations || []
        })
    } catch (err) {
        console.error('Get settings error:', err)
        res.status(500).json({ error: 'Failed to get settings' })
    }
})

// PATCH /api/clinics/:clinicId/settings
router.patch('/:clinicId/settings', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const updates = req.body

        // Allowed updates
        const allowedFields = ['name', 'phone', 'contact_name', 'kra_pin', 'business_reg_no']
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
            .from('clinics')
            .update(filteredUpdates)
            .eq('id', clinicId)
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to update settings' })
        }

        res.json({ success: true, clinic: data })
    } catch (err) {
        console.error('Update settings error:', err)
        res.status(500).json({ error: 'Failed to update settings' })
    }
})

// DELETE /api/clinics/:clinicId - Delete organization
router.delete('/:clinicId', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params

        // Delete the clinic (cascade will delete related data)
        const { error } = await supabaseAdmin
            .from('clinics')
            .delete()
            .eq('id', clinicId)

        if (error) {
            console.error('Delete clinic error:', error)
            return res.status(500).json({ error: 'Failed to delete organization' })
        }

        res.json({ success: true, message: 'Organization deleted successfully' })
    } catch (err) {
        console.error('Delete clinic error:', err)
        res.status(500).json({ error: 'Failed to delete organization' })
    }
})

// POST /api/clinics/:clinicId/verification - Submit for org verification
router.post('/:clinicId/verification', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { kra_pin, business_reg_no } = req.body

        const { data, error } = await supabaseAdmin
            .from('clinics')
            .update({
                kra_pin,
                business_reg_no,
                org_verification_status: 'under_review',
                updated_at: new Date().toISOString()
            })
            .eq('id', clinicId)
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to submit verification' })
        }

        res.json({ success: true, clinic: data })
    } catch (err) {
        console.error('Submit verification error:', err)
        res.status(500).json({ error: 'Failed to submit verification' })
    }
})

// POST /api/clinics/:clinicId/plan - Select subscription plan
router.post('/:clinicId/plan', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { planKey } = req.body

        if (!['essential', 'professional', 'enterprise'].includes(planKey)) {
            return res.status(400).json({ error: 'Invalid plan selected' })
        }

        const { data, error } = await supabaseAdmin
            .from('clinics')
            .update({
                plan_key: planKey,
                plan_status: 'active',
                updated_at: new Date().toISOString()
            })
            .eq('id', clinicId)
            .select()
            .single()

        if (error) {
            console.error('Plan update error:', error)
            return res.status(500).json({ error: 'Failed to update plan' })
        }

        res.json({ success: true, clinic: data })
    } catch (err) {
        console.error('Plan selection error:', err)
        res.status(500).json({ error: 'Failed to select plan' })
    }
})

// ============================================
// SCHEDULE ENDPOINTS
// ============================================

// GET /api/clinics/:clinicId/schedule - Get all schedule blocks
router.get('/:clinicId/schedule', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params

        const { data, error } = await supabaseAdmin
            .from('schedule_blocks')
            .select('*, clinic_locations(name), schedule_assignments(id, user_id)')
            .eq('clinic_id', clinicId)
            .order('date', { ascending: true })

        if (error) {
            console.error('Schedule fetch error:', error)
            return res.status(500).json({ error: 'Failed to fetch schedules' })
        }

        res.json({ data })
    } catch (err) {
        console.error('Schedule error:', err)
        res.status(500).json({ error: 'Failed to fetch schedules' })
    }
})

// POST /api/clinics/:clinicId/schedule - Create schedule block
router.post('/:clinicId/schedule', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { locationId, date, startTime, endTime, roleRequired, headcountRequired } = req.body

        const { data, error } = await supabaseAdmin
            .from('schedule_blocks')
            .insert({
                clinic_id: clinicId,
                location_id: locationId,
                date,
                start_time: startTime,
                end_time: endTime,
                role_required: roleRequired,
                headcount_required: headcountRequired || 1
            })
            .select()
            .single()

        if (error) {
            console.error('Schedule create error:', error)
            return res.status(500).json({ error: 'Failed to create schedule' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Schedule create error:', err)
        res.status(500).json({ error: 'Failed to create schedule' })
    }
})

// ============================================
// PAYROLL ENDPOINTS
// ============================================

// GET /api/clinics/:clinicId/payroll-stats - Get aggregated attendance for payroll
router.get('/:clinicId/payroll-stats', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { startDate, endDate } = req.query

        console.log('📊 Payroll stats request:', { clinicId, startDate, endDate })

        // First, fetch ALL attendance records to debug
        const { data: allAttendance } = await supabaseAdmin
            .from('attendance')
            .select('user_id, clinic_id, date, status')
            .gte('date', startDate || '2025-01-01')
            .lte('date', endDate || '2025-12-31')

        console.log('📊 ALL attendance records (ignoring clinic_id):', allAttendance?.length || 0)
        if (allAttendance?.length > 0) {
            console.log('📊 All attendance clinic_ids:', [...new Set(allAttendance.map(a => a.clinic_id))])
            console.log('📊 Expected clinic_id:', clinicId)
        }

        // Use ALL attendance for now (will fix clinic_id sync later)
        // Filter by date range only
        let query = supabaseAdmin
            .from('attendance')
            .select('*, user:user_id(first_name, last_name, pay_rate, pay_type)')

        if (startDate) query = query.gte('date', startDate)
        if (endDate) query = query.lte('date', endDate)

        const { data: attendance, error } = await query

        if (error) {
            console.error('Payroll stats error:', error)
            return res.status(500).json({ error: 'Failed to fetch payroll stats' })
        }

        // Aggregate by user
        const userStats = {}
        for (const record of attendance || []) {
            const userId = record.user_id
            if (!userStats[userId]) {
                userStats[userId] = {
                    user_id: userId,
                    full_days: 0,
                    half_days: 0,
                    absent_days: 0,
                    total_hours: 0
                }
            }

            // Categorize based on status
            if (record.status === 'present_full') {
                userStats[userId].full_days++
            } else if (record.status === 'present_partial' || record.status === 'half_day') {
                userStats[userId].half_days++
            } else if (record.status === 'absent') {
                userStats[userId].absent_days++
            }

            // Add total hours
            if (record.total_hours) {
                userStats[userId].total_hours += parseFloat(record.total_hours)
            }
        }

        console.log('📊 Payroll stats - attendance records found:', attendance?.length || 0)
        if (attendance?.length > 0) {
            console.log('📊 Sample records:', attendance.slice(0, 3).map(r => ({
                user_id: r.user_id,
                date: r.date,
                status: r.status,
                clinic_id: r.clinic_id
            })))
        }
        console.log('📊 Payroll stats aggregated for', Object.keys(userStats).length, 'users')
        console.log('📊 User stats:', userStats)

        res.json({ stats: userStats })
    } catch (err) {
        console.error('Payroll stats error:', err)
        res.status(500).json({ error: 'Failed to fetch payroll stats' })
    }
})

// ============================================
// ATTENDANCE ENDPOINTS
// ============================================

// GET /api/clinics/:clinicId/attendance - Get attendance records
router.get('/:clinicId/attendance', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { startDate, endDate } = req.query

        console.log('📊 Attendance fetch for date range:', startDate, 'to', endDate)

        // Use explicit foreign key for user relationship
        let query = supabaseAdmin
            .from('attendance')
            .select('*, user:user_id(first_name, last_name, job_title)')

        if (startDate) query = query.gte('date', startDate)
        if (endDate) query = query.lte('date', endDate)

        const { data, error } = await query.order('date', { ascending: false })

        if (error) {
            console.error('Attendance fetch error:', error)
            return res.status(500).json({ error: 'Failed to fetch attendance' })
        }

        res.json({ data })
    } catch (err) {
        console.error('Attendance error:', err)
        res.status(500).json({ error: 'Failed to fetch attendance' })
    }
})

// ============================================
// LEAVE ENDPOINTS
// ============================================

// GET /api/clinics/:clinicId/leave - Get leave requests
router.get('/:clinicId/leave', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { status } = req.query

        console.log('📋 Fetching leave requests:')
        console.log('   Clinic ID:', clinicId)
        console.log('   Status filter:', status || 'all')

        let query = supabaseAdmin
            .from('leave_requests')
            .select('*, user:user_id(first_name, last_name, job_title)')
            .eq('clinic_id', clinicId)

        if (status) query = query.eq('status', status)

        const { data, error } = await query.order('created_at', { ascending: false })

        if (error) {
            console.error('❌ Leave fetch error:', error)
            console.error('   Error code:', error.code)
            console.error('   Error message:', error.message)
            console.error('   Error details:', error.details)
            return res.status(500).json({ error: 'Failed to fetch leave requests', details: error.message })
        }

        console.log('   Results found:', data?.length || 0)
        if (data?.length > 0) {
            console.log('   First request:', data[0].id, data[0].leave_type, data[0].status)
        }

        res.json({ data })
    } catch (err) {
        console.error('❌ Leave catch error:', err)
        res.status(500).json({ error: 'Failed to fetch leave requests' })
    }
})

// GET /api/clinics/:clinicId/leave/pending - Get pending leave requests for approval
router.get('/:clinicId/leave/pending', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params

        console.log('📋 Pending leave request for clinic:', clinicId)

        const { data, error } = await supabaseAdmin
            .from('leave_requests')
            .select('*, user:user_id(first_name, last_name, email)')
            .eq('clinic_id', clinicId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('❌ Pending leave error:', error)
            return res.status(500).json({ error: 'Failed to fetch pending requests' })
        }

        console.log('✅ Pending leave found:', data?.length || 0, 'requests')

        // Format with user names
        const requests = (data || []).map(r => ({
            ...r,
            user_name: r.user ? `${r.user.first_name} ${r.user.last_name}` : 'Unknown'
        }))

        res.json({ requests })
    } catch (err) {
        console.error('❌ Pending leave catch error:', err)
        res.status(500).json({ error: 'Failed to fetch pending requests' })
    }
})

// PATCH /api/clinics/:clinicId/leave/:leaveId - Update leave request
router.patch('/:clinicId/leave/:leaveId', authMiddleware, async (req, res) => {
    try {
        const { leaveId } = req.params
        const { status } = req.body

        console.log('📋 Updating leave request:', leaveId, 'to', status)

        const { data, error } = await supabaseAdmin
            .from('leave_requests')
            .update({
                status,
                reviewed_by: req.user.userId,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', leaveId)
            .select()
            .single()

        if (error) {
            console.error('❌ Leave update error:', error)
            return res.status(500).json({ error: 'Failed to update leave request', details: error.message })
        }

        console.log('✅ Leave updated successfully:', data.id, data.status)
        res.json({ success: true, data })
    } catch (err) {
        console.error('❌ Leave update catch error:', err)
        res.status(500).json({ error: 'Failed to update leave request' })
    }
})

// ============================================
// STAFF ENDPOINTS
// ============================================

// GET /api/clinics/:clinicId/staff - Get all staff
router.get('/:clinicId/staff', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { includeOwner } = req.query

        console.log('📊 Staff fetch for clinic:', clinicId)

        let query = supabaseAdmin
            .from('users')
            .select('*, clinic_locations(name)')
            .eq('clinic_id', clinicId)
            .order('created_at', { ascending: false })

        // Only filter out owner if not explicitly including
        if (!includeOwner) {
            query = query.neq('role', 'owner')
        }

        const { data, error } = await query

        if (error) {
            console.error('Staff fetch error:', error)
            return res.status(500).json({ error: 'Failed to fetch staff' })
        }

        console.log('📊 Staff found:', data?.length || 0, 'users')

        res.json({ data })
    } catch (err) {
        console.error('Staff error:', err)
        res.status(500).json({ error: 'Failed to fetch staff' })
    }
})

// POST /api/clinics/:clinicId/staff - Add new staff member
router.post('/:clinicId/staff', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { first_name, last_name, email, phone, job_title, location_id, hourly_rate } = req.body

        if (!first_name || !last_name || !email || !job_title) {
            return res.status(400).json({ error: 'First name, last name, email, and job title are required' })
        }

        // Check if email exists
        const { data: existing, error: existingError } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle()

        console.log('📧 Email check:', email, 'Existing:', existing)

        if (existing) {
            return res.status(400).json({ error: 'A user with this email already exists' })
        }

        // Generate invite token
        const crypto = await import('crypto')
        const inviteToken = crypto.randomBytes(32).toString('hex')

        // Create staff member WITHOUT password (they'll set it via invite)
        const { data, error } = await supabaseAdmin
            .from('users')
            .insert({
                clinic_id: clinicId,
                first_name,
                last_name,
                email,
                phone,
                job_title,
                location_id: location_id || null,
                pay_rate: hourly_rate ? parseFloat(hourly_rate) : null,
                pay_type: 'hourly',
                role: 'staff',
                account_type: 'staff',
                password_hash: null,  // No password yet - will be set via invite
                is_active: false,     // Not active until they accept invite
                invite_token: inviteToken,
                invite_status: 'pending'
            })
            .select('*, clinic_locations(name)')
            .single()

        if (error) {
            console.error('Staff create error:', error)
            return res.status(500).json({ error: error.message || 'Failed to create staff member' })
        }

        // Get clinic name for email
        const { data: clinic } = await supabaseAdmin
            .from('clinics')
            .select('name')
            .eq('id', clinicId)
            .single()

        // Send invite email via Brevo
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
                        <p style="color: #666; font-size: 12px;">This invite link is valid for 7 days.</p>
                    </div>
                `,
                textContent: `Hi ${first_name}, You've been invited to join ${clinic?.name}. Accept your invitation here: ${inviteLink}`
            })
            console.log('✅ Invite email sent to:', email)
        } catch (emailErr) {
            console.error('❌ Failed to send invite email:', emailErr)
            // Don't fail the request if email fails
        }

        res.json({ success: true, staff: data, inviteLink })
    } catch (err) {
        console.error('Staff create error:', err)
        res.status(500).json({ error: 'Failed to create staff member' })
    }
})

// PATCH /api/clinics/:clinicId/staff/:staffId/role - Update staff role
router.patch('/:clinicId/staff/:staffId/role', authMiddleware, async (req, res) => {
    try {
        const { clinicId, staffId } = req.params
        const { role } = req.body

        if (!role) {
            return res.status(400).json({ error: 'Role is required' })
        }

        const { data, error } = await supabaseAdmin
            .from('users')
            .update({
                job_title: role,
                updated_at: new Date().toISOString()
            })
            .eq('id', staffId)
            .eq('clinic_id', clinicId)
            .select()
            .single()

        if (error) {
            console.error('Role update error:', error)
            return res.status(500).json({ error: 'Failed to update role' })
        }

        console.log('✅ Role updated:', staffId, '→', role)
        res.json({ success: true, staff: data })
    } catch (err) {
        console.error('Role update error:', err)
        res.status(500).json({ error: 'Failed to update role' })
    }
})

// ============================================
// LOCATION ENDPOINTS
// ============================================

// GET /api/clinics/:clinicId/locations - Get all locations for a clinic
router.get('/:clinicId/locations', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params

        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .select('*')
            .eq('clinic_id', clinicId)
            .order('is_primary', { ascending: false })

        if (error) {
            console.error('Locations fetch error:', error)
            return res.status(500).json({ error: 'Failed to fetch locations' })
        }

        res.json({ locations: data || [] })
    } catch (err) {
        console.error('Locations error:', err)
        res.status(500).json({ error: 'Failed to fetch locations' })
    }
})

// POST /api/clinics/:clinicId/locations - Add new location
router.post('/:clinicId/locations', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { name, city, address, is_primary } = req.body

        if (!name || !city) {
            return res.status(400).json({ error: 'Location name and city are required' })
        }

        // If setting as primary, unset other primaries
        if (is_primary) {
            await supabaseAdmin
                .from('clinic_locations')
                .update({ is_primary: false })
                .eq('clinic_id', clinicId)
        }

        const { data, error } = await supabaseAdmin
            .from('clinic_locations')
            .insert({
                clinic_id: clinicId,
                name,
                city,
                address,
                is_primary: is_primary || false,
                facility_verification_status: 'draft'
            })
            .select()
            .single()

        if (error) {
            console.error('Location create error:', error)
            return res.status(500).json({ error: 'Failed to create location' })
        }

        res.json({ success: true, location: data })
    } catch (err) {
        console.error('Location create error:', err)
        res.status(500).json({ error: 'Failed to create location' })
    }
})

// POST /api/clinics/:clinicId/locations/:locationId/verification - Submit facility for verification
router.post('/:clinicId/locations/:locationId/verification', authMiddleware, async (req, res) => {
    try {
        const { locationId } = req.params
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
            .select()
            .single()

        if (error) {
            console.error('Facility verification error:', error)
            return res.status(500).json({ error: 'Failed to submit verification' })
        }

        res.json({ success: true, location: data })
    } catch (err) {
        console.error('Facility verification error:', err)
        res.status(500).json({ error: 'Failed to submit verification' })
    }
})

// ============================================
// SCHEDULE ENDPOINTS
// ============================================

// GET /api/clinics/:clinicId/schedules - Get all schedules for a clinic
router.get('/:clinicId/schedules', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const today = new Date().toISOString().split('T')[0]

        const { data, error } = await supabaseAdmin
            .from('schedule_blocks')
            .select(`
                *,
                clinic_locations(name),
                schedule_assignments(
                    user_id,
                    status,
                    users(first_name, last_name)
                )
            `)
            .eq('clinic_id', clinicId)
            .gte('date', today)
            .order('date', { ascending: true })

        if (error) {
            console.error('Schedules fetch error:', error)
            return res.status(500).json({ error: 'Failed to fetch schedules' })
        }

        // Format response
        const schedules = (data || []).map(s => ({
            id: s.id,
            date: s.date,
            start_time: s.start_time,
            end_time: s.end_time,
            role_required: s.role_required,
            headcount_required: s.headcount_required,
            location: s.clinic_locations?.name,
            location_id: s.location_id,
            status: s.status || 'open',
            assigned_name: s.schedule_assignments?.[0]?.users
                ? `${s.schedule_assignments[0].users.first_name} ${s.schedule_assignments[0].users.last_name}`
                : null,
            assignments: s.schedule_assignments || []
        }))

        res.json({ schedules })
    } catch (err) {
        console.error('Schedules error:', err)
        res.status(500).json({ error: 'Failed to fetch schedules' })
    }
})

// POST /api/clinics/:clinicId/schedules - Create a new schedule block (shift)
router.post('/:clinicId/schedules', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { location_id, date, start_time, end_time, role_required, headcount_required } = req.body

        if (!location_id || !date || !start_time || !end_time) {
            return res.status(400).json({ error: 'Location, date, start time, and end time are required' })
        }

        const { data, error } = await supabaseAdmin
            .from('schedule_blocks')
            .insert({
                clinic_id: clinicId,
                location_id,
                date,
                start_time,
                end_time,
                role_required: role_required || null,
                headcount_required: headcount_required || 1
            })
            .select('*, clinic_locations(name)')
            .single()

        if (error) {
            console.error('Schedule create error:', error)
            return res.status(500).json({ error: error.message || 'Failed to create schedule' })
        }

        console.log('✅ Schedule created:', data.id)
        res.json({ success: true, schedule: data })
    } catch (err) {
        console.error('Schedule create error:', err)
        res.status(500).json({ error: 'Failed to create schedule' })
    }
})

export default router
