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
            .select('*, clinic_locations(name, city), clinics(name)')
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
                jobTitle: data.job_title || 'Staff',
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

// GET /api/employee/schedule
router.get('/schedule', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId
        const today = new Date().toISOString().split('T')[0]

        // Get scheduled shifts for this user
        const { data: assignments } = await supabaseAdmin
            .from('schedule_assignments')
            .select('*, schedule_blocks(*, clinic_locations(name))')
            .eq('user_id', userId)
            .gte('schedule_blocks.date', today)
            .order('schedule_blocks(date)', { ascending: true })

        // Get available shifts (unassigned, at user's location)
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('clinic_id, location_id')
            .eq('id', userId)
            .single()

        const { data: available } = await supabaseAdmin
            .from('schedule_blocks')
            .select('*, clinic_locations(name)')
            .eq('clinic_id', user?.clinic_id)
            .gte('date', today)
            .limit(10)

        res.json({
            scheduled: (assignments || []).map(a => ({
                id: a.id,
                date: a.schedule_blocks?.date,
                start_time: a.schedule_blocks?.start_time,
                end_time: a.schedule_blocks?.end_time,
                location: a.schedule_blocks?.clinic_locations?.name,
                status: a.status
            })),
            available: available || []
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

        const { data, error } = await supabaseAdmin
            .from('leave_requests')
            .insert({
                clinic_id: user.clinic_id,
                user_id: userId,
                leave_type: leaveType,
                start_date: startDate,
                end_date: endDate,
                reason,
                status: 'pending'
            })
            .select()
            .single()

        if (error) {
            return res.status(500).json({ error: 'Failed to create leave request' })
        }

        res.json({ success: true, data })
    } catch (err) {
        console.error('Create leave error:', err)
        res.status(500).json({ error: 'Failed to create leave request' })
    }
})

export default router
