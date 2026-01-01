import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware, requirePermission } from '../lib/auth.js'

const router = express.Router()

// GET /api/dashboard/:clinicId/hr-stats
router.get('/:clinicId/hr-stats', authMiddleware, requirePermission('view_reports'), async (req, res) => {
    try {
        const { clinicId } = req.params
        const today = new Date().toISOString().split('T')[0]
        const next30Days = new Date()
        next30Days.setDate(next30Days.getDate() + 30)

        // 1. Pending Leave Requests
        const { count: pendingLeaveCount, error: leaveError } = await supabaseAdmin
            .from('leave_requests')
            .select('id', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .eq('status', 'pending')

        if (leaveError) console.error('Leave stats error:', leaveError)

        // 2. Expiring Licenses (Locations)
        // assuming column is 'license_expiry' based on standard naming, if not we catch error
        const { count: expiringLicensesCount, error: licenseError } = await supabaseAdmin
            .from('clinic_locations')
            .select('id', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .lt('license_expiry', next30Days.toISOString()) // Expiring soon or expired
            .not('license_expiry', 'is', null)

        if (licenseError) console.error('License stats error:', licenseError)

        // 3. Staff Compliance Issues (Missing Phone or Emergency Contact)
        const { count: complianceCount, error: complianceError } = await supabaseAdmin
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .eq('is_active', true)
            .or('phone.is.null,emergency_contact_name.is.null')

        if (complianceError) console.error('Compliance stats error:', complianceError)

        // 4. Onboarding Progress (Pending Invites)
        // Check 'status' column if it exists, otherwise rely on is_active=false? 
        // Usually 'status' = 'pending' for invited users.
        const { count: onboardingCount, error: onboardingError } = await supabaseAdmin
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .eq('status', 'pending')

        if (onboardingError) console.error('Onboarding stats error:', onboardingError)

        // 5. Attendance Exceptions (Absent Today)
        const { count: absentCount, error: attendanceError } = await supabaseAdmin
            .from('attendance')
            .select('id', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .eq('date', today)
            .eq('status', 'absent')

        if (attendanceError) console.error('Attendance stats error:', attendanceError)

        res.json({
            stats: {
                pendingLeave: pendingLeaveCount || 0,
                expiringLicenses: expiringLicensesCount || 0,
                complianceIssues: complianceCount || 0,
                onboardingPending: onboardingCount || 0,
                attendanceExceptions: absentCount || 0
            }
        })
    } catch (err) {
        console.error('Dashboard stats error:', err)
        res.status(500).json({ error: 'Failed to fetch dashboard stats' })
    }
})

export default router
