import express from 'express'
import multer from 'multer'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware, requirePermission } from '../lib/auth.js'

const router = express.Router()

// Configure multer for memory storage (files stored as Buffer)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png']
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true)
        } else {
            cb(new Error('Invalid file type. Only PDF, JPG, and PNG are allowed.'))
        }
    }
})

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
router.patch('/:clinicId/settings', authMiddleware, requirePermission('manage_settings'), async (req, res) => {
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
// DELETE /api/clinics/:clinicId - Delete clinic (DISABLED favor of deactivate)
// router.delete('/:clinicId', authMiddleware, async (req, res) => {
//     try {
//         const { clinicId } = req.params
//         // const { error } = await supabaseAdmin.from('clinics').delete().eq('id', clinicId)
//         // if (error) return res.status(500).json({ error: 'Failed' })
//         // res.json({ success: true })
//         res.status(405).json({ error: 'Start deactivation instead' })
//     } catch (err) {
//         res.status(500).json({ error: 'Failed' })
//     }
// })

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
            .select('*, clinic_locations(name), schedule_assignments(*, users(first_name, last_name))')
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
            .select('*, user:user_id(first_name, last_name, job_title), reviewer:reviewed_by(first_name, last_name)')
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

// Staff routes have been moved to routes/staff.js to prevent conflicts

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
                phone: req.body.phone,
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

// DELETE /api/clinics/:clinicId/locations/:locationId - Delete location
router.delete('/:clinicId/locations/:locationId', authMiddleware, async (req, res) => {
    try {
        const { clinicId, locationId } = req.params

        // 1. Check for assigned staff
        const { count: staffCount, error: staffError } = await supabaseAdmin
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('location_id', locationId)

        if (staffError && staffError.code !== 'PGRST100') { // Ignore column not found for a moment if we guessed wrong, but real error should be handled
            console.error('Check staff error:', staffError)
        }

        if (staffCount > 0) {
            return res.status(400).json({ error: `Cannot delete location. ${staffCount} staff member(s) are assigned to this location. Please reassign them first.` })
        }

        // 2. Check for schedule blocks (future or past)
        const { count: scheduleCount, error: scheduleError } = await supabaseAdmin
            .from('schedule_blocks')
            .select('id', { count: 'exact', head: true })
            .eq('location_id', locationId)

        if (scheduleCount > 0) {
            return res.status(400).json({ error: `Cannot delete location. There are ${scheduleCount} schedule blocks associated with this location. Please delete the schedules first.` })
        }

        // 3. Delete the location
        const { error } = await supabaseAdmin
            .from('clinic_locations')
            .delete()
            .eq('id', locationId)
            .eq('clinic_id', clinicId)

        if (error) {
            console.error('Location delete error:', error)
            // Fallback for other FK violations we missed
            if (error.code === '23503') {
                return res.status(400).json({ error: 'Cannot delete location because it is referenced by other records (e.g. shifts or staff).' })
            }
            return res.status(500).json({ error: 'Failed to delete location' })
        }

        res.json({ success: true, message: 'Location deleted successfully' })
    } catch (err) {
        console.error('Location delete error:', err)
        res.status(500).json({ error: 'Failed to delete location' })
    }
})

// POST /api/clinics/:clinicId/deactivate - Deactivate organization
router.post('/:clinicId/deactivate', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params

        console.log('🛑 Deactivating organization:', clinicId)

        // 1. Update clinic status
        const { error: clinicError } = await supabaseAdmin
            .from('clinics')
            .update({
                status: 'inactive',
                plan_status: 'cancelled', // or 'paused'
                updated_at: new Date().toISOString()
            })
            .eq('id', clinicId)

        if (clinicError) {
            console.error('Clinic update error:', clinicError)
            throw clinicError
        }

        // 2. Suspend all users
        const { error: usersError } = await supabaseAdmin
            .from('users')
            .update({ is_active: false })
            .eq('clinic_id', clinicId)

        if (usersError) {
            console.error('Users suspend error:', usersError)
            throw usersError
        }

        console.log('✅ Organization deactivated successfully')
        res.json({ success: true, message: 'Organization deactivated successfully' })
    } catch (err) {
        console.error('Deactivate error:', err)
        res.status(500).json({ error: 'Failed to deactivate organization' })
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
router.post('/:clinicId/schedules', authMiddleware, requirePermission('manage_schedule'), async (req, res) => {
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

// ============================================
// STAFF MANAGEMENT ENDPOINTS
// ============================================

// PATCH /api/clinics/:clinicId/staff/:staffId - Update staff member
router.patch('/:clinicId/staff/:staffId', authMiddleware, async (req, res) => {
    try {
        const { clinicId, staffId } = req.params
        const updates = req.body

        // Allowed fields to update (must match columns in users table)
        const allowedFields = ['first_name', 'last_name', 'email', 'phone', 'job_title', 'location_id', 'employment_type', 'pay_rate', 'is_active']
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
            .eq('id', staffId)
            .eq('clinic_id', clinicId)
            .select('*, clinic_locations(name)')
            .single()

        if (error) {
            console.error('Update staff error:', error)
            return res.status(500).json({ error: 'Failed to update staff' })
        }

        console.log('✅ Staff updated:', staffId)
        res.json({ success: true, staff: data })
    } catch (err) {
        console.error('Update staff error:', err)
        res.status(500).json({ error: 'Failed to update staff' })
    }
})

// ============================================
// DOCUMENT MANAGEMENT ENDPOINTS
// ============================================

// POST /api/clinics/:clinicId/documents/upload - Upload organization document to Supabase Storage
router.post('/:clinicId/documents/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { clinicId } = req.params
        const { documentType, expiryDate } = req.body
        const file = req.file

        if (!file) {
            return res.status(400).json({ error: 'No file provided' })
        }

        if (!documentType) {
            return res.status(400).json({ error: 'Document type is required' })
        }

        const validTypes = ['business_reg', 'facility_license']
        if (!validTypes.includes(documentType)) {
            return res.status(400).json({ error: 'Invalid document type' })
        }

        // Generate unique filename with original extension
        const fileExt = file.originalname.split('.').pop()
        const fileName = `${clinicId}/${documentType}_${Date.now()}.${fileExt}`

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('org-documents')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            })

        if (uploadError) {
            console.error('Supabase Storage upload error:', uploadError)
            return res.status(500).json({ error: 'Failed to upload to storage: ' + uploadError.message })
        }

        // Get public URL for the uploaded file
        const { data: urlData } = supabaseAdmin.storage
            .from('org-documents')
            .getPublicUrl(fileName)

        const documentUrl = urlData?.publicUrl || fileName

        // Build update object
        const updates = {
            updated_at: new Date().toISOString()
        }

        if (documentType === 'business_reg') {
            updates.business_reg_doc = documentUrl
            if (expiryDate) updates.business_reg_expiry = expiryDate
        } else if (documentType === 'facility_license') {
            updates.facility_license_doc = documentUrl
            if (expiryDate) updates.facility_license_expiry = expiryDate
        }

        // Update clinic record with document URL
        const { data, error } = await supabaseAdmin
            .from('clinics')
            .update(updates)
            .eq('id', clinicId)
            .select()
            .single()

        if (error) {
            console.error('Database update error:', error)
            return res.status(500).json({ error: 'Failed to save document reference' })
        }

        console.log('✅ Document uploaded to Supabase Storage:', fileName)
        res.json({ success: true, clinic: data, filePath: fileName })
    } catch (err) {
        console.error('Document upload error:', err)
        res.status(500).json({ error: 'Failed to upload document: ' + err.message })
    }
})

// PATCH /api/clinics/:clinicId/verification/submit - Submit organization for verification
router.patch('/:clinicId/verification/submit', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params

        // Check if required documents are uploaded
        const { data: clinic } = await supabaseAdmin
            .from('clinics')
            .select('business_reg_doc, facility_license_doc, org_verification_status')
            .eq('id', clinicId)
            .single()

        if (!clinic) {
            return res.status(404).json({ error: 'Clinic not found' })
        }

        if (!clinic.business_reg_doc || !clinic.facility_license_doc) {
            return res.status(400).json({ error: 'Please upload both required documents before submitting' })
        }

        const { data, error } = await supabaseAdmin
            .from('clinics')
            .update({
                org_verification_status: 'under_review',
                verification_submitted_at: new Date().toISOString(),
                verification_rejection_reason: null, // Clear previous rejection
                updated_at: new Date().toISOString()
            })
            .eq('id', clinicId)
            .select()
            .single()

        if (error) {
            console.error('Verification submit error:', error)
            return res.status(500).json({ error: 'Failed to submit for verification' })
        }

        console.log('✅ Clinic submitted for verification:', clinicId)
        res.json({ success: true, clinic: data })
    } catch (err) {
        console.error('Verification submit error:', err)
        res.status(500).json({ error: 'Failed to submit for verification' })
    }
})

