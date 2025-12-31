import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware, requirePermission } from '../lib/auth.js'

const router = express.Router({ mergeParams: true })

// Helper: Merge Attendance and Leave
// Priority: Paid Leave > Attendance > Unpaid Leave > Absent.
const calculateEmployeeUnits = (attMap, leaveMap, dateRange) => {
    let worked = 0
    let paidLeave = 0
    let unpaidLeave = 0
    let absent = 0
    const breakdown = {}

    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]

        const leave = leaveMap[dateStr] // { units: 1.0/0.5, isPaid: true/false, type: 'Sick Leave' }
        const att = attMap[dateStr] // { units: 1.0/0.5, status }

        if (leave?.isPaid) {
            paidLeave += leave.units
            if (leave.type) {
                breakdown[leave.type] = (breakdown[leave.type] || 0) + leave.units
            }
            if (leave.units < 1.0 && att && att.units > 0) {
                worked += Math.min(att.units, 1.0 - leave.units)
            }
        } else if (leave && !leave.isPaid) {
            unpaidLeave += leave.units
            if (leave.type) {
                // Track unpaid leaves in breakdown too? Or maybe distinct?
                // For now, aggregate all. UI can separate if needed via settings.
                breakdown[leave.type] = (breakdown[leave.type] || 0) + leave.units
            }
            if (leave.units < 1.0 && att && att.units > 0) {
                worked += Math.min(att.units, 1.0 - leave.units)
            }
        } else if (att) {
            worked += att.units
        } else {
            if (att && att.status === 'absent') absent += 1.0
        }
    }
    return { worked, paidLeave, unpaidLeave, absent, breakdown }
}

