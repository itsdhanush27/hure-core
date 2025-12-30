import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware, requirePermission } from '../lib/auth.js'

const router = express.Router({ mergeParams: true })

// ============================================
// GET /api/clinics/:clinicId/payroll
// Derives payroll FROM attendance (not schedule)
// Supports: ?type=salaried | daily | all
//           ?startDate=YYYY-MM-DD
//           ?endDate=YYYY-MM-DD
// ============================================
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { type, startDate, endDate } = req.query

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate required' })
        }

        // Fetch attendance records for the period
        const { data: attendanceData, error: attError } = await supabaseAdmin
            .from('attendance')
            .select(`
                *,
                users:users!attendance_user_id_fkey(id, first_name, last_name, job_title, employment_type, pay_rate),
                external_locums(id, name, role, daily_rate),
                clinic_locations(name)
            `)
            .eq('clinic_id', clinicId)
            .gte('date', startDate)
            .lte('date', endDate)

        if (attError) {
            console.error('Fetch attendance error:', attError)
            return res.status(500).json({ error: 'Failed to fetch payroll data' })
        }

        // Calculate days in period
        const periodStart = new Date(startDate)
        const periodEnd = new Date(endDate)
        const periodDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1

        // Group by employee/locum
        const payrollMap = new Map()

        for (const record of attendanceData || []) {
            const isLocum = !!record.external_locum_id
            const key = isLocum ? `locum_${record.external_locum_id}` : `user_${record.user_id}`

            if (!payrollMap.has(key)) {
                payrollMap.set(key, {
                    id: key,
                    type: isLocum ? 'locum' : 'staff',
                    userId: record.user_id,
                    locumId: record.external_locum_id,
                    name: isLocum
                        ? record.external_locums?.name
                        : `${record.users?.first_name} ${record.users?.last_name}`,
                    role: isLocum
                        ? record.external_locums?.role
                        : record.users?.job_title,
                    employmentType: isLocum
                        ? 'daily'
                        : (record.users?.employment_type || 'salaried'),
                    rate: isLocum
                        ? (record.external_locums?.daily_rate || 0)
                        : (record.users?.pay_rate || 0),
                    location: record.clinic_locations?.name,
                    unitsWorked: 0,
                    daysPresent: 0,
                    attendanceRecords: []
                })
            }

            const entry = payrollMap.get(key)
            entry.attendanceRecords.push(record)

            // Calculate units (Full day = 1.0, Partial = 0.5)
            if (record.status === 'present_full' || record.locum_status === 'WORKED') {
                const hours = parseFloat(record.total_hours) || 0
                if (hours >= 6) {
                    entry.unitsWorked += 1.0
                    entry.daysPresent += 1
                } else if (hours >= 3) {
                    entry.unitsWorked += 0.5
                    entry.daysPresent += 0.5
                }
            } else if (record.status === 'present_partial') {
                entry.unitsWorked += 0.5
                entry.daysPresent += 0.5
            }
        }

        // Calculate gross pay
        const payrollData = Array.from(payrollMap.values()).map(entry => {
            let grossPay = 0

            if (entry.employmentType === 'salaried') {
                // Salaried: (Monthly Salary ÷ Period Days) × Units Worked
                grossPay = (entry.rate / periodDays) * entry.unitsWorked
            } else {
                // Daily/Casual/Locum: Units × Daily Rate
                grossPay = entry.unitsWorked * entry.rate
            }

            return {
                ...entry,
                grossPay: Math.round(grossPay * 100) / 100,
                periodStart: startDate,
                periodEnd: endDate,
                periodDays,
                // Warning flag for salaried with no attendance
                hasWarning: entry.employmentType === 'salaried' && entry.unitsWorked === 0
            }
        })

        // Filter by type if specified
        let filteredData = payrollData
        if (type === 'salaried') {
            filteredData = payrollData.filter(p => p.employmentType === 'salaried')
        } else if (type === 'daily') {
            filteredData = payrollData.filter(p => p.employmentType !== 'salaried')
        }

        res.json({
            data: filteredData,
            periodDays,
            periodStart: startDate,
            periodEnd: endDate
        })
    } catch (err) {
        console.error('Get payroll error:', err)
        res.status(500).json({ error: 'Failed to fetch payroll' })
    }
})