// PATCH /api/clinics/:clinicId/verification/review - Admin approve/reject organization (SuperAdmin only)
router.patch('/:clinicId/verification/review', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { status, rejectionReason } = req.body

        // Only superadmin can review
        if (req.user?.role !== 'superadmin' && !req.user?.email?.includes('@hure.app')) {
            return res.status(403).json({ error: 'Only SuperAdmin can review verifications' })
        }

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status must be approved or rejected' })
        }

        if (status === 'rejected' && !rejectionReason) {
            return res.status(400).json({ error: 'Rejection reason is required when rejecting' })
        }

        const updates = {
            org_verification_status: status,
            verification_reviewed_at: new Date().toISOString(),
            verification_reviewed_by: req.user.userId,
            updated_at: new Date().toISOString()
        }

        if (status === 'rejected') {
            updates.verification_rejection_reason = rejectionReason
        } else {
            updates.verification_rejection_reason = null
        }

        const { data, error } = await supabaseAdmin
            .from('clinics')
            .update(updates)
            .eq('id', clinicId)
            .select()
            .single()

        if (error) {
            console.error('Verification review error:', error)
            return res.status(500).json({ error: 'Failed to review verification' })
        }

        console.log(`✅ Clinic ${status}:`, clinicId, 'by', req.user.email)
        res.json({ success: true, clinic: data })
    } catch (err) {
        console.error('Verification review error:', err)
        res.status(500).json({ error: 'Failed to review verification' })
    }
})



export default router

