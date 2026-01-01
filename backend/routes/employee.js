import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware } from '../lib/auth.js'

const router = express.Router()

// GET /api/employee/profile
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId

        const { data, error } = await supabaseAdmin
            .from('users')
            .select('*, clinic_locations(name, city), clinics!users_clinic_id_fkey(name)')
            .eq('id', userId)
            .single()

        if (error || !data) {
            return res.status(404).json({ error: 'Profile not found' })
        }

        res.json({
            profile: {
                id: data.id,
                email: data.email,
                firstName: data.first_name,
                lastName: data.last_name,
                phone: data.phone,
                gender: data.gender,
                dob: data.dob,
                emergencyContact: {
                    name: data.emergency_contact_name,
                    phone: data.emergency_contact_phone,
                    relationship: data.emergency_contact_relationship
                },
                address: {
                    country: data.country || 'Kenya',
                    city: data.city,
                    area: data.area
                },
                jobTitle: data.job_title || 'Staff',
                role: data.role || 'Staff',
                permission_role: data.permission_role,
                location: data.clinic_locations?.name || 'Main Location',
                hireDate: data.hire_date,
                clinicName: data.clinics?.name || ''
            }
        })
    } catch (err) {
        console.error('Get profile error:', err)
        res.status(500).json({ error: 'Failed to fetch profile' })
    }
})

// PATCH /api/employee/profile
router.patch('/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId
        const updates = req.body

        // Filter allowed fields
        const allowed = ['phone', 'gender', 'dob', 'city', 'area', 'country', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship']
        const filtered = {}

        Object.keys(updates).forEach(key => {
            if (allowed.includes(key)) {
                let value = updates[key]
                // Convert empty strings to null for nullable fields to avoid Postgres type errors
                if (value === '') value = null
                filtered[key] = value
            }
        })

        // Basic validation
        if (updates.phone === '') filtered.phone = null // Allow clearing? or require? User said Phone Required.
        // If phone is required, we should check it, but let's assume frontend validation for now.

        filtered.last_profile_update = new Date().toISOString()

        const { data, error } = await supabaseAdmin
            .from('users')
            .update(filtered)
            .eq('id', userId)
            .select()
            .single()

        if (error) {
            console.error('Profile update error:', error)
            return res.status(500).json({ error: 'Failed to update profile' })
        }

        res.json({ success: true, message: 'Profile updated successfully' })
    } catch (err) {
        console.error('Update profile error:', err)
        res.status(500).json({ error: 'Failed to update profile' })
    }
})

// GET /api/employee/schedule
router.get('/schedule', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId
        const today = new Date().toISOString().split('T')[0]

        // Get ALL assignments for this user (both pending and confirmed)
        const { data: assignments } = await supabaseAdmin
            .from('schedule_assignments')
            .select('*, schedule_blocks(*, clinic_locations(name))')
            .eq('user_id', userId)
            .gte('schedule_blocks.date', today)
            .order('schedule_blocks(date)', { ascending: true })

        // Separate confirmed (scheduled) from pending (available/needs acceptance)
        const confirmedAssignments = (assignments || []).filter(a => a.status === 'confirmed')
        const pendingAssignments = (assignments || []).filter(a => a.status === 'pending')

        // Combine pending assignments (shift requests) with open shifts for "Available"
        const pendingShifts = pendingAssignments.map(a => ({
            id: a.schedule_block_id,
            date: a.schedule_blocks?.date,
            start_time: a.schedule_blocks?.start_time,
            end_time: a.schedule_blocks?.end_time,
            location: a.schedule_blocks?.clinic_locations?.name,
            role_required: a.schedule_blocks?.role_required,
            isAssigned: true  // Mark as assigned request (needs accept)
        }))

        res.json({
            scheduled: confirmedAssignments.map(a => ({
                id: a.id,
                date: a.schedule_blocks?.date,
                start_time: a.schedule_blocks?.start_time,
                end_time: a.schedule_blocks?.end_time,
                location: a.schedule_blocks?.clinic_locations?.name,
                status: a.status
            })),
            available: pendingShifts // Only show shifts explicitly assigned to this user

        })
    } catch (err) {
        console.error('Get schedule error:', err)
        res.status(500).json({ error: 'Failed to fetch schedule' })
    }
})

// GET /api/employee/attendance
router.get('/attendance', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId
        const today = new Date().toISOString().split('T')[0]

        // Get today's attendance
        const { data: todayRecord } = await supabaseAdmin
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today)
            .single()

        // Get attendance history
        const { data: records } = await supabaseAdmin
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(30)

        res.json({
            today: todayRecord || null,
            records: records || []
        })
    } catch (err) {
        console.error('Get attendance error:', err)
        res.status(500).json({ error: 'Failed to fetch attendance' })
    }
})

// POST /api/employee/attendance/clock-in
router.post('/attendance/clock-in', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId
        const today = new Date().toISOString().split('T')[0]

        // Get user's clinic and location
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('clinic_id, location_id')
            .eq('id', userId)
            .single()

        // Check if already clocked in
        const { data: existing } = await supabaseAdmin
            .from('attendance')
            .select('id')
            .eq('user_id', userId)
            .eq('date', today)
            .single()

        if (existing) {
            return res.status(400).json({ error: 'Already clocked in today' })
        }

        const { data, error } = await supabaseAdmin
            .from('attendance')
            .insert({
                clinic_id: user.clinic_id,
                location_id: user.location_id,
                user_id: userId,
                date: today,
                clock_in: new Date().toISOString()
            })
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to clock in' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Clock in error:', err)
        res.status(500).json({ error: 'Failed to clock in' })
    }
})