// GET /:clinicId/payroll
// Retrieves or Creates a Draft Run, Syncs Data, Returns Items
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { clinicId } = req.params
        const { startDate, endDate, locationId } = req.query

        if (!startDate || !endDate) return res.status(400).json({ error: 'Dates required' })

        // Parse location filter
        // If locationId == 'all' or undefined, we treat as Global Run (location_id IS NULL)
        // If locationId is a UUID, we treat as Location Run
        const targetLocationId = (locationId && locationId !== 'all') ? locationId : null

        // 1. Fetch Existing Run
        let runQuery = supabaseAdmin
            .from('payroll_runs')
            .select('*')
            .eq('clinic_id', clinicId)
            .eq('start_date', startDate)
            .eq('end_date', endDate)
            .limit(1)

        if (targetLocationId) {
            runQuery = runQuery.eq('location_id', targetLocationId)
        } else {
            runQuery = runQuery.is('location_id', null)
        }

        const { data: runs } = await runQuery
        let run = runs?.[0]

        // 2. Fetch Data (Attendance, Leave, Staff)
        // We fetch ALL for clinic, then filter in memory for complex logic
        const { data: users } = await supabaseAdmin.from('users').select('*').eq('clinic_id', clinicId).eq('is_active', true)
        const { data: locums } = await supabaseAdmin.from('external_locums').select('*').eq('clinic_id', clinicId)

        const { data: attendance } = await supabaseAdmin
            .from('attendance')
            .select('*')
            .eq('clinic_id', clinicId)
            .gte('date', startDate)
            .lte('date', endDate)

        const { data: leaveTypes } = await supabaseAdmin.from('leave_types').select('*').eq('clinic_id', clinicId)
        const paidTypeMap = new Map((leaveTypes || []).map(t => [t.name, t.is_paid]))

        const { data: leaveRequests } = await supabaseAdmin
            .from('leave_requests')
            .select('*')
            .eq('clinic_id', clinicId)
            .eq('status', 'approved')
            .or(`start_date.lte.${endDate},end_date.gte.${startDate}`)

        // 3. Process Data Maps
        // attMap: userId -> date -> { units, status, locationId }
        const attMap = {}
        attendance?.forEach(r => {
            const uid = r.user_id || `locum_${r.external_locum_id}`
            if (!attMap[uid]) attMap[uid] = {}

            let u = 0
            const hours = parseFloat(r.total_hours) || 0
            if (r.status === 'present_full' || r.locum_status === 'WORKED') {
                u = hours >= 6 ? 1.0 : (hours >= 3 ? 0.5 : 0)
            } else if (r.status === 'present_partial') {
                u = 0.5
            }
            attMap[uid][r.date] = { units: u, status: r.status, locId: r.location_id }
        })

        // lveMap: userId -> date -> { units, isPaid }
        const lveMap = {}
        leaveRequests?.forEach(r => {
            if (!r.user_id) return
            const uid = r.user_id
            if (!lveMap[uid]) lveMap[uid] = {}
            const s = new Date(Math.max(new Date(r.start_date), new Date(startDate)))
            const e = new Date(Math.min(new Date(r.end_date), new Date(endDate)))
            const isPaid = paidTypeMap.has(r.leave_type) ? paidTypeMap.get(r.leave_type) : true
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                if (d > new Date(endDate)) break;
                lveMap[uid][d.toISOString().split('T')[0]] = { units: 1.0, isPaid, type: r.leave_type }
            }
        })

        // 4. Create Draft if Missing
        if (!run) {
            const { data: newRun, error: runErr } = await supabaseAdmin
                .from('payroll_runs')
                .insert({
                    clinic_id: clinicId,
                    location_id: targetLocationId,
                    start_date: startDate,
                    end_date: endDate,
                    status: 'draft'
                })
                .select()
                .single()
            if (runErr) throw runErr
            run = newRun
        }

        if (run.status === 'finalized') {
            const { data: items } = await supabaseAdmin.from('payroll_items').select('*').eq('payroll_run_id', run.id)
            return res.json({ run, items })
        }

        // 5. Sync Logic
        const { data: existingItems } = await supabaseAdmin.from('payroll_items').select('*').eq('payroll_run_id', run.id)
        const itemMap = new Map((existingItems || []).map(i => [i.user_id || `locum_${i.external_locum_id}`, i]))

        const upsertData = []
        const monthUnits = parseFloat(run.month_units) || 30

        // Filter Users based on Location Strategy
        // If Global Run (no location): Include All.
        // If Location Run:
        //    - Salaried: Include if user.location_id == run.location_id.
        //    - Daily: Include if WORKED at run.location_id.

        for (const u of users || []) {
            const uid = u.id
            const payMethod = u.pay_method || 'fixed'
            const isSalaried = payMethod === 'fixed' || payMethod === 'prorated'

            let shouldInclude = false
            let localAttMap = attMap[uid] || {}

            if (isSalaried) {
                // Check Base Location
                if (!targetLocationId) {
                    shouldInclude = true // Global run includes everyone
                } else {
                    // Include if assigned to this location
                    // Note: If user has no location_id, they default to Global?
                    // Or we include them if they have Attendance here?
                    // Strict Base Location match is safest for Salary.
                    if (u.location_id === targetLocationId) shouldInclude = true
                }
                // Determine Units: Salaried gets credit for ALL attendance (Global)
                // Unless we want to strictly pay only for local work?
                // Usually Salary is 1 check. So use GLOBAL attendance.
                // localAttMap is already global for user.
            } else {
                // Daily (User)
                // Filter Attendance by location if targetLocationId is set
                if (targetLocationId) {
                    // Filter map to only dates matching location
                    const filtered = {}
                    let hasLocalWork = false
                    Object.keys(localAttMap).forEach(k => {
                        if (localAttMap[k].locId === targetLocationId) {
                            filtered[k] = localAttMap[k]
                            hasLocalWork = true
                        }
                    })
                    localAttMap = filtered
                    if (hasLocalWork) shouldInclude = true
                } else {
                    // Global run includes all daily work
                    if (Object.keys(localAttMap).length > 0) shouldInclude = true
                }
            }

            if (!shouldInclude && !itemMap.has(uid)) continue

            const units = calculateEmployeeUnits(localAttMap, lveMap[uid] || {}, { start: startDate, end: endDate })

            const salary = parseFloat(u.pay_rate) || 0
            const paidUnits = units.worked + units.paidLeave

            let payableBase = 0
            if (payMethod === 'fixed') {
                payableBase = salary
            } else if (payMethod === 'prorated') {
                payableBase = monthUnits > 0 ? (salary * (paidUnits / monthUnits)) : 0
            } else {
                // Daily User
                // If Daily, rate is... ? pay_rate?
                // Assuming pay_rate is daily rate for daily staff
                // Gross = rate * paidUnits
                payableBase = salary * paidUnits
            }

            const existing = itemMap.get(uid)
            const allowances = existing?.allowances || []
            const allowTotal = allowances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
            const gross = Math.round(payableBase + allowTotal)

            const itemPayload = {
                payroll_run_id: run.id,
                user_id: uid,
                name: `${u.first_name} ${u.last_name}`,
                role: u.job_title,
                pay_method: payMethod,
                salary: salary,
                rate: payMethod === 'daily' ? salary : 0,
                worked_units: units.worked,
                paid_leave_units: units.paidLeave,
                unpaid_leave_units: units.unpaidLeave,
                absent_units: units.absent,
                period_units: monthUnits,
                payable_base: Math.round(payableBase),
                allowances_amount: allowTotal,
                gross_pay: gross,
                allowances: allowances,
                is_paid: existing?.is_paid || false,
                paid_at: existing?.paid_at,
                paid_by: existing?.paid_by,
                breakdown: units.breakdown || {}
            }
            if (existing?.id) itemPayload.id = existing.id
            upsertData.push(itemPayload)
        }

        // Process Locums (Daily)
        for (const L of locums || []) {
            const uid = `locum_${L.id}`
            let localAttMap = attMap[uid] || {}

            let shouldInclude = false
            if (targetLocationId) {
                if (L.location_id === targetLocationId) shouldInclude = true // If assigned? 
                // More importantly: worked here?
                const filtered = {}
                let hasLocalWork = false
                Object.keys(localAttMap).forEach(k => {
                    if (localAttMap[k].locId === targetLocationId) {
                        filtered[k] = localAttMap[k]
                        hasLocalWork = true
                    }
                })
                localAttMap = filtered
                if (hasLocalWork) shouldInclude = true
            } else {
                if (Object.keys(localAttMap).length > 0) shouldInclude = true
            }

            if (!shouldInclude && !itemMap.has(uid)) continue

            const units = calculateEmployeeUnits(localAttMap, {}, { start: startDate, end: endDate })

            const rate = parseFloat(L.daily_rate) || 0
            const grossBase = (rate * units.worked) // Locums usually just worked units? Or paid leave?
            // Assuming simplified locum: Work only. 

            const existing = itemMap.get(uid)
            const allowances = existing?.allowances || []
            const allowTotal = allowances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)

            const itemPayload = {
                payroll_run_id: run.id,
                external_locum_id: L.id,
                name: L.name,
                role: L.role,
                pay_method: 'daily',
                salary: 0,
                rate: rate,
                worked_units: units.worked,
                paid_leave_units: 0,
                unpaid_leave_units: 0,
                absent_units: 0,
                period_units: 0,
                payable_base: Math.round(grossBase),
                allowances_amount: allowTotal,
                gross_pay: Math.round(grossBase + allowTotal),
                allowances: allowances,
                breakdown: units.breakdown || {},
                is_paid: existing?.is_paid || false,
                paid_at: existing?.paid_at,
                paid_by: existing?.paid_by
            }
            if (existing?.id) itemPayload.id = existing.id
            upsertData.push(itemPayload)
        }

        if (upsertData.length > 0) {
            const { error: upsertErr } = await supabaseAdmin.from('payroll_items').upsert(upsertData)
            if (upsertErr) throw upsertErr
        }

        const { data: finalItems } = await supabaseAdmin.from('payroll_items').select('*').eq('payroll_run_id', run.id)
        res.json({ run, items: finalItems })

    } catch (err) {
        console.error('Payroll Error:', err)
        res.status(500).json({ error: err.message })
    }
})

