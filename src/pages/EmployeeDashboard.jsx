import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

import LeaveTypesManager from '../LeaveTypesManager'
const ROLE_PERMISSIONS = {
    'Staff': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile'],
    'Shift Manager': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'team_schedule', 'manage_schedule'],
    'HR Manager': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'staff_list', 'approve_leave', 'team_attendance'],
    'Payroll Officer': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'team_attendance', 'payroll'],
    'Owner': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'team_schedule', 'manage_schedule', 'staff_list', 'approve_leave', 'team_attendance', 'payroll', 'settings']
}

export default function EmployeeDashboard() {
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const [view, setView] = useState('my_schedule')
    const [loading, setLoading] = useState(true)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    // Employee data
    const [profile, setProfile] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        jobTitle: 'Staff',
        location: '',
        hireDate: '',
        clinicName: '',
        role: 'Staff', // Default role
        permission_role: null
    })

    // Schedule data
    const [schedules, setSchedules] = useState([])
    const [availableShifts, setAvailableShifts] = useState([])
    const [teamSchedules, setTeamSchedules] = useState([])

    // Attendance data
    const [attendance, setAttendance] = useState([])
    const [todayAttendance, setTodayAttendance] = useState(null)
    const [teamAttendance, setTeamAttendance] = useState([])

    // Leave data
    const [leaveRequests, setLeaveRequests] = useState([])
    const [pendingLeaveApprovals, setPendingLeaveApprovals] = useState([])
    const [leaveBalance, setLeaveBalance] = useState({ annual: 21, used: 0 })

    // Staff data (for managers)
    const [staffList, setStaffList] = useState([])
    const [locations, setLocations] = useState([])
    const [staffLocationFilter, setStaffLocationFilter] = useState('all')
    const [leaveLocationFilter, setLeaveLocationFilter] = useState('all')

    // Get user's role
    const userRole = profile.permission_role || profile.role || 'Staff'
    const permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS['Staff']
    const hasPermission = (perm) => permissions.includes(perm)
    const isManager = userRole !== 'Staff'

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        const token = localStorage.getItem('hure_token')
        const clinicId = localStorage.getItem('hure_clinic_id')

        try {
            // Fetch employee profile
            const profileRes = await fetch('/api/employee/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (profileRes.ok) {
                const data = await profileRes.json()
                if (data.profile) {
                    setProfile(data.profile)
                }
            }

            // Fetch personal schedules
            const schedRes = await fetch('/api/employee/schedule', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (schedRes.ok) {
                const data = await schedRes.json()
                setSchedules(data.scheduled || [])
                setAvailableShifts(data.available || [])
            }

            // Fetch personal attendance
            const attRes = await fetch('/api/employee/attendance', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (attRes.ok) {
                const data = await attRes.json()
                setAttendance(data.records || [])
                setTodayAttendance(data.today || null)
            }

            // Fetch leave
            const leaveRes = await fetch('/api/employee/leave', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (leaveRes.ok) {
                const data = await leaveRes.json()
                setLeaveRequests(data.requests || [])
                setLeaveBalance(data.balance || { annual: 21, used: 0 })
            }

            // Manager-specific data
            if (clinicId) {
                // Fetch staff list if manager
                const staffRes = await fetch(`/api/clinics/${clinicId}/staff`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (staffRes.ok) {
                    const data = await staffRes.json()
                    setStaffList(data.data || [])
                }

                // Fetch team schedules
                const teamSchedRes = await fetch(`/api/clinics/${clinicId}/schedule`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (teamSchedRes.ok) {
                    const data = await teamSchedRes.json()
                    setTeamSchedules(data.data || [])
                }

                // Fetch pending leave approvals
                console.log('📋 Fetching pending leave for clinic:', clinicId)
                const pendingRes = await fetch(`/api/clinics/${clinicId}/leave/pending`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                console.log('📋 Pending leave response status:', pendingRes.status)
                if (pendingRes.ok) {
                    const data = await pendingRes.json()
                    console.log('📋 Pending leave data:', data)
                    setPendingLeaveApprovals(data.requests || [])
                } else {
                    console.error('📋 Pending leave error:', err)
                }

                // Fetch locations for filters
                const locRes = await fetch(`/api/clinics/${clinicId}/locations`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (locRes.ok) {
                    const data = await locRes.json()
                    setLocations(data.locations || [])
                }
            }
        } catch (err) {
            console.error('Fetch error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const handleAcceptShift = async (blockId) => {
        const token = localStorage.getItem('hure_token')
        try {
            const res = await fetch(`/api/employee/schedule/${blockId}/accept`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            })
            if (res.ok) {
                alert('Shift accepted!')
                fetchData()
            } else {
                const err = await res.json()
                alert(err.error || 'Failed to accept shift')
            }
        } catch (err) {
            console.error('Accept shift error:', err)
            alert('Failed to accept shift')
        }
    }

    const handleClockIn = async () => {
        const token = localStorage.getItem('hure_token')
        try {
            const res = await fetch('/api/employee/attendance/clock-in', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            })
            if (res.ok) {
                alert('Clocked in!')
                fetchData()
            } else {
                const err = await res.json()
                alert(err.error || 'Failed to clock in')
            }
        } catch (err) {
            console.error('Clock in error:', err)
            alert('Failed to clock in')
        }
    }

    const handleClockOut = async () => {
        const token = localStorage.getItem('hure_token')
        try {
            const res = await fetch('/api/employee/attendance/clock-out', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            })
            if (res.ok) {
                alert('Clocked out!')
                fetchData()
            } else {
                const err = await res.json()
                alert(err.error || 'Failed to clock out')
            }
        } catch (err) {
            console.error('Clock out error:', err)
            alert('Failed to clock out')
        }
    }

    // Format helpers
    const formatDate = (dateStr) => {
        if (!dateStr) return '-'
        const d = new Date(dateStr)
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear()
        return `${day}/${month}/${year}`
    }

    const formatTime = (timeStr) => {
        if (!timeStr) return '-'
        // Handle full ISO dates if passed, otherwise assume HH:mm:ss
        if (timeStr.includes('T')) {
            return new Date(timeStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        }
        return timeStr.slice(0, 5)
    }

    // ============================================
    // COMPONENTS
    // ============================================

    const Card = ({ title, children, right, className = '' }) => (
        <div className={`bg-white rounded-xl border border-slate-200 ${className}`}>
            {title && (
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800">{title}</h3>
                    {right}
                </div>
            )}
            <div className="p-4">{children}</div>
        </div>
    )

    const NavBtn = ({ icon, label, active, onClick, locked, badge }) => (
        <button
            onClick={locked ? undefined : onClick}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition ${locked
                ? 'text-slate-500 cursor-not-allowed opacity-50'
                : active
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
        >
            <span>{icon}</span>
            <span>{label}</span>
            {locked && <span className="ml-auto text-xs">🔒</span>}
            {badge > 0 && !locked && (
                <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-amber-500 text-white">{badge}</span>
            )}
        </button>
    )

    const StatusBadge = ({ status }) => {
        const styles = {
            present_full: 'bg-green-100 text-green-700',
            present_partial: 'bg-amber-100 text-amber-700',
            absent: 'bg-red-100 text-red-700',
            late: 'bg-orange-100 text-orange-700',
            scheduled: 'bg-blue-100 text-blue-700',
            pending: 'bg-amber-100 text-amber-700',
            approved: 'bg-green-100 text-green-700',
            rejected: 'bg-red-100 text-red-700',
            active: 'bg-green-100 text-green-700'
        }
        const labels = {
            present_full: 'Present (Full)',
            present_partial: 'Half Day',
            absent: 'Absent',
            late: 'Late',
            scheduled: 'Scheduled',
            pending: 'Pending',
            approved: 'Approved',
            rejected: 'Rejected',
            active: 'Active'
        }
        return (
            <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
                {labels[status] || status}
            </span>
        )
    }

    const LockedView = ({ feature }) => (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">Access Restricted</h2>
            <p className="text-slate-500 max-w-md">
                You don't have permission to access {feature}. Contact your manager if you need access.
            </p>
        </div>
    )

    // ============================================
    // MY SCHEDULE VIEW (Personal)
    // ============================================

    const MyScheduleView = () => (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">My Schedule</h1>

            <Card title="Scheduled Shifts">
                {schedules.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <div className="text-4xl mb-2">📅</div>
                        No upcoming scheduled shifts.
                    </div>
                ) : (
                    <div className="divide-y">
                        {schedules.map((shift, i) => (
                            <div key={i} className="py-3 flex items-center justify-between">
                                <div>
                                    <div className="font-medium">{formatDate(shift.date)}</div>
                                    <div className="text-sm text-slate-500">
                                        {shift.start_time} – {shift.end_time}
                                    </div>
                                    <div className="text-xs text-slate-400">Location: {shift.location || 'Main Location'}</div>
                                </div>
                                <StatusBadge status="scheduled" />
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card title="Available Shifts">
                {availableShifts.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        No available shifts to pick up.
                    </div>
                ) : (
                    <div className="divide-y">
                        {availableShifts.map((shift, i) => (
                            <div key={i} className="py-3 flex items-center justify-between">
                                <div>
                                    <div className="font-medium">{formatDate(shift.date)}</div>
                                    <div className="text-sm text-slate-500">
                                        {shift.start_time} – {shift.end_time}
                                    </div>
                                    <div className="text-xs text-slate-400">{shift.role_required}</div>
                                </div>
                                <button
                                    onClick={() => handleAcceptShift(shift.id)}
                                    className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg"
                                >
                                    Accept Shift
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    )

    // ============================================
    // TEAM SCHEDULE VIEW (Manager - Synced with Employer)
    // ============================================

    const TeamScheduleView = () => {
        // Local state for schedule management
        const [schedules, setSchedules] = useState([])
        const [scheduleLoading, setScheduleLoading] = useState(true)
        const [showAddShift, setShowAddShift] = useState(false)
        const [showManageCoverage, setShowManageCoverage] = useState(false)
        const [selectedShift, setSelectedShift] = useState(null)
        const [newShift, setNewShift] = useState({
            locationId: '',
            date: '',
            startTime: '09:00',
            endTime: '17:00',
            roleRequired: '',
            headcountRequired: 1
        })
        const [scheduleLocationFilter, setScheduleLocationFilter] = useState('')

        // Coverage management state
        const [coverageTab, setCoverageTab] = useState('staff')
        const [staffSearch, setStaffSearch] = useState('')
        const [locums, setLocums] = useState([])
        const [locumForm, setLocumForm] = useState({ name: '', phone: '', dailyRate: '', supervisorId: '', notes: '' })
        const [addingLocum, setAddingLocum] = useState(false)

        useEffect(() => {
            fetchSchedules()
        }, [scheduleLocationFilter])

        // When showing add shift, default to first location
        useEffect(() => {
            if (showAddShift && locations.length > 0 && !newShift.locationId) {
                setNewShift(prev => ({ ...prev, locationId: locations[0].id }))
            }
        }, [showAddShift, locations])

        const fetchSchedules = async () => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')
            setScheduleLoading(true)
            try {
                const locQuery = scheduleLocationFilter && scheduleLocationFilter !== 'all' ? `?locationId=${scheduleLocationFilter}` : ''
                const res = await fetch(`/api/clinics/${clinicId}/schedule${locQuery}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    const shiftsWithLocums = data.data || []

                    // Fetch locum counts for each shift
                    for (const shift of shiftsWithLocums) {
                        try {
                            const locumRes = await fetch(`/api/clinics/${clinicId}/schedule/${shift.id}/locums`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            })
                            if (locumRes.ok) {
                                const locumData = await locumRes.json()
                                shift.locum_count = (locumData.data || []).length
                            }
                        } catch (e) {
                            shift.locum_count = 0
                        }
                    }

                    setSchedules(shiftsWithLocums)
                }
            } catch (err) {
                console.error('Fetch schedules error:', err)
            } finally {
                setScheduleLoading(false)
            }
        }

        const handleCreateShift = async (e) => {
            e.preventDefault()
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(newShift)
                })
                if (res.ok) {
                    setShowAddShift(false)
                    setNewShift({ locationId: '', date: '', startTime: '09:00', endTime: '17:00', roleRequired: '', headcountRequired: 1 })
                    fetchSchedules()
                    alert('Shift created successfully')
                } else {
                    const err = await res.json()
                    alert(err.error || 'Failed to create shift')
                }
            } catch (err) {
                console.error('Create shift error:', err)
                alert('Failed to create shift')
            }
        }

        const handleManageCoverage = async (shift) => {
            setSelectedShift(shift)
            setShowManageCoverage(true)
            setCoverageTab('staff')
            setLocumForm({ name: '', phone: '', dailyRate: '', supervisorId: '', notes: '' })
            setLocums([])

            // Fetch existing locums for this shift
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${shift.id}/locums`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    setLocums(data.data || [])
                }
            } catch (err) {
                console.error('Fetch locums error:', err)
            }
        }

        const handleAddLocum = async () => {
            if (!locumForm.name.trim()) {
                alert('Locum name is required')
                return
            }
            setAddingLocum(true)
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${selectedShift.id}/locums`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: locumForm.name,
                        phone: locumForm.phone,
                        supervisorId: locumForm.supervisorId || null,
                        notes: locumForm.notes,
                        role: selectedShift.role_required,
                        dailyRate: parseFloat(locumForm.dailyRate) || 0
                    })
                })
                if (res.ok) {
                    const data = await res.json()
                    setLocums([data.data, ...locums])
                    setLocumForm({ name: '', phone: '', dailyRate: '', supervisorId: '', notes: '' })

                    // Update schedules list count
                    setSchedules(prev => prev.map(s =>
                        s.id === selectedShift.id
                            ? { ...s, locum_count: (s.locum_count || 0) + 1 }
                            : s
                    ))
                } else {
                    alert('Failed to add locum')
                }
            } catch (err) {
                console.error('Add locum error:', err)
            } finally {
                setAddingLocum(false)
            }
        }

        const handleRemoveLocum = async (locumId) => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${selectedShift.id}/locums/${locumId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    setLocums(locums.filter(l => l.id !== locumId))

                    // Update schedules list count
                    setSchedules(prev => prev.map(s =>
                        s.id === selectedShift.id
                            ? { ...s, locum_count: Math.max(0, (s.locum_count || 0) - 1) }
                            : s
                    ))
                }
            } catch (err) {
                console.error('Remove locum error:', err)
            }
        }

        const handleClearLocums = async () => {
            if (!confirm('Remove all external locums from this shift?')) return
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${selectedShift.id}/locums`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    const removedCount = locums.length
                    setLocums([])
                    setSchedules(prev => prev.map(s =>
                        s.id === selectedShift.id
                            ? { ...s, locum_count: Math.max(0, (s.locum_count || 0) - removedCount) }
                            : s
                    ))
                }
            } catch (err) {
                console.error('Clear locums error:', err)
            }
        }

        const handleDeleteShift = async (shiftId) => {
            if (!confirm('Are you sure you want to delete this shift? This cannot be undone.')) {
                return
            }
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${shiftId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    fetchSchedules()
                } else {
                    alert('Failed to delete shift')
                }
            } catch (err) {
                console.error('Delete shift error:', err)
            }
        }

        const handleAssignStaff = async (staffId) => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${selectedShift.id}/assign`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ userId: staffId })
                })
                const responseData = await res.json()
                if (res.ok) {
                    const newAssignment = responseData.data
                    const updatedShift = {
                        ...selectedShift,
                        schedule_assignments: [...(selectedShift.schedule_assignments || []), newAssignment]
                    }
                    setSelectedShift(updatedShift)
                    setSchedules(prev => prev.map(s =>
                        s.id === selectedShift.id
                            ? { ...s, schedule_assignments: [...(s.schedule_assignments || []), newAssignment] }
                            : s
                    ))
                } else {
                    alert(responseData.error || 'Failed to assign staff')
                }
            } catch (err) {
                console.error('Assign staff error:', err)
                alert('Failed to assign staff')
            }
        }

        const handleUnassignStaff = async (assignmentId) => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/assignments/${assignmentId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    const updatedShift = {
                        ...selectedShift,
                        schedule_assignments: (selectedShift.schedule_assignments || []).filter(a => a.id !== assignmentId)
                    }
                    setSelectedShift(updatedShift)
                    setSchedules(prev => prev.map(s =>
                        s.id === selectedShift.id
                            ? { ...s, schedule_assignments: (s.schedule_assignments || []).filter(a => a.id !== assignmentId) }
                            : s
                    ))
                }
            } catch (err) {
                console.error('Unassign staff error:', err)
            }
        }

        const canManageSchedule = hasPermission('manage_schedule')

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Team Schedule</h1>
                        <p className="text-slate-500 text-sm">Manage shifts and coverage</p>
                    </div>
                    {canManageSchedule && (
                        <button
                            onClick={() => setShowAddShift(true)}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
                        >
                            + Create Shift
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="w-full md:w-64">
                    <select
                        value={scheduleLocationFilter}
                        onChange={(e) => setScheduleLocationFilter(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white"
                    >
                        <option value="">All Locations</option>
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                    </select>
                </div>

                {/* Add Shift Modal */}
                {showAddShift && (
                    <Card title="Create New Shift">
                        <form onSubmit={handleCreateShift} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Location *</label>
                                    <select
                                        value={newShift.locationId}
                                        onChange={(e) => setNewShift({ ...newShift, locationId: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    >
                                        <option value="">Select location...</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newShift.date ? new Date(newShift.date).toLocaleDateString('en-GB') : ''}
                                            placeholder="dd/mm/yyyy"
                                            onClick={(e) => e.target.nextElementSibling.showPicker()}
                                            readOnly
                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 cursor-pointer"
                                            required
                                        />
                                        <input
                                            type="date"
                                            onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
                                            className="absolute inset-0 opacity-0 cursor-pointer -z-10"
                                            tabIndex={-1}
                                            required={!newShift.date}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">📅</div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Time *</label>
                                    <input
                                        type="time"
                                        value={newShift.startTime}
                                        onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">End Time *</label>
                                    <input
                                        type="time"
                                        value={newShift.endTime}
                                        onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Role Required</label>
                                    <input
                                        type="text"
                                        value={newShift.roleRequired}
                                        onChange={(e) => setNewShift({ ...newShift, roleRequired: e.target.value })}
                                        placeholder="e.g. Nurse, Doctor"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Staff Needed</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={newShift.headcountRequired}
                                        onChange={(e) => setNewShift({ ...newShift, headcountRequired: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg">Create Shift</button>
                                <button type="button" onClick={() => setShowAddShift(false)} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">Cancel</button>
                            </div>
                        </form>
                    </Card>
                )}

                {/* Schedule List */}
                <Card title="Upcoming Shifts">
                    {scheduleLoading ? (
                        <div className="text-center py-8">Loading...</div>
                    ) : schedules.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="text-4xl mb-4">📅</div>
                            <div>No shifts scheduled {scheduleLocationFilter ? 'for this location' : ''}.</div>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {schedules.map(shift => {
                                const expired = new Date(`${shift.date}T${shift.start_time}`) < new Date()
                                return (
                                    <div key={shift.id} className={`py-4 flex items-center justify-between ${expired ? 'opacity-60' : ''}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${expired ? 'bg-slate-200' : 'bg-primary-100'}`}>
                                                <span className={`font-bold ${expired ? 'text-slate-500' : 'text-primary-600'}`}>{formatDate(shift.date).slice(0, 3)}</span>
                                            </div>
                                            <div>
                                                <div className="font-medium flex items-center gap-2">
                                                    {formatDate(shift.date)}
                                                    {expired && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded">Expired</span>}
                                                </div>
                                                <div className="text-sm text-slate-500">
                                                    {formatTime(shift.start_time)} - {formatTime(shift.end_time)} · {shift.clinic_locations?.name}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-sm text-slate-600">{shift.role_required || 'Any role'}</div>
                                                <div className="text-xs text-slate-400">{(shift.schedule_assignments?.length || 0) + (shift.locum_count || 0)} / {shift.headcount_required} assigned</div>
                                            </div>
                                            {canManageSchedule && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleManageCoverage(shift)}
                                                        className={`px-3 py-1.5 text-sm rounded-lg ${expired ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 text-white'}`}
                                                    >
                                                        Manage
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteShift(shift.id)}
                                                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 border border-red-300 rounded-lg"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </Card>

                {/* Manage Coverage Modal */}
                {showManageCoverage && selectedShift && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden">
                            <div className="p-4 border-b flex items-center justify-between">
                                <h2 className="text-lg font-bold">Manage coverage</h2>
                                <button onClick={() => { setShowManageCoverage(false); setSelectedShift(null) }} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
                            </div>

                            <div className="p-4 bg-slate-50 border-b">
                                <div className="font-medium">{formatDate(selectedShift.date)} · {formatTime(selectedShift.start_time)} - {formatTime(selectedShift.end_time)} · {selectedShift.role_required || 'Any Role'}</div>
                                <div className="text-sm text-slate-500">Location: {selectedShift.clinic_locations?.name}</div>
                                <div className="text-sm text-slate-500">Required: {selectedShift.headcount_required} · Assigned: {(selectedShift.schedule_assignments?.length || 0) + locums.length}</div>
                            </div>

                            <div className="p-4 border-b">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-600">Showing:</span>
                                    <button onClick={() => setCoverageTab('staff')} className={`px-3 py-1.5 text-sm rounded-lg border ${coverageTab === 'staff' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>Monthly staff</button>
                                    <button onClick={() => setCoverageTab('locum')} className={`px-3 py-1.5 text-sm rounded-lg border ${coverageTab === 'locum' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>External locum</button>
                                </div>
                            </div>

                            <div className="p-4 overflow-y-auto max-h-[45vh]">
                                {coverageTab === 'staff' ? (
                                    <>
                                        {selectedShift.schedule_assignments?.length > 0 && (
                                            <div className="mb-4">
                                                <h3 className="text-sm font-medium text-slate-700 mb-2">Currently Assigned</h3>
                                                <div className="space-y-2">
                                                    {selectedShift.schedule_assignments.map(a => (
                                                        <div key={a.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                                                            <span className="font-medium text-green-800">{a.users?.first_name} {a.users?.last_name}</span>
                                                            <button onClick={() => handleUnassignStaff(a.id)} className="text-red-600 hover:text-red-700 text-sm">Remove</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div>
                                            <div className="mb-3">
                                                <h3 className="text-sm font-medium text-slate-700 mb-2">Available Staff</h3>
                                                <input
                                                    type="text"
                                                    value={staffSearch}
                                                    onChange={(e) => setStaffSearch(e.target.value)}
                                                    placeholder="Search by name or role..."
                                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                {staffList
                                                    .filter(s => s.role !== 'superadmin' && !s.email?.includes('@hure.app') && s.is_active !== false)
                                                    .filter(s => !selectedShift.schedule_assignments?.some(a => a.user_id === s.id))
                                                    .filter(s => {
                                                        if (!staffSearch) return true
                                                        const searchLower = staffSearch.toLowerCase()
                                                        return (
                                                            s.first_name?.toLowerCase().includes(searchLower) ||
                                                            s.last_name?.toLowerCase().includes(searchLower) ||
                                                            s.job_title?.toLowerCase().includes(searchLower) ||
                                                            s.role?.toLowerCase().includes(searchLower)
                                                        )
                                                    })
                                                    .map(staff => (
                                                        <div key={staff.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border">
                                                            <div>
                                                                <span className="font-medium">{staff.first_name} {staff.last_name}</span>
                                                                <span className="text-sm text-slate-500 ml-2">{staff.job_title}</span>
                                                            </div>
                                                            <button onClick={() => handleAssignStaff(staff.id)} className="px-3 py-1 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg">Assign</button>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="mb-4">
                                            <p className="text-sm text-slate-600 mb-2">Add locum / external cover <span className="text-slate-400">(payroll-ready)</span></p>
                                        </div>
                                        {locums.length > 0 ? (
                                            <div className="mb-4">
                                                <h3 className="text-sm font-medium text-slate-700 mb-2">Assigned Locums</h3>
                                                <div className="space-y-2">
                                                    {locums.map(l => (
                                                        <div key={l.id} className="flex items-center justify-between p-2 bg-teal-50 rounded-lg border border-teal-200">
                                                            <div>
                                                                <span className="font-medium text-teal-800">{l.name}</span>
                                                                <span className="ml-2 px-2 py-0.5 text-xs bg-teal-200 text-teal-800 rounded-full">External</span>
                                                            </div>
                                                            <button onClick={() => handleRemoveLocum(l.id)} className="text-red-600 hover:text-red-700 text-sm">Remove</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mb-4 p-3 bg-slate-100 rounded-lg text-sm text-slate-500 text-center">No locums added yet.</div>
                                        )}
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Locum Name *</label>
                                                <input type="text" value={locumForm.name} onChange={(e) => setLocumForm({ ...locumForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" placeholder="e.g. Jane Wanjiku" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                                                <input type="tel" value={locumForm.phone} onChange={(e) => setLocumForm({ ...locumForm, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" placeholder="+254..." />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Daily Rate (KSh) *</label>
                                                <input type="number" value={locumForm.dailyRate} onChange={(e) => setLocumForm({ ...locumForm, dailyRate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" required />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Supervisor</label>
                                                <select value={locumForm.supervisorId} onChange={(e) => setLocumForm({ ...locumForm, supervisorId: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300">
                                                    <option value="">— Select —</option>
                                                    {staffList.filter(s => s.role !== 'superadmin').map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                                                <input type="text" value={locumForm.notes} onChange={(e) => setLocumForm({ ...locumForm, notes: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" placeholder="Notes..." />
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <button onClick={() => setLocumForm({ name: '', phone: '', dailyRate: '', supervisorId: '', notes: '' })} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Clear</button>
                                                <button onClick={handleAddLocum} disabled={addingLocum || !locumForm.name.trim()} className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg disabled:opacity-50">{addingLocum ? 'Adding...' : 'Add locum'}</button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="p-4 border-t flex justify-between">
                                {coverageTab === 'locum' && locums.length > 0 && <button onClick={handleClearLocums} className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 border border-red-300 rounded-lg">Clear locums</button>}
                                <button onClick={() => { setShowManageCoverage(false); setSelectedShift(null) }} className={`px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg ${coverageTab !== 'locum' || locums.length === 0 ? 'w-full' : ''}`}>Close</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }




    // ============================================
    // STAFF LIST VIEW (HR Manager)
    // ============================================

    const StaffListView = () => {
        const [searchQuery, setSearchQuery] = useState('')
        const [statusFilter, setStatusFilter] = useState('active')

        const filteredStaff = staffList
            .filter(s => {
                // Location Filter
                if (staffLocationFilter !== 'all' && s.location_id !== staffLocationFilter) return false

                // Status Filter
                if (statusFilter === 'active' && !s.is_active) return false
                if (statusFilter === 'inactive' && s.is_active) return false

                // Search Filter
                if (searchQuery) {
                    const q = searchQuery.toLowerCase()
                    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
                    const email = (s.email || '').toLowerCase()
                    const title = (s.job_title || '').toLowerCase()
                    return fullName.includes(q) || email.includes(q) || title.includes(q)
                }

                return true
            })
            .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))

        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-xl font-bold">Staff Directory</h1>

                    <div className="flex flex-col sm:flex-row gap-2">
                        {/* Search */}
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                            <input
                                type="text"
                                placeholder="Search staff..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm w-full sm:w-64"
                            />
                        </div>

                        {/* Location Filter */}
                        <select
                            value={staffLocationFilter}
                            onChange={(e) => setStaffLocationFilter(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                            <option value="all">All Locations</option>
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active Only</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                <Card>
                    {filteredStaff.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            No staff members found matching your filters.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Name</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Job Title</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Email</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStaff.map((staff, i) => (
                                        <tr key={i} className="border-t hover:bg-slate-50">
                                            <td className="p-3">
                                                <div>
                                                    <span className="font-bold text-slate-900">
                                                        {staff.last_name}, {staff.first_name?.[0]}.
                                                    </span>
                                                    <div className="text-xs text-slate-500">
                                                        {staff.first_name} {staff.last_name}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-sm">
                                                <div className="text-slate-900">{staff.job_title || 'Staff'}</div>
                                                {/* Optional: Show system role subtly if different/needed, but user asked to hide/separate. 
                                                    We'll stick to job_title as requested. */}
                                            </td>
                                            <td className="p-3 text-sm text-slate-500">{staff.email}</td>
                                            <td className="p-3"><StatusBadge status={staff.is_active ? 'active' : 'inactive'} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>
        )
    }

    // ============================================
    // APPROVE LEAVE VIEW (HR Manager)
    // ============================================

    const ApproveLeaveView = () => {
        const [tab, setTab] = useState('requests') // requests | settings
        const [leaveRequests, setLeaveRequests] = useState([])
        const [leaveLoading, setLeaveLoading] = useState(true)
        const [statusFilter, setStatusFilter] = useState('')
        // Use the global location filter if available, or fallback to local. 
        // Since leaveLocationFilter is in parent scope, we use it directly.

        useEffect(() => {
            if (tab === 'requests') fetchLeaveRequests()
        }, [statusFilter, leaveLocationFilter, tab])

        const fetchLeaveRequests = async () => {
            setLeaveLoading(true)
            const clinicId = localStorage.getItem('hure_clinic_id')
            let url = `/api/clinics/${clinicId}/leave?`
            if (statusFilter) url += `status=${statusFilter}&`
            if (leaveLocationFilter && leaveLocationFilter !== 'all') url += `locationId=${leaveLocationFilter}&`

            try {
                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    setLeaveRequests(data.data || [])
                }
            } catch (err) {
                console.error('Fetch leave error:', err)
            } finally {
                setLeaveLoading(false)
            }
        }

        const handleUpdateLeave = async (leaveId, status) => {
            const clinicId = localStorage.getItem('hure_clinic_id')

            let rejectionReason = null
            if (status === 'rejected') {
                rejectionReason = prompt('Please provide a reason for rejection:')
                if (!rejectionReason) return // Cancelled
            }

            try {
                const res = await fetch(`/api/clinics/${clinicId}/leave/${leaveId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify({ status, rejectionReason })
                })
                if (res.ok) {
                    // Update local list
                    fetchLeaveRequests()
                    // Update global pending count if we just acted on a pending request
                    setPendingLeaveApprovals(prev => prev.filter(r => r.id !== leaveId))
                    alert(`Leave request ${status}`)
                } else {
                    const err = await res.json()
                    alert(err.error || `Failed to ${status} leave request`)
                }
            } catch (err) {
                console.error('Update leave error:', err)
                alert('Failed to update leave request')
            }
        }

        const formatDate = (dateStr) => {
            if (!dateStr) return '-'
            const d = new Date(dateStr)
            const day = String(d.getDate()).padStart(2, '0')
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const year = d.getFullYear()
            return `${day}/${month}/${year}`
        }

        const getStatusColor = (status) => {
            switch (status) {
                case 'approved': return 'bg-green-100 text-green-700'
                case 'rejected': return 'bg-red-100 text-red-700'
                default: return 'bg-amber-100 text-amber-700'
            }
        }

        const getLeaveTypeIcon = (type) => {
            switch (type) {
                case 'annual': return '🏖️'
                case 'sick': return '🏥'
                case 'personal': return '👤'
                case 'maternity': return '👶'
                default: return '📋'
            }
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Leave Management</h1>
                        <p className="text-slate-500 text-sm">Review requests and configure policies</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setTab('requests')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'requests' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border hover:bg-slate-50'}`}
                        >
                            Requests
                        </button>
                        <button
                            onClick={() => setTab('settings')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'settings' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border hover:bg-slate-50'}`}
                        >
                            Policies
                        </button>
                    </div>
                </div>

                {tab === 'settings' ? (
                    <LeaveTypesManager clinicId={localStorage.getItem('hure_clinic_id')} token={localStorage.getItem('hure_token')} />
                ) : (
                    <>
                        <div className="flex flex-col sm:flex-row gap-4 justify-between items-end">
                            {/* Filter Bar */}
                            <div className="flex gap-2 w-full sm:w-auto">
                                <select
                                    value={leaveLocationFilter}
                                    onChange={(e) => setLeaveLocationFilter(e.target.value)}
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white flex-1"
                                >
                                    <option value="all">All Locations</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white flex-1"
                                >
                                    <option value="">All Statuses</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                        </div>

                        {/* Stats Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-amber-600">{leaveRequests.filter(l => l.status === 'pending').length}</div>
                                    <div className="text-sm text-slate-500">Pending Review</div>
                                </div>
                            </Card>
                            <Card>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-green-600">{leaveRequests.filter(l => l.status === 'approved').length}</div>
                                    <div className="text-sm text-slate-500">Approved</div>
                                </div>
                            </Card>
                            <Card>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-red-600">{leaveRequests.filter(l => l.status === 'rejected').length}</div>
                                    <div className="text-sm text-slate-500">Rejected</div>
                                </div>
                            </Card>
                        </div>

                        <Card title={`Leave Requests (${leaveRequests.length})`}>
                            {leaveLoading ? (
                                <div className="text-center py-8">Loading...</div>
                            ) : leaveRequests.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <div className="text-4xl mb-4">🏖️</div>
                                    <div>No leave requests found matching filters.</div>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {leaveRequests.map(leave => {
                                        const isSelf = leave.user_id === profile?.id
                                        return (
                                            <div key={leave.id} className="py-4 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl">
                                                        {getLeaveTypeIcon(leave.leave_type)}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">
                                                            {leave.user?.first_name} {leave.user?.last_name}
                                                            {isSelf && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">You</span>}
                                                        </div>
                                                        <div className="text-sm text-slate-500">
                                                            <span className="capitalize">{leave.leave_type}</span> Leave · {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                                                            <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded-full text-xs text-slate-600">
                                                                {leave.units_requested ? `${leave.units_requested} units` : 'Legacy'}
                                                            </span>
                                                        </div>
                                                        {leave.reason && <div className="text-xs text-slate-500 mt-1 italic">"{leave.reason}"</div>}
                                                        {leave.rejection_notes && <div className="text-xs text-red-600 mt-1">Note: {leave.rejection_notes}</div>}
                                                        {leave.rejection_reason && <div className="text-xs text-red-600 mt-1">Reason: {leave.rejection_reason}</div>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {leave.status === 'pending' ? (
                                                        isSelf ? (
                                                            <div className="text-xs text-slate-400 italic bg-slate-50 px-2 py-1 rounded">
                                                                Cannot approve own request
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => handleUpdateLeave(leave.id, 'approved')}
                                                                    className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateLeave(leave.id, 'rejected')}
                                                                    className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </>
                                                        )
                                                    ) : (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className={`px-2 py-1 rounded text-xs px-3 ${getStatusColor(leave.status)}`}>
                                                                {leave.status}
                                                            </span>
                                                            {leave.reviewed_at && (
                                                                <div className="text-right mt-1">
                                                                    <div className="text-xs text-slate-500 font-medium">
                                                                        {new Date(leave.reviewed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </Card>
                    </>
                )}
            </div>
        )
    }

    // ============================================
    // MY ATTENDANCE VIEW
    // ============================================

    const MyAttendanceView = () => (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">My Attendance</h1>

            <Card title="Today">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-lg font-medium">{formatDate(new Date())}</div>
                        {todayAttendance ? (
                            <div className="text-sm text-slate-500">
                                Clock in: {formatTime(todayAttendance.clock_in)}
                                {todayAttendance.clock_out && ` – Clock out: ${formatTime(todayAttendance.clock_out)}`}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500">Not clocked in yet</div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {!todayAttendance?.clock_in && (
                            <button
                                onClick={handleClockIn}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                            >
                                Clock In
                            </button>
                        )}
                        {todayAttendance?.clock_in && !todayAttendance?.clock_out && (
                            <button
                                onClick={handleClockOut}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                            >
                                Clock Out
                            </button>
                        )}
                    </div>
                </div>
            </Card>

            <div className="flex items-center gap-4 text-sm text-slate-500">
                <span>Legend:</span>
                <StatusBadge status="present_full" />
                <StatusBadge status="present_partial" />
                <StatusBadge status="absent" />
            </div>

            <Card title="Attendance History">
                {attendance.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        No attendance records yet.
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Date</th>
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Clock In</th>
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Clock Out</th>
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Hours</th>
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendance.map((rec, i) => (
                                <tr key={i} className="border-t">
                                    <td className="p-3">{formatDate(rec.date)}</td>
                                    <td className="p-3">{formatTime(rec.clock_in)}</td>
                                    <td className="p-3">{formatTime(rec.clock_out)}</td>
                                    <td className="p-3">{rec.total_hours || '-'}</td>
                                    <td className="p-3"><StatusBadge status={rec.status} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    )

    // ============================================
    // MY LEAVE VIEW
    // ============================================

    const MyLeaveView = () => {
        const [showForm, setShowForm] = useState(false)
        const [leaveForm, setLeaveForm] = useState({
            type: 'annual',
            startDate: '',
            endDate: '',
            reason: ''
        })

        // On-the-fly calc
        const daysRequested = useMemo(() => {
            if (!leaveForm.startDate || !leaveForm.endDate) return 0
            const start = new Date(leaveForm.startDate)
            const end = new Date(leaveForm.endDate)
            if (end < start) return 0
            return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
        }, [leaveForm.startDate, leaveForm.endDate])

        const handleSubmit = async (e) => {
            e.preventDefault()
            const token = localStorage.getItem('hure_token')
            try {
                const res = await fetch('/api/employee/leave', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        leaveType: leaveForm.type,
                        startDate: leaveForm.startDate,
                        endDate: leaveForm.endDate,
                        reason: leaveForm.reason
                    })
                })
                if (res.ok) {
                    alert('Leave request submitted successfully!')
                    setShowForm(false)
                    setLeaveForm({ type: 'annual', startDate: '', endDate: '', reason: '' })
                    fetchData() // Refresh data to show new request
                } else {
                    const err = await res.json()
                    alert(err.error || 'Failed to submit leave request')
                }
            } catch (err) {
                console.error('Leave submit error:', err)
                alert('Failed to submit leave request')
            }
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">My Leave</h1>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm"
                    >
                        {showForm ? 'Cancel' : 'Request Leave'}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <div className="text-3xl font-bold text-primary-600">{leaveBalance.annual - leaveBalance.used}</div>
                        <div className="text-sm text-slate-500">Days Remaining</div>
                    </Card>
                    <Card>
                        <div className="text-3xl font-bold text-slate-600">{leaveBalance.used}</div>
                        <div className="text-sm text-slate-500">Days Used</div>
                    </Card>
                    <Card>
                        <div className="text-3xl font-bold text-slate-400">{leaveBalance.annual}</div>
                        <div className="text-sm text-slate-500">Total Entitlement</div>
                    </Card>
                </div>

                {showForm && (
                    <Card title="New Leave Request">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Leave Type</label>
                                <select
                                    value={leaveForm.type}
                                    onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                >
                                    <option value="annual">Annual Leave</option>
                                    <option value="sick">Sick Leave</option>
                                    <option value="personal">Personal Leave</option>
                                    <option value="maternity">Maternity Leave</option>
                                    <option value="unpaid">Unpaid Leave</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={leaveForm.startDate}
                                        onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={leaveForm.endDate}
                                        onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
                                </div>
                            </div>

                            {daysRequested > 0 && (
                                <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
                                    Requesting <strong>{daysRequested} unit{daysRequested !== 1 ? 's' : ''}</strong> (days)
                                </div>
                            )}

                            {daysRequested <= 0 && leaveForm.startDate && leaveForm.endDate && (
                                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                                    End date must be after start date.
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                                <textarea
                                    value={leaveForm.reason}
                                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    rows={3}
                                    required
                                />
                            </div>
                            <div className="flex justify-end pt-2">
                                <button type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </Card>
                )}

                <Card title="Leave History">
                    {leaveRequests.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">No leave requests found.</div>
                    ) : (
                        <div className="space-y-4">
                            {leaveRequests.map((req) => (
                                <div key={req.id} className="border-b last:border-0 pb-4 last:pb-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <span className="font-medium text-slate-800 capitalize">{req.leave_type} Leave</span>
                                            <span className="text-slate-500 text-sm ml-2">
                                                {formatDate(req.start_date)} - {formatDate(req.end_date)}
                                            </span>
                                        </div>
                                        <StatusBadge status={req.status} />
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-500 mt-1">
                                        <div>
                                            Units: <span className="font-medium text-slate-700">{req.units_requested || '-'}</span>
                                            {req.reason && <span className="mx-2 text-slate-300">|</span>}
                                            {req.reason && <span className="italic">"{req.reason}"</span>}
                                        </div>
                                        <div className="text-xs">
                                            {new Date(req.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    {req.status === 'rejected' && req.rejection_reason && (
                                        <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded border border-red-100">
                                            <strong>Rejection Reason:</strong> {req.rejection_reason}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        )
    }

    // ============================================
    // PROFILE VIEW
    // ============================================

    const SectionHeader = ({ title }) => (
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2 mt-2">{title}</h3>
    )

    const ReadOnlyField = ({ label, value }) => (
        <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
            <div className="text-sm text-slate-800 font-medium">{value || '-'}</div>
        </div>
    )

    const InputField = ({ label, value, onChange, type = 'text', required = false, options = [] }) => (
        <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{label} {required && '*'}</label>
            {options.length > 0 ? (
                <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">Select...</option>
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            ) : (
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    required={required}
                />
            )}
        </div>
    )

    const ProfileView = () => {
        const [isEditing, setIsEditing] = useState(false)
        const [formData, setFormData] = useState({})
        const [saving, setSaving] = useState(false)

        useEffect(() => {
            if (profile) {
                setFormData({
                    phone: profile.phone || '',
                    gender: profile.gender || '',
                    dob: profile.dob || '',
                    country: profile.address?.country || 'Kenya',
                    city: profile.address?.city || '',
                    area: profile.address?.area || '',
                    emergency_contact_name: profile.emergencyContact?.name || '',
                    emergency_contact_phone: profile.emergencyContact?.phone || '',
                    emergency_contact_relationship: profile.emergencyContact?.relationship || ''
                })
            }
        }, [profile, isEditing])

        const [documents, setDocuments] = useState([])
        const [showUploadModal, setShowUploadModal] = useState(false)
        const [uploadForm, setUploadForm] = useState({ type: 'license', title: '', file_url: '', expiry_date: '' })

        const fetchDocuments = async () => {
            if (!profile?.id) return
            try {
                const token = localStorage.getItem('hure_token')
                const res = await fetch(`/api/users/${profile.id}/documents`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    const { data } = await res.json()
                    setDocuments(data || [])
                }
            } catch (err) {
                console.error('Fetch docs error:', err)
            }
        }

        useEffect(() => {
            fetchDocuments()
        }, [profile?.id])

        const handleSave = async () => {
            setSaving(true)
            const token = localStorage.getItem('hure_token')
            try {
                const res = await fetch('/api/employee/profile', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(formData)
                })
                if (res.ok) {
                    alert('Profile updated successfully')
                    setIsEditing(false)
                    fetchData() // Refresh profile
                } else {
                    const err = await res.json()
                    alert(err.error || 'Failed to update profile')
                }
            } catch (err) {
                console.error('Update error:', err)
                alert('Error updating profile')
            } finally {
                setSaving(false)
            }
        }

        const handleUploadDocument = async (e) => {
            e.preventDefault()
            try {
                const token = localStorage.getItem('hure_token')
                const res = await fetch(`/api/users/${profile.id}/documents`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(uploadForm)
                })
                if (res.ok) {
                    alert('Document uploaded successfully')
                    setShowUploadModal(false)
                    setUploadForm({ type: 'license', title: '', file_url: '', expiry_date: '' })
                    fetchDocuments()
                } else {
                    const err = await res.json()
                    alert(err.error || 'Failed to upload document')
                }
            } catch (err) {
                console.error('Upload error:', err)
                alert('Failed to upload document')
            }
        }

        const handleDeleteDocument = async (docId) => {
            if (!confirm('Are you sure you want to delete this document?')) return
            try {
                const token = localStorage.getItem('hure_token')
                const res = await fetch(`/api/users/${profile.id}/documents/${docId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    fetchDocuments()
                }
            } catch (err) {
                console.error('Delete error:', err)
            }
        }

        // Components moved outside to prevent re-render focus issues

        return (
            <div className="space-y-6 pb-20">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">My Profile</h1>
                    {!isEditing ? (
                        <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700">
                            Edit Profile
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50" disabled={saving}>
                                Cancel
                            </button>
                            <button onClick={handleSave} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50" disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: ID Card & Status */}
                    <div className="space-y-6">
                        <Card className="text-center p-6">
                            <div className="w-24 h-24 rounded-full bg-primary-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                                {profile.firstName?.[0]}{profile.lastName?.[0]}
                            </div>
                            <h2 className="text-lg font-bold">{profile.firstName} {profile.lastName}</h2>
                            <div className="text-slate-500 mb-2">{profile.jobTitle || 'Staff'}</div>
                            {isManager && (
                                <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 text-xs rounded-full font-medium">
                                    {userRole}
                                </span>
                            )}
                            <div className="mt-6 border-t pt-4 text-left space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Employee ID</span>
                                    <span className="font-mono">{profile.id?.slice(0, 8) || '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Hire Date</span>
                                    <span>{formatDate(profile.hireDate)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Status</span>
                                    <span className="text-green-600 font-medium">Active</span>
                                </div>
                            </div>
                        </Card>

                        <Card title="Work Details">
                            <div className="space-y-4">
                                <ReadOnlyField label="Organization" value={profile.clinicName} />
                                <ReadOnlyField label="Primary Location" value={profile.location} />
                                <ReadOnlyField label="Department" value={profile.department || 'General'} />
                                <ReadOnlyField label="Employment Type" value={profile.employmentType || 'Full-time'} />
                            </div>
                        </Card>
                    </div>

                    {/* Right Column: Details Form */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <SectionHeader title="Personal Information" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <ReadOnlyField label="First Name" value={profile.firstName} />
                                <ReadOnlyField label="Last Name" value={profile.lastName} />
                                <ReadOnlyField label="Email Address" value={profile.email} />

                                {isEditing ? (
                                    <>
                                        <InputField label="Phone Number" value={formData.phone} onChange={v => setFormData({ ...formData, phone: v })} required />
                                        <InputField label="Gender" value={formData.gender} onChange={v => setFormData({ ...formData, gender: v })} options={['Male', 'Female', 'Other']} />
                                        <InputField label="Date of Birth" value={formData.dob} onChange={v => setFormData({ ...formData, dob: v })} type="date" />
                                    </>
                                ) : (
                                    <>
                                        <ReadOnlyField label="Phone Number" value={profile.phone} />
                                        <ReadOnlyField label="Gender" value={profile.gender} />
                                        <ReadOnlyField label="Date of Birth" value={formatDate(profile.dob)} />
                                    </>
                                )}
                            </div>

                            <SectionHeader title="Emergency Contact" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                {isEditing ? (
                                    <>
                                        <InputField label="Contact Name" value={formData.emergency_contact_name} onChange={v => setFormData({ ...formData, emergency_contact_name: v })} required />
                                        <InputField label="Relationship" value={formData.emergency_contact_relationship} onChange={v => setFormData({ ...formData, emergency_contact_relationship: v })} required />
                                        <InputField label="Phone Number" value={formData.emergency_contact_phone} onChange={v => setFormData({ ...formData, emergency_contact_phone: v })} required />
                                    </>
                                ) : (
                                    <>
                                        <ReadOnlyField label="Contact Name" value={profile.emergencyContact?.name} />
                                        <ReadOnlyField label="Relationship" value={profile.emergencyContact?.relationship} />
                                        <ReadOnlyField label="Phone Number" value={profile.emergencyContact?.phone} />
                                    </>
                                )}
                            </div>

                            <SectionHeader title="Address Info" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {isEditing ? (
                                    <>
                                        <InputField label="Country" value={formData.country} onChange={v => setFormData({ ...formData, country: v })} options={['Kenya', 'Uganda', 'Tanzania']} />
                                        <InputField label="Town / City" value={formData.city} onChange={v => setFormData({ ...formData, city: v })} required />
                                        <InputField label="Area / Estate" value={formData.area} onChange={v => setFormData({ ...formData, area: v })} />
                                    </>
                                ) : (
                                    <>
                                        <ReadOnlyField label="Country" value={profile.address?.country} />
                                        <ReadOnlyField label="Town / City" value={profile.address?.city} />
                                        <ReadOnlyField label="Area / Estate" value={profile.address?.area} />
                                    </>
                                )}
                            </div>
                        </Card>

                        <Card title="Compliance & Documents">
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded text-sm font-medium hover:bg-primary-100 flex items-center gap-2"
                                >
                                    <span>+ Upload Document</span>
                                </button>
                            </div>

                            {documents.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-slate-500 text-sm">No documents uploaded yet.</p>
                                    <p className="text-xs text-slate-400 mt-1">Licenses and identification documents will appear here.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {documents.map(doc => {
                                        const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date()
                                        const expiresSoon = doc.expiry_date && !isExpired && new Date(doc.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

                                        return (
                                            <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${doc.type === 'license' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            {doc.type === 'license' ? (
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                                            ) : (
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            )}
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <a href={doc.file_url} target="_blank" rel="noreferrer" className="font-medium text-slate-700 hover:underline hover:text-primary-600 text-sm block">
                                                            {doc.title || doc.type}
                                                        </a>
                                                        <div className="flex gap-2 text-xs text-slate-500">
                                                            <span className="capitalize">{doc.type.replace('_', ' ')}</span>
                                                            {doc.expiry_date && (
                                                                <span className={isExpired ? 'text-red-600 font-bold' : expiresSoon ? 'text-amber-600 font-bold' : ''}>
                                                                    • Expires: {new Date(doc.expiry_date).toLocaleDateString()} {isExpired && '(EXPIRED)'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteDocument(doc.id)}
                                                    className="p-1 text-slate-400 hover:text-red-500"
                                                    title="Delete"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </Card>
                    </div>

                    {showUploadModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                            <div className="bg-white rounded-xl max-w-md w-full p-6">
                                <h3 className="text-lg font-bold mb-4">Upload Document</h3>
                                <form onSubmit={handleUploadDocument} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Document Type</label>
                                        <select
                                            value={uploadForm.type}
                                            onChange={e => setUploadForm({ ...uploadForm, type: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg bg-white"
                                        >
                                            <option value="license">Professional License</option>
                                            <option value="certificate">Certificate</option>
                                            <option value="national_id">National ID</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                                        <input
                                            type="text"
                                            value={uploadForm.title}
                                            onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg"
                                            placeholder="e.g. Nursing Council License"
                                            required
                                        />
                                    </div>
                                    {(uploadForm.type === 'license' || uploadForm.type === 'certificate') && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                                            <input
                                                type="date"
                                                value={uploadForm.expiry_date}
                                                onChange={e => setUploadForm({ ...uploadForm, expiry_date: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Document URL (Link)</label>
                                        <input
                                            type="url"
                                            value={uploadForm.file_url}
                                            onChange={e => setUploadForm({ ...uploadForm, file_url: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg"
                                            placeholder="https://..."
                                            required
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Paste a link to your document (Drive, Dropbox, etc.)</p>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowUploadModal(false)}
                                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                        >
                                            Upload
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ============================================
    // PAYROLL VIEW (Payroll Officer)
    // ============================================

    const PayrollView = () => {
        const [activeTab, setActiveTab] = useState('salaried')
        const [dateRange, setDateRange] = useState({ start: '', end: '' })
        const [payrollData, setPayrollData] = useState([])
        const [loadingPayroll, setLoadingPayroll] = useState(false)
        const [updatingPayment, setUpdatingPayment] = useState({})

        // Fetch payroll data when date range changes
        useEffect(() => {
            const fetchPayroll = async () => {
                if (!dateRange.start || !dateRange.end) return
                const clinicId = localStorage.getItem('hure_clinic_id')
                setLoadingPayroll(true)
                try {
                    const res = await fetch(`/api/clinics/${clinicId}/payroll?startDate=${dateRange.start}&endDate=${dateRange.end}`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                    })
                    if (res.ok) {
                        const data = await res.json()
                        setPayrollData(data.data || [])
                    }
                } catch (err) {
                    console.error('Fetch payroll error:', err)
                } finally {
                    setLoadingPayroll(false)
                }
            }
            fetchPayroll()
        }, [dateRange.start, dateRange.end])

        // Filter payroll data by type
        const salariedPayroll = payrollData.filter(p => p.employmentType === 'salaried' || p.employmentType === 'full-time' || p.employmentType === 'part-time')
        const dailyPayroll = payrollData.filter(p => p.employmentType === 'casual' || p.employmentType === 'daily' || p.employmentType === 'contract' || p.type === 'locum')

        // Handle payment status toggle
        const handlePaymentToggle = async (record) => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            const newStatus = record.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID'
            setUpdatingPayment(prev => ({ ...prev, [record.id]: true }))
            try {
                const res = await fetch(`/api/clinics/${clinicId}/payroll/${record.id}/status`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify({
                        paymentStatus: newStatus,
                        userId: record.userId,
                        locumId: record.locumId,
                        periodStart: dateRange.start,
                        periodEnd: dateRange.end,
                        unitsWorked: record.unitsWorked,
                        rate: record.rate,
                        grossPay: record.grossPay,
                        payType: record.employmentType
                    })
                })
                if (res.ok) {
                    setPayrollData(prev => prev.map(p =>
                        p.id === record.id ? { ...p, paymentStatus: newStatus } : p
                    ))
                }
            } catch (err) {
                console.error('Update payment status error:', err)
            } finally {
                setUpdatingPayment(prev => ({ ...prev, [record.id]: false }))
            }
        }

        // Export payroll to CSV
        const exportPayrollCSV = () => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            window.open(`/api/clinics/${clinicId}/payroll/export?startDate=${dateRange.start}&endDate=${dateRange.end}`, '_blank')
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Payroll</h1>
                        <p className="text-slate-500 text-sm">Calculate and export payroll based on attendance</p>
                    </div>
                    <button
                        onClick={exportPayrollCSV}
                        disabled={!dateRange.start || !dateRange.end}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
                    >
                        Export Payroll
                    </button>
                </div>

                {/* Date Range Picker */}
                <Card>
                    <div className="flex items-center gap-4 flex-wrap">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Date Range</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                    className="px-3 py-2 border rounded-lg text-sm"
                                />
                                <span className="text-slate-400">→</span>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                    className="px-3 py-2 border rounded-lg text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const now = new Date()
                                    const start = new Date(now.getFullYear(), now.getMonth(), 1)
                                    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                                    setDateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] })
                                }}
                                className="px-3 py-2 border rounded-lg text-sm hover:bg-slate-50"
                            >
                                This Month
                            </button>
                            <button
                                onClick={() => {
                                    const now = new Date()
                                    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                                    const end = new Date(now.getFullYear(), now.getMonth(), 0)
                                    setDateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] })
                                }}
                                className="px-3 py-2 border rounded-lg text-sm hover:bg-slate-50"
                            >
                                Last Month
                            </button>
                        </div>
                    </div>
                </Card>

                {/* Info Panel */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                    <strong>ℹ️ How payroll is calculated:</strong> Payroll is derived from attendance records.
                    <div className="mt-2 text-xs">
                        • <strong>Salaried:</strong> (Salary ÷ Period Days) × Units Worked | • <strong>Daily/Casual:</strong> Units × Daily Rate
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b">
                    <button
                        onClick={() => setActiveTab('salaried')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'salaried' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500'}`}
                    >
                        Salaried Staff ({salariedPayroll.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('daily')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'daily' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500'}`}
                    >
                        Daily / Casual ({dailyPayroll.length})
                    </button>
                </div>

                {/* Salaried Staff Tab */}
                {activeTab === 'salaried' && (
                    <Card title="Salaried Staff">
                        <p className="text-sm text-slate-500 mb-4">
                            Gross Pay = (Monthly Salary ÷ Period Days) × Units Worked
                        </p>
                        {loadingPayroll ? (
                            <div className="text-center py-8">Loading...</div>
                        ) : salariedPayroll.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                {dateRange.start ? 'No salaried staff with attendance in this period.' : 'Select a date range to view payroll.'}
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Staff</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Role</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Units</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Rate</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Gross</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salariedPayroll.map(record => (
                                        <tr key={record.id} className="border-t">
                                            <td className="p-3 font-medium">{record.name}</td>
                                            <td className="p-3">{record.role || 'Staff'}</td>
                                            <td className="p-3">{record.unitsWorked?.toFixed(1) || 0}</td>
                                            <td className="p-3">KSh {(record.rate || 0).toLocaleString()}/mo</td>
                                            <td className="p-3 font-medium">KSh {(record.grossPay || 0).toLocaleString()}</td>
                                            <td className="p-3">
                                                <button
                                                    onClick={() => handlePaymentToggle(record)}
                                                    disabled={updatingPayment[record.id]}
                                                    className={`px-2 py-1 text-xs rounded ${record.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                                                >
                                                    {updatingPayment[record.id] ? '...' : (record.paymentStatus || 'UNPAID')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Card>
                )}

                {/* Daily/Casual Staff Tab (includes External Locums) */}
                {activeTab === 'daily' && (
                    <Card title="Daily / Casual Staff">
                        <p className="text-sm text-slate-500 mb-4">
                            Includes internal casual staff + external locums. Pay = Units × Daily Rate
                        </p>
                        {loadingPayroll ? (
                            <div className="text-center py-8">Loading...</div>
                        ) : dailyPayroll.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                {dateRange.start ? 'No daily/casual staff or locums with attendance in this period.' : 'Select a date range to view payroll.'}
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Name</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Type</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Units</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Daily Rate</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Gross</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailyPayroll.map(record => (
                                        <tr key={record.id} className="border-t">
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{record.name}</span>
                                                    {record.type === 'locum' && (
                                                        <span className="px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded-full">External</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3">{record.type === 'locum' ? 'Locum' : (record.role || 'Casual')}</td>
                                            <td className="p-3">{record.unitsWorked?.toFixed(1) || 0}</td>
                                            <td className="p-3">KSh {(record.rate || 0).toLocaleString()}</td>
                                            <td className="p-3 font-medium">KSh {(record.grossPay || 0).toLocaleString()}</td>
                                            <td className="p-3">
                                                <button
                                                    onClick={() => handlePaymentToggle(record)}
                                                    disabled={updatingPayment[record.id]}
                                                    className={`px-2 py-1 text-xs rounded ${record.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                                                >
                                                    {updatingPayment[record.id] ? '...' : (record.paymentStatus || 'UNPAID')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Card>
                )}
            </div>
        )
    }


    // ============================================
    // DOCUMENTS VIEW
    // ============================================

    const DocumentsView = () => {
        const [org, setOrg] = useState(null)
        const [settings, setSettings] = useState({ name: '', phone: '', contact_name: '' })
        const [orgForm, setOrgForm] = useState({
            kra_pin: '',
            business_reg_no: '',
            business_reg_doc: null,
            business_reg_expiry: '',
            facility_license_doc: null,
            facility_license_expiry: ''
        })
        const [uploading, setUploading] = useState(false)
        const [submitting, setSubmitting] = useState(false)
        const [selectedLocationId, setSelectedLocationId] = useState('')

        useEffect(() => {
            fetchClinicDetails()
        }, [])

        const fetchClinicDetails = async () => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/settings`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    const clinic = data.clinic || {}
                    setOrg({ ...clinic, locations: data.locations || [] })
                    setSettings({
                        name: clinic.name || '',
                        phone: clinic.phone || '',
                        contact_name: clinic.contact_name || ''
                    })
                    setOrgForm(prev => ({
                        ...prev,
                        kra_pin: clinic.kra_pin || '',
                        business_reg_no: clinic.business_reg_no || '',
                        business_reg_expiry: clinic.business_reg_expiry || '',
                        facility_license_expiry: clinic.facility_license_expiry || ''
                    }))
                }
            } catch (err) {
                console.error('Fetch settings error:', err)
            }
        }

        const handleSaveSettings = async () => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')
            setSubmitting(true)
            try {
                const res = await fetch(`/api/clinics/${clinicId}/settings`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(settings)
                })
                if (res.ok) {
                    alert('Settings updated successfully')
                } else {
                    alert('Failed to update settings')
                }
            } catch (err) {
                console.error('Save error:', err)
                alert('Error saving settings')
            } finally {
                setSubmitting(false)
            }
        }

        const handleDocumentUpload = async (e, documentType) => {
            const file = e.target.files[0]
            if (!file) return

            const validTypes = ['application/pdf', 'image/jpeg', 'image/png']
            if (!validTypes.includes(file.type)) {
                alert('Please upload a PDF, JPG, or PNG file')
                return
            }

            setUploading(true)
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')

            try {
                const formData = new FormData()
                formData.append('file', file)
                formData.append('documentType', documentType)

                if (documentType === 'facility_license') {
                    if (!selectedLocationId) {
                        alert('Please select a location first')
                        setUploading(false)
                        return
                    }
                    formData.append('locationId', selectedLocationId)
                    formData.append('expiryDate', orgForm.facility_license_expiry)
                } else {
                    formData.append('expiryDate', orgForm.business_reg_expiry)
                }

                const res = await fetch(`/api/clinics/${clinicId}/documents/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                })

                if (res.ok) {
                    const data = await res.json()

                    if (documentType === 'facility_license') {
                        // Update finding the location in array (handle both name variations just in case)
                        const locs = org.clinic_locations || org.locations || []
                        const newLocs = locs.map(loc => loc.id === data.location.id ? { ...loc, ...data.location } : loc)

                        setOrg(prev => ({
                            ...prev,
                            clinic_locations: prev.clinic_locations ? newLocs : undefined,
                            locations: prev.locations ? newLocs : undefined
                        }))
                        // Just alert, no need to set orgForm.facility_license_doc as it is per location now
                    } else {
                        setOrg(prev => ({ ...prev, ...data.clinic }))
                        setOrgForm(prev => ({ ...prev, business_reg_doc: file.name }))
                    }

                    alert('Document uploaded successfully!')
                } else {
                    const err = await res.json()
                    alert(err.error || 'Failed to upload document')
                }
            } catch (err) {
                console.error('Upload error:', err)
                alert('Failed to upload document')
            } finally {
                setUploading(false)
            }
        }

        const handleOrgSubmit = async (e) => {
            e.preventDefault()
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')
            setSubmitting(true)
            try {
                const res = await fetch(`/api/clinics/${clinicId}/verification`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(orgForm)
                })
                if (res.ok) {
                    fetchClinicDetails()
                    alert('Organization details updated!')
                }
            } catch (err) {
                console.error('Submit error:', err)
            } finally {
                setSubmitting(false)
            }
        }

        if (!org) return <div className="p-8 text-center bg-white rounded-xl">Loading documents...</div>

        return (
            <div className="space-y-6">
                <h1 className="text-xl font-bold">Manage Documents & Details</h1>

                {/* Basic Info */}
                <Card title="Organization Details">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Organization Name</label>
                            <input type="text" value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                            <input type="text" value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <button onClick={handleSaveSettings} disabled={submitting} className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                            {submitting ? 'Saving...' : 'Save Details'}
                        </button>
                    </div>
                </Card>

                {/* Document Uploads */}
                <div className="grid grid-cols-1 gap-6">
                    <Card title="Business Documents">
                        <form onSubmit={handleOrgSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">KRA PIN</label>
                                    <input type="text" value={orgForm.kra_pin} onChange={e => setOrgForm({ ...orgForm, kra_pin: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Reg. No</label>
                                    <input type="text" value={orgForm.business_reg_no} onChange={e => setOrgForm({ ...orgForm, business_reg_no: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                                </div>
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <h3 className="text-sm font-medium mb-2">Registration Document</h3>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs text-slate-500 mb-1">Document File</label>
                                        <input type="file" onChange={(e) => handleDocumentUpload(e, 'business_reg')} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
                                    </div>
                                    <div className="w-1/3">
                                        <label className="block text-xs text-slate-500 mb-1">Expiry Date</label>
                                        <input type="date" value={orgForm.business_reg_expiry} onChange={e => setOrgForm({ ...orgForm, business_reg_expiry: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                                    </div>
                                </div>
                                {org.business_reg_doc && (
                                    <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                                        ✓ Document uploaded
                                        <a href={org.business_reg_doc} target="_blank" rel="noreferrer" className="underline ml-2">View</a>
                                    </div>
                                )}
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <h3 className="text-sm font-medium mb-2">Facility License</h3>

                                <div className="mb-3">
                                    <label className="block text-xs text-slate-500 mb-1">Select Location</label>
                                    <select
                                        value={selectedLocationId}
                                        onChange={(e) => setSelectedLocationId(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg text-sm"
                                    >
                                        <option value="">Select a location...</option>
                                        {(org.clinic_locations || org.locations || []).map(loc => (
                                            <option key={loc.id} value={loc.id}>
                                                {loc.name} - {loc.city}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs text-slate-500 mb-1">License File</label>
                                        <input type="file" onChange={(e) => handleDocumentUpload(e, 'facility_license')} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
                                    </div>
                                    <div className="w-1/3">
                                        <label className="block text-xs text-slate-500 mb-1">Expiry Date</label>
                                        <input type="date" value={orgForm.facility_license_expiry} onChange={e => setOrgForm({ ...orgForm, facility_license_expiry: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                                    </div>
                                </div>
                                {(() => {
                                    const loc = (org.clinic_locations || org.locations || []).find(l => l.id === selectedLocationId)
                                    return loc && loc.license_document_url ? (
                                        <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                                            ✓ Document uploaded for {loc.name}
                                            <a href={loc.license_document_url} target="_blank" rel="noreferrer" className="underline ml-2">View</a>
                                        </div>
                                    ) : null
                                })()}
                            </div>

                            <div className="pt-4">
                                <button type="submit" disabled={submitting} className="w-full bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50">Update Registration Details</button>
                            </div>
                        </form>
                    </Card>
                </div>
            </div>
        )
    }

    // ============================================
    // MAIN RENDER
    // ============================================

    const HRManagerView = () => {
        const [stats, setStats] = useState({
            pendingLeave: 0,
            expiringLicenses: 0,
            complianceIssues: 0,
            onboardingPending: 0,
            attendanceExceptions: 0
        })
        const [loadingStats, setLoadingStats] = useState(true)

        useEffect(() => {
            const fetchStats = async () => {
                const clinicId = localStorage.getItem('hure_clinic_id')
                const token = localStorage.getItem('hure_token')
                try {
                    const res = await fetch(`/api/dashboard/${clinicId}/hr-stats`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                    if (res.ok) {
                        const data = await res.json()
                        setStats(data.stats)
                    }
                } catch (err) {
                    console.error('Fetch stats error:', err)
                } finally {
                    setLoadingStats(false)
                }
            }
            if (isManager) fetchStats()
        }, [])

        const StatCard = ({ title, count, icon, color, onClick, label }) => (
            <div
                onClick={onClick}
                className={`bg-white p-6 rounded-xl border border-slate-200 cursor-pointer hover:shadow-md transition border-l-4 ${color}`}
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">{title}</p>
                        <h3 className="text-3xl font-bold mt-2 text-slate-800">{loadingStats ? '-' : count}</h3>
                        <p className="text-xs text-slate-400 mt-1">{label}</p>
                    </div>
                    <div className="text-2xl opacity-80">{icon}</div>
                </div>
            </div>
        )

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-xl font-bold">HR Dashboard</h1>
                    <p className="text-slate-500 text-sm">Overview of your clinic's HR status</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard
                        title="Pending Leave"
                        count={stats.pendingLeave}
                        icon="🏖️"
                        color="border-l-blue-500"
                        label="Requests awaiting approval"
                        onClick={() => setView('approve_leave')}
                    />
                    <StatCard
                        title="Compliance Issues"
                        count={stats.complianceIssues}
                        icon="⚠️"
                        color="border-l-amber-500"
                        label="Missing phone or emergency contacts"
                        onClick={() => setView('staff_list')}
                    />
                    <StatCard
                        title="Expiring Licenses"
                        count={stats.expiringLicenses}
                        icon="📄"
                        color="border-l-red-500"
                        label="Facility licenses expiring < 30 days"
                        onClick={() => setView('documents')}
                    />
                    <StatCard
                        title="Onboarding"
                        count={stats.onboardingPending}
                        icon="👋"
                        color="border-l-green-500"
                        label="Invited but pending join"
                        onClick={() => setView('staff_list')}
                    />
                    <StatCard
                        title="Absent Today"
                        count={stats.attendanceExceptions}
                        icon="🚫"
                        color="border-l-slate-500"
                        label="Staff marked absent today"
                        onClick={() => setView('team_schedule')}
                    />
                </div>
            </div>
        )
    }

    // ============================================
    // MAIN RENDER
    // ============================================

    const renderView = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
            )
        }

        switch (view) {
            // Personal views
            case 'my_schedule': return <MyScheduleView />
            case 'my_attendance': return <MyAttendanceView />
            case 'my_leave': return <MyLeaveView />
            case 'my_profile': return <ProfileView />

            // Manager views (with permission check)
            case 'hr_dashboard':
                return hasPermission('view_reports') || userRole === 'HR Manager' ? <HRManagerView /> : <LockedView feature="HR Dashboard" />
            case 'team_schedule':
                return hasPermission('team_schedule') ? <TeamScheduleView /> : <LockedView feature="Team Schedule" />
            case 'manage_schedule':
                // Deprecated managed in team_schedule
                return <TeamScheduleView />
            case 'staff_list':
                return hasPermission('staff_list') ? <StaffListView /> : <LockedView feature="Staff Directory" />
            case 'approve_leave':
                return hasPermission('approve_leave') ? <ApproveLeaveView /> : <LockedView feature="Leave Approvals" />
            case 'payroll':
                return hasPermission('payroll') ? <PayrollView /> : <LockedView feature="Payroll" />
            case 'documents':
                // Check manage_verification or manage_settings or generic manager access? Use manage_verification as per fix.
                return hasPermission('manage_verification') || userRole === 'HR Manager' ? <DocumentsView /> : <LockedView feature="Documents" />

            default: return <MyScheduleView />
        }
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* TopBar */}
            <header className="fixed top-0 left-0 right-0 h-[53px] bg-slate-800 text-white flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-2">
                    {/* Mobile menu button */}
                    <button
                        className="md:hidden p-1"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        ☰
                    </button>
                    <span className="font-bold text-primary-400">HURE</span>
                    <span className="text-slate-400 hidden sm:inline">|</span>
                    <span className="text-slate-400 hidden sm:inline">{profile.clinicName || 'Employee Portal'}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm hidden sm:inline">
                        {profile.firstName || user?.username || 'Employee'}
                        {isManager && <span className="ml-1 text-primary-400">({userRole})</span>}
                    </span>
                    <button onClick={handleLogout} className="text-slate-400 hover:text-white text-sm">
                        Logout
                    </button>
                </div>
            </header>

            <div className="flex pt-[53px]">
                {/* Sidebar */}
                <aside className={`fixed w-64 h-full bg-slate-900 text-white p-4 pt-6 z-40 transition-transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                    } md:translate-x-0`}>
                    <div className="mb-6">
                        <div className="flex items-center gap-3 px-3 py-2">
                            <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center font-bold">
                                {profile.firstName?.[0] || 'E'}
                            </div>
                            <div>
                                <div className="font-medium">{profile.firstName} {profile.lastName}</div>
                                <div className="text-xs text-slate-400">{userRole}</div>
                            </div>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        {/* Personal Section */}
                        <div className="text-xs text-slate-500 uppercase tracking-wider px-3 py-2">My</div>
                        <NavBtn icon="📅" label="My Schedule" active={view === 'my_schedule'} onClick={() => { setView('my_schedule'); setMobileMenuOpen(false) }} />
                        <NavBtn icon="⏰" label="My Attendance" active={view === 'my_attendance'} onClick={() => { setView('my_attendance'); setMobileMenuOpen(false) }} />
                        <NavBtn icon="🏖️" label="My Leave" active={view === 'my_leave'} onClick={() => { setView('my_leave'); setMobileMenuOpen(false) }} />
                        <NavBtn icon="👤" label="My Profile" active={view === 'my_profile'} onClick={() => { setView('my_profile'); setMobileMenuOpen(false) }} />

                        {/* Manager Section */}
                        {isManager && (
                            <>
                                <div className="text-xs text-slate-500 uppercase tracking-wider px-3 py-2 mt-4">Manager</div>
                                <NavBtn
                                    icon="📊"
                                    label="Dashboard"
                                    active={view === 'hr_dashboard'}
                                    onClick={() => { setView('hr_dashboard'); setMobileMenuOpen(false) }}
                                    locked={!hasPermission('view_reports') && userRole !== 'HR Manager'}
                                />
                                <NavBtn
                                    icon="👥"
                                    label="Team Schedule"
                                    active={view === 'team_schedule'}
                                    onClick={() => { setView('team_schedule'); setMobileMenuOpen(false) }}
                                    locked={!hasPermission('team_schedule')}
                                />
                                <NavBtn
                                    icon="📋"
                                    label="Staff Directory"
                                    active={view === 'staff_list'}
                                    onClick={() => { setView('staff_list'); setMobileMenuOpen(false) }}
                                    locked={!hasPermission('staff_list')}
                                />
                                <NavBtn
                                    icon="✅"
                                    label="Leave Approvals"
                                    active={view === 'approve_leave'}
                                    onClick={() => { setView('approve_leave'); setMobileMenuOpen(false) }}
                                    locked={!hasPermission('approve_leave')}
                                    badge={pendingLeaveApprovals.length}
                                />
                                <NavBtn
                                    icon="💰"
                                    label="Payroll"
                                    active={view === 'payroll'}
                                    onClick={() => { setView('payroll'); setMobileMenuOpen(false) }}
                                    locked={!hasPermission('payroll')}
                                />
                                <NavBtn
                                    icon="📂"
                                    label="Documents"
                                    active={view === 'documents'}
                                    onClick={() => { setView('documents'); setMobileMenuOpen(false) }}
                                    locked={!hasPermission('manage_verification') && userRole !== 'HR Manager'}
                                />
                            </>
                        )}
                    </nav>
                </aside>

                {/* Mobile overlay */}
                {mobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-30 md:hidden"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                )}

                {/* Main */}
                <main className="flex-1 ml-0 md:ml-64 p-6">
                    {renderView()}
                </main>
            </div>
        </div>
    )
}