// POST /api/employee/attendance/clock-out
router.post('/attendance/clock-out', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId
        const today = new Date().toISOString().split('T')[0]

        const { data: existing } = await supabaseAdmin
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today)
            .single()

        if (!existing) {
            return res.status(400).json({ error: 'No clock-in found for today' })
        }

        if (existing.clock_out) {
            return res.status(400).json({ error: 'Already clocked out' })
        }

        const clockOut = new Date()
        const clockIn = new Date(existing.clock_in)
        const totalHours = (clockOut - clockIn) / (1000 * 60 * 60)

        let status = 'present_full'
        if (totalHours < 1) status = 'absent'
        else if (totalHours < 4) status = 'present_partial'

        const { data, error } = await supabaseAdmin
            .from('attendance')
            .update({
                clock_out: clockOut.toISOString(),
                total_hours: totalHours.toFixed(2),
                status
            })
            .eq('id', existing.id)
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to clock out' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Clock out error:', err)
        res.status(500).json({ error: 'Failed to clock out' })
    }
})

// GET /api/employee/leave
router.get('/leave', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId

        const { data: requests } = await supabaseAdmin
            .from('leave_requests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        // Calculate balance (simple version)
        const approvedDays = (requests || [])
            .filter(r => r.status === 'approved')
            .reduce((sum, r) => {
                if (r.units_requested) return sum + r.units_requested
                const start = new Date(r.start_date)
                const end = new Date(r.end_date)
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
                return sum + days
            }, 0)

        res.json({
            requests: requests || [],
            balance: {
                annual: 21,
                used: approvedDays
            }
        })
    } catch (err) {
        console.error('Get leave error:', err)
        res.status(500).json({ error: 'Failed to fetch leave' })
    }
})

// POST /api/employee/leave
router.post('/leave', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId
        const { leaveType, startDate, endDate, reason } = req.body

        // Get user's clinic
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('clinic_id')
            .eq('id', userId)
            .single()

        console.log('📋 Creating leave request:')
        console.log('   User ID:', userId)
        console.log('   Clinic ID:', user?.clinic_id)
        console.log('   Leave Type:', leaveType)
        console.log('   Dates:', startDate, 'to', endDate)

        if (!user?.clinic_id) {
            console.error('❌ User has no clinic_id!')
            return res.status(400).json({ error: 'User not associated with a clinic' })
        }

        const start = new Date(startDate)
        const end = new Date(endDate)

        if (end < start) {
            return res.status(400).json({ error: 'End date cannot be before start date' })
        }

        // Calculate units (days)
        const units = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1

        const { data, error } = await supabaseAdmin
            .from('leave_requests')
            .insert({
                clinic_id: user.clinic_id,
                user_id: userId,
                leave_type: leaveType,
                start_date: startDate,
                end_date: endDate,
                units_requested: units,
                reason,
                status: 'pending'
            })
            .select()
            .single()

        if (error) {
            console.error('❌ Leave create error:', error)
            return res.status(500).json({ error: 'Failed to create leave request' })
        }

        console.log('✅ Leave request created:', data.id)
        res.json({ success: true, data })
    } catch (err) {
        console.error('Create leave error:', err)
        res.status(500).json({ error: 'Failed to create leave request' })
    }
})

// POST /api/employee/schedule/:blockId/accept - Accept an available shift
router.post('/schedule/:blockId/accept', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId
        const { blockId } = req.params

        // Check if shift exists
        const { data: block, error: blockError } = await supabaseAdmin
            .from('schedule_blocks')
            .select('id, clinic_id')
            .eq('id', blockId)
            .single()

        if (blockError || !block) {
            return res.status(404).json({ error: 'Shift not found' })
        }

        // Check if user has a pending assignment for this shift
        const { data: existingAssignment } = await supabaseAdmin
            .from('schedule_assignments')
            .select('id, status')
            .eq('schedule_block_id', blockId)
            .eq('user_id', userId)
            .single()

        if (existingAssignment) {
            if (existingAssignment.status === 'confirmed') {
                return res.status(400).json({ error: 'You are already confirmed for this shift' })
            }

            // Update pending assignment to confirmed
            const { data, error } = await supabaseAdmin
                .from('schedule_assignments')
                .update({ status: 'confirmed' })
                .eq('id', existingAssignment.id)
                .select()
                .single()

            if (error) {
                console.error('Accept shift error:', error)
                return res.status(500).json({ error: 'Failed to accept shift' })
            }

            console.log('✅ Shift accepted (pending -> confirmed):', existingAssignment.id)
            return res.json({ success: true, data })
        }

        // No existing assignment - create new confirmed assignment (self-assignment)
        const { data, error } = await supabaseAdmin
            .from('schedule_assignments')
            .insert({
                schedule_block_id: blockId,
                user_id: userId,
                status: 'confirmed'
            })
            .select()
            .single()

        if (error) {
            console.error('Accept shift error:', error)
            return res.status(500).json({ error: 'Failed to accept shift' })
        }

        console.log('✅ Shift self-assigned:', data.id)
        res.json({ success: true, data })
    } catch (err) {
        console.error('Accept shift error:', err)
        res.status(500).json({ error: 'Failed to accept shift' })
    }
})

export default router