// ============================================
// PATCH /api/clinics/:clinicId/payroll/:recordId/status
// Update payment status (UNPAID -> PAID)
// ============================================
router.patch('/:recordId/status', authMiddleware, async (req, res) => {
    try {
        const { clinicId, recordId } = req.params
        const { paymentStatus, paymentNote } = req.body

        // First check if record exists
        const { data: existing } = await supabaseAdmin
            .from('payroll_records')
            .select('*')
            .eq('id', recordId)
            .eq('clinic_id', clinicId)
            .single()

        if (existing) {
            // Update existing record
            const updates = {
                payment_status: paymentStatus,
                updated_at: new Date().toISOString()
            }

            if (paymentStatus === 'PAID') {
                updates.paid_at = new Date().toISOString()
                updates.paid_by = req.user.userId
                updates.payment_note = paymentNote || null
            }

            const { data, error } = await supabaseAdmin
                .from('payroll_records')
                .update(updates)
                .eq('id', recordId)
                .select()
                .single()

            if (error) {
                return res.status(500).json({ error: 'Failed to update payment status' })
            }

            res.json({ success: true, data })
        } else {
            // Create new payroll record with status
            const { userId, locumId, periodStart, periodEnd, unitsWorked, rate, grossPay, payType } = req.body

            const { data, error } = await supabaseAdmin
                .from('payroll_records')
                .insert({
                    clinic_id: clinicId,
                    user_id: userId || null,
                    external_locum_id: locumId || null,
                    period_start: periodStart,
                    period_end: periodEnd,
                    pay_type: payType || 'salaried',
                    units_worked: unitsWorked,
                    rate: rate,
                    gross_pay: grossPay,
                    payment_status: paymentStatus,
                    paid_at: paymentStatus === 'PAID' ? new Date().toISOString() : null,
                    paid_by: paymentStatus === 'PAID' ? req.user.userId : null,
                    payment_note: paymentNote || null
                })
                .select()
                .single()

            if (error) {
                console.error('Create payroll record error:', error)
                return res.status(500).json({ error: 'Failed to create payroll record' })
            }

            res.json({ success: true, data })
        }
    } catch (err) {
        console.error('Update payment status error:', err)
        res.status(500).json({ error: 'Failed to update payment status' })
    }
})

// ============================================
// GET /api/clinics/:clinicId/payroll/export
// Export payroll as CSV
// ============================================
router.get('/export', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { startDate, endDate } = req.query

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate required' })
        }

        // Get payroll data (reuse main endpoint logic)
        const payrollRes = await fetch(`${req.protocol}://${req.get('host')}/api/clinics/${clinicId}/payroll?startDate=${startDate}&endDate=${endDate}&type=all`, {
            headers: { 'Authorization': req.headers.authorization }
        })

        // For simplicity, generate CSV here directly
        const { data: attendanceData } = await supabaseAdmin
            .from('attendance')
            .select(`
                *,
                users:users!attendance_user_id_fkey(first_name, last_name, job_title, employment_type, pay_rate),
                external_locums(name, role, daily_rate),
                clinic_locations(name)
            `)
            .eq('clinic_id', clinicId)
            .gte('date', startDate)
            .lte('date', endDate)

        // Build CSV
        const headers = ['Name', 'Type', 'Role', 'Location', 'Period', 'Units Worked', 'Rate', 'Gross Pay', 'Payment Status']
        const rows = [headers.join(',')]

        // Group and calculate (simplified)
        const grouped = {}
        for (const record of attendanceData || []) {
            const isLocum = !!record.external_locum_id
            const key = isLocum ? `locum_${record.external_locum_id}` : `user_${record.user_id}`

            if (!grouped[key]) {
                grouped[key] = {
                    name: isLocum ? record.external_locums?.name : `${record.users?.first_name} ${record.users?.last_name}`,
                    type: isLocum ? 'External Locum' : 'Staff',
                    role: isLocum ? record.external_locums?.role : record.users?.job_title,
                    location: record.clinic_locations?.name,
                    rate: isLocum ? record.external_locums?.daily_rate : record.users?.pay_rate,
                    employmentType: isLocum ? 'daily' : record.users?.employment_type,
                    units: 0
                }
            }

            // Add units
            if (record.status === 'present_full' || record.locum_status === 'WORKED') {
                grouped[key].units += 1.0
            } else if (record.status === 'present_partial') {
                grouped[key].units += 0.5
            }
        }

        for (const [key, data] of Object.entries(grouped)) {
            const grossPay = data.employmentType === 'salaried'
                ? (data.rate / 30) * data.units
                : data.units * data.rate

            rows.push([
                `"${data.name}"`,
                data.type,
                `"${data.role || ''}"`,
                `"${data.location || ''}"`,
                `${startDate} to ${endDate}`,
                data.units.toFixed(1),
                data.rate || 0,
                grossPay.toFixed(2),
                'UNPAID'
            ].join(','))
        }

        const csv = rows.join('\n')

        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', `attachment; filename="payroll_${startDate}_${endDate}.csv"`)
        res.send(csv)
    } catch (err) {
        console.error('Export payroll error:', err)
        res.status(500).json({ error: 'Failed to export payroll' })
    }
})

export default router