// PATCH /runs/:runId
router.patch('/runs/:runId', authMiddleware, async (req, res) => {
    const { runId } = req.params
    const { month_units, marked_by_name } = req.body
    await supabaseAdmin.from('payroll_runs').update({ month_units, marked_by_name }).eq('id', runId)
    res.json({ success: true })
})

// PATCH /items/:itemId
router.patch('/items/:itemId', authMiddleware, async (req, res) => {
    const { itemId } = req.params
    const { allowances, is_paid, paid_by } = req.body

    const update = {}
    if (allowances !== undefined) {
        update.allowances = allowances
        const total = allowances.reduce((acc, a) => acc + (parseFloat(a.amount) || 0), 0)
        update.allowances_amount = total

        // Recalc gross
        const { data: item } = await supabaseAdmin.from('payroll_items').select('payable_base').eq('id', itemId).single()
        if (item) {
            update.gross_pay = Math.round((item.payable_base || 0) + total)
        }
    }

    if (is_paid !== undefined) {
        update.is_paid = is_paid
        update.paid_at = is_paid ? new Date() : null
        update.paid_by = is_paid ? (paid_by || 'Admin') : null
    }

    const { error } = await supabaseAdmin.from('payroll_items').update(update).eq('id', itemId)
    if (error) throw error

    res.json({ success: true })
})

// POST /runs/:runId/finalize
router.post('/runs/:runId/finalize', authMiddleware, async (req, res) => {
    const { runId } = req.params
    await supabaseAdmin.from('payroll_runs').update({
        status: 'finalized',
        finalized_at: new Date(),
        finalized_by: req.user.id
    }).eq('id', runId)
    res.json({ success: true })
})

export default router
