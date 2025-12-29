import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

// Role-based permissions mapping
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
        clinicName: ''
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

    // Get user's role
    const userRole = profile.jobTitle || 'Staff'
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
                const teamSchedRes = await fetch(`/api/clinics/${clinicId}/schedules`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (teamSchedRes.ok) {
                    const data = await teamSchedRes.json()
                    setTeamSchedules(data.schedules || [])
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
                    const err = await pendingRes.text()
                    console.error('📋 Pending leave error:', err)
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
        return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
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
    // TEAM SCHEDULE VIEW (Manager)
    // ============================================

    const TeamScheduleView = () => {
        const [showManageCoverage, setShowManageCoverage] = useState(false)
        const [selectedShift, setSelectedShift] = useState(null)

        const handleDeleteShift = async (shiftId) => {
            if (!confirm('Are you sure you want to delete this shift?')) return
            const token = localStorage.getItem('hure_token')
            const clinicId = localStorage.getItem('hure_clinic_id')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedules/${shiftId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    // Update local state
                    setTeamSchedules(prev => prev.filter(s => s.id !== shiftId))
                    alert('Shift deleted successfully')
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
                // Determine if this is a pending request or direct assignment
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${selectedShift.id}/assign`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ userId: staffId })
                })
                if (res.ok) {
                    const { data: newAssignment } = await res.json()
                    // Update selected shift locally
                    setSelectedShift(prev => ({
                        ...prev,
                        schedule_assignments: [...(prev.schedule_assignments || []), newAssignment]
                    }))
                    // Update main list
                    fetchData()
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
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${selectedShift.id}/unassign/${assignmentId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    // Update selected shift locally
                    setSelectedShift(prev => ({
                        ...prev,
                        schedule_assignments: prev.schedule_assignments.filter(a => a.id !== assignmentId)
                    }))
                    // Update main list
                    fetchData()
                }
            } catch (err) {
                console.error('Unassign staff error:', err)
            }
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Team Schedule</h1>
                        <p className="text-slate-500 text-sm">Manage shifts and coverage</p>
                    </div>
                    {hasPermission('manage_schedule') && (
                        <button
                            onClick={() => setView('manage_schedule')}
                            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm"
                        >
                            + Create Shift
                        </button>
                    )}
                </div>

                <Card>
                    {teamSchedules.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            No team shifts scheduled.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {teamSchedules.map(shift => {
                                const assignedCount = shift.schedule_assignments?.length || 0
                                const progress = Math.min((assignedCount / shift.headcount_required) * 100, 100)
                                const isFullyStaffed = assignedCount >= shift.headcount_required

                                return (
                                    <div key={shift.id} className="p-4 rounded-xl border border-slate-200 hover:border-primary-200 transition bg-white block text-left">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-slate-800">{formatDate(shift.date)}</span>
                                            {hasPermission('manage_schedule') && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift.id) }}
                                                    className="text-slate-400 hover:text-red-500 px-1"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-sm text-slate-600 mb-3">
                                            {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                                        </div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                                {shift.clinic_locations?.name || 'Main'}
                                            </span>
                                            <span className="text-xs bg-blue-50 px-2 py-0.5 rounded text-blue-600">
                                                {shift.role_required || 'Any'}
                                            </span>
                                        </div>
                                        <div className="mt-3">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className={isFullyStaffed ? 'text-green-600' : 'text-slate-500'}>
                                                    {assignedCount} / {shift.headcount_required} Staff
                                                </span>
                                                <span className="text-slate-400">{Math.round(progress)}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                <div
                                                    className={`h-1.5 rounded-full ${isFullyStaffed ? 'bg-green-500' : 'bg-primary-500'}`}
                                                    style={{ width: `${progress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        {hasPermission('manage_schedule') && (
                                            <button
                                                onClick={() => { setSelectedShift(shift); setShowManageCoverage(true) }}
                                                className="mt-3 w-full py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg"
                                            >
                                                Manage Coverage
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </Card>

                {/* Manage Coverage Modal */}
                {showManageCoverage && selectedShift && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden">
                            <div className="p-4 border-b flex items-center justify-between">
                                <h2 className="text-lg font-bold">Manage coverage</h2>
                                <button
                                    onClick={() => { setShowManageCoverage(false); setSelectedShift(null) }}
                                    className="text-slate-400 hover:text-slate-600 text-2xl"
                                >×</button>
                            </div>
                            <div className="p-4 bg-slate-50 border-b">
                                <div className="font-medium">{formatDate(selectedShift.date)} · {formatTime(selectedShift.start_time)} - {formatTime(selectedShift.end_time)}</div>
                                <div className="text-sm text-slate-500">Location: {selectedShift.clinic_locations?.name} · Role: {selectedShift.role_required || 'Any'}</div>
                                <div className="text-sm text-slate-500">
                                    Required: {selectedShift.headcount_required} ·
                                    Assigned: {selectedShift.schedule_assignments?.filter(a => a.status === 'confirmed').length || 0} ·
                                    Pending: {selectedShift.schedule_assignments?.filter(a => a.status === 'pending').length || 0}
                                </div>
                            </div>
                            <div className="p-4 overflow-y-auto max-h-[50vh]">
                                {selectedShift.schedule_assignments?.length > 0 && (
                                    <div className="mb-4">
                                        <h3 className="text-sm font-medium text-slate-700 mb-2">Currently Assigned / Pending</h3>
                                        <div className="space-y-2">
                                            {selectedShift.schedule_assignments.map(a => (
                                                <div key={a.id} className={`flex items-center justify-between p-2 rounded-lg border ${a.status === 'pending' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
                                                    }`}>
                                                    <div className="flex flex-col">
                                                        <span className={`font-medium ${a.status === 'pending' ? 'text-amber-800' : 'text-green-800'}`}>
                                                            {a.users?.first_name} {a.users?.last_name}
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            {a.status === 'pending' ? '⏳ Pending Acceptance' : '✓ Confirmed'}
                                                        </span>
                                                    </div>
                                                    <button onClick={() => handleUnassignStaff(a.id)} className="text-red-600 hover:text-red-700 text-sm">Remove</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-sm font-medium text-slate-700 mb-2">Available Staff</h3>
                                    <div className="space-y-2">
                                        {staffList
                                            .filter(s => s.role !== 'superadmin' && !s.email?.includes('@hure.app'))
                                            .filter(s => !selectedShift.schedule_assignments?.some(a => a.user_id === s.id))
                                            .map(staff => (
                                                <div key={staff.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border">
                                                    <div>
                                                        <span className="font-medium">{staff.first_name} {staff.last_name}</span>
                                                        <span className="text-sm text-slate-500 ml-2">{staff.job_title}</span>
                                                    </div>
                                                    <button onClick={() => handleAssignStaff(staff.id)} className="px-3 py-1 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg">Assign</button>
                                                </div>
                                            ))}
                                        {staffList.filter(s => s.role !== 'superadmin' && !s.email?.includes('@hure.app')).length === 0 && (
                                            <div className="text-center text-sm text-slate-400 py-2">No available staff found</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t">
                                <button onClick={() => { setShowManageCoverage(false); setSelectedShift(null) }} className="w-full px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg">Close</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ============================================
    // MANAGE SCHEDULE VIEW (Create Shifts)
    // ============================================

    const ManageScheduleView = () => {
        const [creating, setCreating] = useState(false)
        const [locations, setLocations] = useState([])
        const [newShift, setNewShift] = useState({
            locationId: '',
            date: '',
            startTime: '09:00',
            endTime: '17:00',
            roleRequired: '',
            headcountRequired: 1
        })

        useEffect(() => {
            fetchLocations()
        }, [])

        const fetchLocations = async () => {
            const token = localStorage.getItem('hure_token')
            const clinicId = localStorage.getItem('hure_clinic_id')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/locations`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    setLocations(data.locations || [])
                    if (data.locations?.length > 0) {
                        setNewShift(prev => ({ ...prev, locationId: data.locations[0].id }))
                    }
                }
            } catch (err) {
                console.error('Fetch locations error:', err)
            }
        }

        const handleCreateShift = async (e) => {
            e.preventDefault()
            setCreating(true)
            const token = localStorage.getItem('hure_token')
            const clinicId = localStorage.getItem('hure_clinic_id')

            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedules`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        location_id: newShift.locationId,
                        date: newShift.date,
                        start_time: newShift.startTime,
                        end_time: newShift.endTime,
                        role_required: newShift.roleRequired,
                        headcount_required: parseInt(newShift.headcountRequired)
                    })
                })

                if (res.ok) {
                    alert('Shift created successfully!')
                    setNewShift({
                        locationId: locations[0]?.id || '',
                        date: '',
                        startTime: '09:00',
                        endTime: '17:00',
                        roleRequired: '',
                        headcountRequired: 1
                    })
                    // Refresh team schedules
                    fetchData()
                    setView('team_schedule')
                } else {
                    const err = await res.json()
                    alert(err.error || 'Failed to create shift')
                }
            } catch (err) {
                console.error('Create shift error:', err)
                alert('Failed to create shift')
            } finally {
                setCreating(false)
            }
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">Create New Shift</h1>
                    <button
                        onClick={() => setView('team_schedule')}
                        className="text-slate-500 hover:text-slate-700 text-sm"
                    >
                        ← Back to Team Schedule
                    </button>
                </div>

                <Card>
                    <form onSubmit={handleCreateShift} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                                <select
                                    value={newShift.locationId}
                                    onChange={(e) => setNewShift({ ...newShift, locationId: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    required
                                >
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={newShift.date}
                                    onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                                <input
                                    type="time"
                                    value={newShift.startTime}
                                    onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
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
                                    placeholder="e.g., Nurse, Doctor, Receptionist"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Headcount</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={newShift.headcountRequired}
                                    onChange={(e) => setNewShift({ ...newShift, headcountRequired: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="submit"
                                disabled={creating}
                                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50"
                            >
                                {creating ? 'Creating...' : 'Create Shift'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setView('team_schedule')}
                                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </Card>

                <div className="bg-blue-50 text-blue-700 p-4 rounded-lg text-sm">
                    <strong>Note:</strong> Shifts you create will be visible to the employer and all managers. Staff members can be assigned to these shifts through the Team Schedule view.
                </div>
            </div>
        )
    }

    // ============================================
    // STAFF LIST VIEW (HR Manager)
    // ============================================

    const StaffListView = () => (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Staff Directory</h1>

            <Card>
                {staffList.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        No staff members found.
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Name</th>
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Role</th>
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Email</th>
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffList.map((staff, i) => (
                                <tr key={i} className="border-t">
                                    <td className="p-3">
                                        <div className="font-medium">{staff.first_name} {staff.last_name}</div>
                                    </td>
                                    <td className="p-3">{staff.job_title || 'Staff'}</td>
                                    <td className="p-3 text-sm text-slate-500">{staff.email}</td>
                                    <td className="p-3"><StatusBadge status={staff.is_active ? 'active' : 'absent'} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    )

    // ============================================
    // APPROVE LEAVE VIEW (HR Manager)
    // ============================================

    const ApproveLeaveView = () => {
        const handleApproval = async (requestId, status) => {
            const token = localStorage.getItem('hure_token')
            const clinicId = localStorage.getItem('hure_clinic_id')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/leave/${requestId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ status })
                })
                if (res.ok) {
                    setPendingLeaveApprovals(prev => prev.filter(r => r.id !== requestId))
                    alert(`Leave request ${status}`)
                }
            } catch (err) {
                console.error('Approval error:', err)
            }
        }

        return (
            <div className="space-y-6">
                <h1 className="text-xl font-bold">Leave Approvals</h1>

                <Card title={`Pending Requests (${pendingLeaveApprovals.length})`}>
                    {pendingLeaveApprovals.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            <div className="text-4xl mb-2">✅</div>
                            No pending leave requests.
                        </div>
                    ) : (
                        <div className="divide-y">
                            {pendingLeaveApprovals.map((req, i) => (
                                <div key={i} className="py-4 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">{req.user_name || 'Staff Member'}</div>
                                        <div className="text-sm text-slate-500 capitalize">{req.leave_type} Leave</div>
                                        <div className="text-xs text-slate-400">
                                            {formatDate(req.start_date)} – {formatDate(req.end_date)}
                                        </div>
                                        {req.reason && <div className="text-xs text-slate-400 mt-1">"{req.reason}"</div>}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApproval(req.id, 'approved')}
                                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleApproval(req.id, 'rejected')}
                                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
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
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
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
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                                <textarea
                                    value={leaveForm.reason}
                                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    rows={3}
                                    placeholder="Briefly explain your leave request..."
                                />
                            </div>
                            <button type="submit" className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg">
                                Submit Request
                            </button>
                        </form>
                    </Card>
                )}

                <Card title="My Leave Requests">
                    {leaveRequests.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            No leave requests yet.
                        </div>
                    ) : (
                        <div className="divide-y">
                            {leaveRequests.map((req, i) => (
                                <div key={i} className="py-3 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium capitalize">{req.leave_type} Leave</div>
                                        <div className="text-sm text-slate-500">
                                            {formatDate(req.start_date)} – {formatDate(req.end_date)}
                                        </div>
                                    </div>
                                    <StatusBadge status={req.status} />
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

    const ProfileView = () => (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">My Profile</h1>

            <Card>
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold">
                        {profile.firstName?.[0]}{profile.lastName?.[0]}
                    </div>
                    <div>
                        <div className="text-xl font-semibold">{profile.firstName} {profile.lastName}</div>
                        <div className="text-slate-500">{profile.jobTitle || 'Staff'}</div>
                        {isManager && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                                {userRole}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Email</label>
                        <div className="text-slate-800">{profile.email || '-'}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Phone</label>
                        <div className="text-slate-800">{profile.phone || '-'}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Organization</label>
                        <div className="text-slate-800">{profile.clinicName || '-'}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Hire Date</label>
                        <div className="text-slate-800">{formatDate(profile.hireDate)}</div>
                    </div>
                </div>
            </Card>
        </div>
    )

    // ============================================
    // PAYROLL VIEW (Payroll Officer)
    // ============================================

    const PayrollView = () => {
        const [activeTab, setActiveTab] = useState('salaried')
        const [dateRange, setDateRange] = useState({ start: '', end: '' })
        const [allStaff, setAllStaff] = useState([])
        const [payrollStats, setPayrollStats] = useState({})
        const [loadingStats, setLoadingStats] = useState(false)

        // Fetch all staff on mount
        useEffect(() => {
            const fetchStaff = async () => {
                const clinicId = localStorage.getItem('hure_clinic_id')
                try {
                    const res = await fetch(`/api/clinics/${clinicId}/staff?includeOwner=true`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                    })
                    if (res.ok) {
                        const data = await res.json()
                        setAllStaff(data.data || [])
                    }
                } catch (err) {
                    console.error('Fetch staff error:', err)
                }
            }
            fetchStaff()
        }, [])

        // Fetch payroll stats when date range changes
        useEffect(() => {
            const fetchPayrollStats = async () => {
                if (!dateRange.start || !dateRange.end) return
                const clinicId = localStorage.getItem('hure_clinic_id')
                setLoadingStats(true)
                try {
                    const res = await fetch(`/api/clinics/${clinicId}/payroll-stats?startDate=${dateRange.start}&endDate=${dateRange.end}`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                    })
                    if (res.ok) {
                        const data = await res.json()
                        setPayrollStats(data.stats || {})
                    }
                } catch (err) {
                    console.error('Fetch payroll stats error:', err)
                } finally {
                    setLoadingStats(false)
                }
            }
            fetchPayrollStats()
        }, [dateRange.start, dateRange.end])

        // Filter staff by pay type
        const salariedStaff = allStaff.filter(s => !s.pay_type || s.pay_type === 'monthly')
        const dailyStaff = allStaff.filter(s => s.pay_type === 'daily' || s.pay_type === 'hourly')

        const getStats = (userId) => payrollStats[userId] || { full_days: 0, half_days: 0, absent_days: 0, total_hours: 0 }

        const calculateGross = (staff) => {
            const stats = getStats(staff.id)
            const rate = staff.pay_rate || 0
            return (stats.full_days * rate) + (stats.half_days * rate * 0.5)
        }

        // Export payroll to CSV
        const exportPayrollCSV = () => {
            const allStaffList = [...salariedStaff, ...dailyStaff]
            const headers = ['Staff Name', 'Role', 'Pay Type', 'Full Days', 'Half Days', 'Rate (KSh)', 'Gross (KSh)']
            const rows = allStaffList.map(s => {
                const stats = getStats(s.id)
                const isSalaried = !s.pay_type || s.pay_type === 'monthly'
                const gross = isSalaried ? (s.pay_rate || 0) : calculateGross(s)
                return [
                    `${s.first_name} ${s.last_name}`,
                    s.job_title || 'Staff',
                    s.pay_type || 'monthly',
                    stats.full_days,
                    stats.half_days,
                    s.pay_rate || 0,
                    gross
                ]
            })
            const csvContent = [
                `Payroll Report: ${dateRange.start || 'N/A'} to ${dateRange.end || 'N/A'}`,
                '',
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n')
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = `payroll_${dateRange.start}_to_${dateRange.end}.csv`
            link.click()
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Payroll Export</h1>
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
                    <strong>ℹ️ How payroll is calculated:</strong> Payroll is derived from reviewed attendance records within the selected date range.
                    <div className="mt-2 text-xs">
                        • <strong>Full Day</strong> = Full shift worked | • <strong>Half Day</strong> = Partial attendance | • <strong>Absent</strong> = No pay (unless salaried) | • <strong>Overtime</strong> = Hours beyond scheduled shift
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b">
                    <button
                        onClick={() => setActiveTab('salaried')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'salaried' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500'}`}
                    >
                        Salaried Staff ({salariedStaff.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('daily')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'daily' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500'}`}
                    >
                        Daily / Casual ({dailyStaff.length})
                    </button>
                </div>

                {/* Salaried Staff Tab */}
                {activeTab === 'salaried' && (
                    <Card title="Monthly Salaried Staff">
                        <p className="text-sm text-slate-500 mb-4">
                            Attendance is for reporting purposes. Salary is not auto-deducted for absences.
                        </p>
                        {salariedStaff.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">No salaried staff found.</div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Staff</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Role</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Days Present</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Absent</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Late</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Monthly Salary</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Gross</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salariedStaff.map(s => {
                                        const stats = getStats(s.id)
                                        const daysPresent = stats.full_days + stats.half_days
                                        return (
                                            <tr key={s.id} className="border-t">
                                                <td className="p-3 font-medium">{s.first_name} {s.last_name}</td>
                                                <td className="p-3">{s.job_title || 'Staff'}</td>
                                                <td className="p-3">{loadingStats ? '...' : daysPresent}</td>
                                                <td className="p-3">{loadingStats ? '...' : stats.absent_days}</td>
                                                <td className="p-3">-</td>
                                                <td className="p-3">KSh {(s.pay_rate || 0).toLocaleString()}</td>
                                                <td className="p-3 font-medium">KSh {(s.pay_rate || 0).toLocaleString()}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </Card>
                )}

                {/* Daily Staff Tab */}
                {activeTab === 'daily' && (
                    <Card title="Daily / Casual Staff">
                        <p className="text-sm text-slate-500 mb-4">
                            Pay calculated as: Full day = 1 unit × daily rate, Half day = 0.5 unit × daily rate
                        </p>
                        {dailyStaff.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                No daily/casual staff found. Staff pay types are set in Staff module.
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Staff</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Full Days</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Half Days</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Daily Rate</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Gross</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailyStaff.map(s => {
                                        const stats = getStats(s.id)
                                        return (
                                            <tr key={s.id} className="border-t">
                                                <td className="p-3 font-medium">{s.first_name} {s.last_name}</td>
                                                <td className="p-3">{loadingStats ? '...' : stats.full_days}</td>
                                                <td className="p-3">{loadingStats ? '...' : stats.half_days}</td>
                                                <td className="p-3">KSh {(s.pay_rate || 0).toLocaleString()}</td>
                                                <td className="p-3 font-medium">KSh {loadingStats ? '...' : calculateGross(s).toLocaleString()}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </Card>
                )}
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
            case 'team_schedule':
                return hasPermission('team_schedule') ? <TeamScheduleView /> : <LockedView feature="Team Schedule" />
            case 'manage_schedule':
                return hasPermission('manage_schedule') ? <ManageScheduleView /> : <LockedView feature="Create Shifts" />
            case 'staff_list':
                return hasPermission('staff_list') ? <StaffListView /> : <LockedView feature="Staff Directory" />
            case 'approve_leave':
                return hasPermission('approve_leave') ? <ApproveLeaveView /> : <LockedView feature="Leave Approvals" />
            case 'payroll':
                return hasPermission('payroll') ? <PayrollView /> : <LockedView feature="Payroll" />

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
