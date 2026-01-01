import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import PayrollView from '../PayrollView'
import LeaveTypesManager from '../LeaveTypesManager'

// Plan limits configuration
const PLAN_LIMITS = {
    essential: { locations: 1, staff: 10, adminSeats: 2 },
    professional: { locations: 2, staff: 30, adminSeats: 5 },
    enterprise: { locations: 5, staff: 75, adminSeats: 10 }
}

// East African cities for location dropdown
const EA_CITIES = [
    'Nairobi', 'Mombasa', 'Kisumu', 'Eldoret', 'Nakuru', 'Thika', 'Malindi',
    'Dar es Salaam', 'Dodoma', 'Arusha', 'Mwanza',
    'Kampala', 'Entebbe', 'Jinja', 'Gulu',
    'Kigali', 'Butare', 'Gisenyi',
    'Bujumbura', 'Gitega'
]

export default function EmployerDashboard() {
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const [view, setView] = useState('dashboard')
    const [loading, setLoading] = useState(true)
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // Organization data
    const [org, setOrg] = useState({
        name: '',
        email: '',
        plan: null,  // null = user must select plan
        planStatus: 'inactive',
        orgVerificationStatus: 'pending',
        locations: [],
        staff: [],
        locationCount: 0,
        staffCount: 0
    })

    // Dashboard stats
    const [dashboardStats, setDashboardStats] = useState({
        todayShifts: 0,
        presentToday: 0
    })

    // Current location filter
    const [selectedLocation, setSelectedLocation] = useState('all')

    // Get limits based on plan
    const limits = PLAN_LIMITS[org.plan] || PLAN_LIMITS.essential

    // Fetch initial data
    useEffect(() => {
        const clinicId = localStorage.getItem('hure_clinic_id')
        if (!clinicId) {
            navigate('/login')
            return
        }

        fetchDashboardData(clinicId)
        fetchDashboardStats(clinicId) // Uses current selectedLocation from state
    }, [selectedLocation]) // Refetch on location change

    const fetchDashboardStats = async (clinicId) => {
        const token = localStorage.getItem('hure_token')
        const today = new Date().toISOString().split('T')[0]

        try {
            // Fetch today's schedules
            const locQuery = selectedLocation && selectedLocation !== 'all' ? `&locationId=${selectedLocation}` : ''
            const schedRes = await fetch(`/api/clinics/${clinicId}/schedule?date=${today}${locQuery}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (schedRes.ok) {
                const data = await schedRes.json()
                const todayShifts = (data.data || []).length

                // Fetch today's attendance
                const attRes = await fetch(`/api/clinics/${clinicId}/attendance?startDate=${today}&endDate=${today}${locQuery}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                let presentCount = 0
                if (attRes.ok) {
                    const attData = await attRes.json()
                    presentCount = (attData.data || []).filter(a =>
                        a.status === 'present_full' || a.status === 'present_partial'
                    ).length
                }

                setDashboardStats({
                    todayShifts,
                    presentToday: presentCount
                })
            }
        } catch (err) {
            console.error('Fetch dashboard stats error:', err)
        }
    }

    const fetchDashboardData = async (clinicId) => {
        setLoading(true)
        const token = localStorage.getItem('hure_token')
        try {
            // Fetch clinic settings
            const res = await fetch(`/api/clinics/${clinicId}/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                console.log('📊 Fetched clinic data:', data.clinic)
                console.log('📊 Plan key from DB:', data.clinic?.plan_key)
                if (data.clinic) {
                    setOrg(prev => ({
                        ...prev,
                        name: data.clinic.name || '',
                        email: data.clinic.email || '',
                        plan: data.clinic.plan_key || null,  // Don't default - force plan selection
                        planStatus: data.clinic.plan_status || 'inactive',
                        orgVerificationStatus: data.clinic.org_verification_status || 'pending'
                    }))
                }
                if (data.locations) {
                    setOrg(prev => ({
                        ...prev,
                        locations: data.locations,
                        locationCount: data.locations.length
                    }))

                    // Set default location based on count
                    const savedLocation = localStorage.getItem('hure_selected_location')
                    if (data.locations.length === 1) {
                        // Only 1 location: auto-select it
                        setSelectedLocation(data.locations[0].id)
                        localStorage.setItem('hure_selected_location', data.locations[0].id)
                    } else if (savedLocation && (savedLocation === 'all' || data.locations.some(l => l.id === savedLocation))) {
                        // Multiple locations: use saved selection if valid
                        setSelectedLocation(savedLocation)
                    } else {
                        // Default to 'all' for multiple locations
                        setSelectedLocation('all')
                    }
                }
            }

            // Fetch staff (include owner for payroll purposes)
            const locQuery = selectedLocation && selectedLocation !== 'all' ? `&locationId=${selectedLocation}` : ''
            const staffRes = await fetch(`/api/clinics/${clinicId}/staff?includeOwner=true${locQuery}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (staffRes.ok) {
                const staffData = await staffRes.json()
                console.log('📊 Staff data received:', staffData.data?.length, 'users')
                setOrg(prev => ({
                    ...prev,
                    staff: staffData.data || [],
                    staffCount: (staffData.data || []).filter(s =>
                        s && s.role !== 'superadmin' &&
                        !s.email?.includes('@hure.app') &&
                        s.is_active !== false
                    ).length
                }))
            }
        } catch (err) {
            console.error('Fetch error:', err)
        } finally {
            setLoading(false)
        }
    }

    // Handle logout
    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    // Check if features should be locked
    const orgVerified = org.orgVerificationStatus === 'approved'
    const hasPlan = org.plan && org.plan !== 'none' // User must explicitly select a plan
    const hasVerifiedFacility = org.locations.some(l => l.facility_verification_status === 'approved')
    // Features unlock once plan is selected (not requiring facility verification)
    const featuresLocked = !hasPlan || org.planStatus !== 'active'

    // Plan selection handler
    const handleSelectPlan = async (planKey) => {
        const clinicId = localStorage.getItem('hure_clinic_id')
        try {
            const res = await fetch(`/api/clinics/${clinicId}/plan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                },
                body: JSON.stringify({ planKey })
            })

            if (res.ok) {
                setOrg(prev => ({ ...prev, plan: planKey, planStatus: 'active' }))
            }
        } catch (err) {
            console.error('Error selecting plan:', err)
        }
    }

    // ============================================
    // PLAN SELECTION MODAL
    // ============================================

    const PlanSelectionModal = () => {
        const plans = [
            {
                key: 'essential',
                name: 'Essential',
                price: 'KES 8,000/mo',
                features: ['1 Location', '10 Staff Members', '2 Admin Roles', 'Basic Scheduling', 'Attendance Tracking']
            },
            {
                key: 'professional',
                name: 'Professional',
                price: 'KES 15,000/mo',
                popular: true,
                features: ['2 Locations', '30 Staff Members', '5 Admin Roles', 'Advanced Scheduling', 'Leave Management', 'Payroll Export']
            },
            {
                key: 'enterprise',
                name: 'Enterprise',
                price: 'KES 25,000/mo',
                features: ['5 Locations', '75 Staff Members', '10 Admin Roles', 'All Features', 'Priority Support', 'Custom Integrations']
            }
        ]

        return (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
                    <div className="p-6 border-b text-center">
                        <h2 className="text-2xl font-bold text-slate-800">Choose Your Plan</h2>
                        <p className="text-slate-500 mt-1">Select a plan to unlock all features and start managing your clinic</p>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {plans.map(plan => (
                            <div
                                key={plan.key}
                                className={`relative border-2 rounded-xl p-6 ${plan.popular ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}`}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                                        Most Popular
                                    </div>
                                )}

                                <div className="text-center mb-4">
                                    <h3 className="text-xl font-bold text-slate-800">{plan.name}</h3>
                                    <div className="text-2xl font-bold text-primary-600 mt-2">{plan.price}</div>
                                </div>

                                <ul className="space-y-2 mb-6">
                                    {plan.features.map((f, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm">
                                            <span className="text-green-500">✓</span>
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => handleSelectPlan(plan.key)}
                                    className={`w-full py-3 rounded-lg font-medium transition ${plan.popular
                                        ? 'bg-primary-600 hover:bg-primary-700 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                                        }`}
                                >
                                    Select {plan.name}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-slate-50 text-center text-sm text-slate-500 rounded-b-2xl">
                        All plans include a 14-day free trial. No credit card required.
                    </div>
                </div>
            </div>
        )
    }

    // ============================================
    // REUSABLE COMPONENTS
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

    const StatCard = ({ icon, label, value, sublabel }) => (
        <Card>
            <div className="flex items-center gap-3">
                <div className="text-3xl">{icon}</div>
                <div>
                    <div className="text-2xl font-bold text-slate-800">{value}</div>
                    <div className="text-sm text-slate-500">{label}</div>
                    {sublabel && <div className="text-xs text-slate-400">{sublabel}</div>}
                </div>
            </div>
        </Card>
    )

    const NavBtn = ({ icon, label, active, onClick, locked }) => (
        <button
            onClick={onClick}
            disabled={locked}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition ${active
                ? 'bg-primary-600 text-white'
                : locked
                    ? 'text-slate-400 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
        >
            <span>{icon}</span>
            <span>{label}</span>
            {locked && <span className="ml-auto text-xs">🔒</span>}
        </button>
    )

    // ============================================
    // SIDEBAR
    // ============================================

    const Sidebar = () => (
        <>
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
        fixed lg:fixed inset-y-0 left-0 z-50 lg:z-40 w-64 bg-slate-900 text-white
        transform transition-transform lg:transform-none pt-[53px] overflow-y-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
                {/* User info */}
                <div className="p-4 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center font-bold">
                            {(user?.username === 'superadmin' ? 'E' : user?.username?.[0]?.toUpperCase()) || 'E'}
                        </div>
                        <div>
                            <div className="font-medium">{user?.username === 'superadmin' ? 'Employer' : (user?.username || 'Employer')}</div>
                            <div className="text-xs text-slate-400">
                                {org.locations.length > 1 ? 'All Locations' : org.locations[0]?.name || 'Main Location'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-1">
                    <div className="text-xs uppercase text-slate-500 font-medium mb-2">Main</div>
                    <NavBtn icon="📊" label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
                    <NavBtn icon="👥" label="Staff" active={view === 'staff'} onClick={() => setView('staff')} />
                    <NavBtn icon="📅" label="Schedule" active={view === 'schedule'} onClick={() => setView('schedule')} locked={featuresLocked} />
                    <NavBtn icon="⏰" label="Attendance" active={view === 'attendance'} onClick={() => setView('attendance')} locked={featuresLocked} />

                    <div className="text-xs uppercase text-slate-500 font-medium mt-4 mb-2">Finance</div>
                    <NavBtn icon="💰" label="Payroll" active={view === 'payroll'} onClick={() => setView('payroll')} locked={featuresLocked} />
                    <NavBtn icon="🏖️" label="Leave" active={view === 'leave'} onClick={() => setView('leave')} />
                    <NavBtn icon="💳" label="Billing" active={view === 'billing'} onClick={() => setView('billing')} />

                    <div className="text-xs uppercase text-slate-500 font-medium mt-4 mb-2">Admin</div>
                    <NavBtn icon="✅" label="Organization Details" active={view === 'verification'} onClick={() => setView('verification')} />
                    {hasPlan && <NavBtn icon="📍" label="Locations" active={view === 'locations'} onClick={() => setView('locations')} />}
                    <NavBtn icon="🔐" label="Permissions" active={view === 'permissions'} onClick={() => setView('permissions')} />
                    <NavBtn icon="⚙️" label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />
                </nav>
            </aside>
        </>
    )

    // ============================================
    // TOPBAR
    // ============================================

    const TopBar = () => (
        <header className="fixed top-0 left-0 right-0 h-[53px] bg-slate-800 text-white flex items-center justify-between px-4 z-50">
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden">
                    <span className="text-xl">☰</span>
                </button>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-primary-400">{org.name || 'Loading...'}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${org.planStatus === 'active' ? 'bg-primary-500/20 text-primary-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        {org.plan?.charAt(0).toUpperCase() + org.plan?.slice(1)} · {org.planStatus}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Location selector */}
                {org.locations.length > 0 && (
                    <select
                        value={selectedLocation}
                        onChange={(e) => {
                            setSelectedLocation(e.target.value)
                            localStorage.setItem('hure_selected_location', e.target.value)
                        }}
                        className="bg-slate-700 border-none rounded-lg px-3 py-1.5 text-sm"
                    >
                        {/* Only show "All Locations" if 2+ locations */}
                        {org.locations.length > 1 && <option value="all">All Locations</option>}
                        {org.locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                    </select>
                )}

                <button onClick={handleLogout} className="text-slate-400 hover:text-white text-sm">
                    Logout
                </button>
            </div>
        </header>
    )

    // ============================================
    // DASHBOARD VIEW
    // ============================================

    const DashboardView = () => (
        <div className="space-y-6">
            {/* Verification Banner */}
            {!orgVerified && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                            <div className="font-medium text-amber-800">Complete Organization Verification</div>
                            <div className="text-sm text-amber-600">Submit your business documents to unlock all features</div>
                        </div>
                    </div>
                    <button
                        onClick={() => setView('verification')}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                        Verify Now
                    </button>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="👥" label="Total Staff" value={org.staffCount} sublabel={`of ${limits.staff} allowed`} />
                <StatCard icon="📍" label="Locations" value={org.locationCount} sublabel={`of ${limits.locations} allowed`} />
                <StatCard icon="📅" label="Today's Shifts" value={dashboardStats.todayShifts} sublabel="Scheduled" />
                <StatCard icon="⏰" label="Present Today" value={dashboardStats.presentToday} sublabel={`of ${org.staffCount} staff clocked in`} />
            </div>

            {/* Compliance Status */}
            <Card title="Compliance Status">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${org.orgVerificationStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            org.orgVerificationStatus === 'under_review' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                            }`}>
                            {org.orgVerificationStatus === 'approved' ? 'Approved' :
                                org.orgVerificationStatus === 'under_review' ? 'Under Review' :
                                    org.orgVerificationStatus === 'pending' ? 'Pending' : org.orgVerificationStatus}
                        </span>
                        <span className="text-sm text-slate-600">Organization Verification</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-600">
                            Facility Licenses: {org.locations.filter(l => l.facility_verification_status === 'approved').length} / {org.locationCount} Approved
                        </span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-600">Staff Licenses: 0 added</span>
                    </div>
                </div>
            </Card>

            {/* Quick Actions */}
            <Card title="Quick Actions">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { icon: '📅', label: 'View Schedule', action: () => setView('schedule'), locked: featuresLocked },
                        { icon: '👥', label: 'Manage Staff', action: () => setView('staff') },
                        { icon: '⏰', label: 'Attendance', action: () => setView('attendance'), locked: featuresLocked },
                        { icon: '💰', label: 'Export Payroll', action: () => setView('payroll'), locked: featuresLocked }
                    ].map((item, i) => (
                        <button
                            key={i}
                            onClick={item.action}
                            disabled={item.locked}
                            className={`p-4 rounded-xl border text-center transition ${item.locked
                                ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                : 'border-slate-200 hover:border-primary-300 hover:bg-primary-50'
                                }`}
                        >
                            <div className="text-2xl mb-2">{item.icon}</div>
                            <div className="text-sm font-medium">{item.label}</div>
                            {item.locked && <div className="text-xs text-slate-400 mt-1">🔒 Facility verification required</div>}
                        </button>
                    ))}
                </div>
            </Card>
        </div>
    )

    // ============================================
    // STAFF VIEW
    // ============================================

    const StaffView = () => {
        const [showAddForm, setShowAddForm] = useState(false)
        const [showEditForm, setShowEditForm] = useState(false)
        const [editingStaff, setEditingStaff] = useState(null)
        const [newStaff, setNewStaff] = useState({
            first_name: '', last_name: '', email: '', phone: '',
            job_title: '', location_id: '', employment_type: 'full-time', pay_rate: '', hire_date: '',
            system_role: 'EMPLOYEE',
            permissions: []
        })

        const allPermissions = ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'team_schedule', 'manage_schedule', 'staff_list', 'manage_staff', 'approve_leave', 'team_attendance', 'payroll', 'settings']
        const [adding, setAdding] = useState(false)
        const [updating, setUpdating] = useState(false)
        const [staffTab, setStaffTab] = useState('all') // 'all', 'salaried', 'casual'
        const canAddStaff = org.staffCount < limits.staff

        const handleAddStaff = async (e) => {
            e.preventDefault()
            const clinicId = localStorage.getItem('hure_clinic_id')
            setAdding(true)
            try {
                const res = await fetch(`/api/clinics/${clinicId}/staff`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify(newStaff)
                })
                if (res.ok) {
                    const data = await res.json()
                    setOrg(prev => ({
                        ...prev,
                        staff: [...prev.staff, data.staff],
                        // staffCount: prev.staffCount + 1 -- Don't increment for inactive staff (pending invite)
                    }))
                    setShowAddForm(false)
                    setNewStaff({ first_name: '', last_name: '', email: '', phone: '', job_title: '', location_id: '', employment_type: 'full-time', pay_rate: '', hire_date: '' })
                } else {
                    const err = await res.json()
                    alert(err.error || 'Failed to add staff')
                }
            } catch (err) {
                console.error('Add staff error:', err)
            } finally {
                setAdding(false)
            }
        }

        const handleEditStaff = (staff) => {
            // Infer system_role if not present
            const sysRole = staff.system_role || (staff.role === 'Owner' ? 'OWNER' :
                ['Shift Manager', 'HR Manager', 'Payroll Officer'].includes(staff.role) ? 'ADMIN' : 'EMPLOYEE')
            setEditingStaff({
                id: staff.id,
                first_name: staff.first_name || '',
                last_name: staff.last_name || '',
                email: staff.email || '',
                phone: staff.phone || '',
                job_title: staff.job_title || '',
                location_id: staff.location_id || '',
                employment_type: staff.employment_type || 'full-time',
                pay_rate: staff.pay_rate || '',
                is_active: staff.is_active !== false,
                system_role: sysRole,
                role: staff.role,
                permissions: staff.permissions || []
            })
            setShowEditForm(true)
        }

        const handleUpdateStaff = async (e) => {
            e.preventDefault()
            const clinicId = localStorage.getItem('hure_clinic_id')
            setUpdating(true)
            try {
                const res = await fetch(`/api/clinics/${clinicId}/staff/${editingStaff.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify(editingStaff)
                })
                if (res.ok) {
                    const data = await res.json()
                    setOrg(prev => ({
                        ...prev,
                        staff: prev.staff.map(s => s.id === editingStaff.id ? data.staff : s)
                    }))
                    setShowEditForm(false)
                    setEditingStaff(null)
                } else {
                    const err = await res.json()
                    alert(err.error || 'Failed to update staff')
                }
            } catch (err) {
                console.error('Update staff error:', err)
            } finally {
                setUpdating(false)
            }
        }

        const handleDeleteStaff = async (staffId, staffName) => {
            if (!confirm(`Are you sure you want to delete ${staffName}? This cannot be undone.`)) {
                return
            }
            const clinicId = localStorage.getItem('hure_clinic_id')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/staff/${staffId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                })
                if (res.ok) {
                    setOrg(prev => ({
                        ...prev,
                        staff: prev.staff.filter(s => s.id !== staffId),
                        staffCount: prev.staffCount - (prev.staff.find(s => s.id === staffId)?.is_active !== false ? 1 : 0)
                    }))
                } else {
                    alert('Failed to delete staff')
                }
            } catch (err) {
                console.error('Delete staff error:', err)
            }
        }

        const handleToggleStatus = async (staffId, currentStatus, staffName) => {
            const newStatus = !currentStatus
            const action = newStatus ? 'activate' : 'deactivate'

            // Check limit if activating
            if (newStatus && org.staffCount >= limits.staff) {
                alert(`Cannot activate staff: Current plan limit of ${limits.staff} active staff reached. Please upgrade or deactivate another staff member first.`)
                return
            }

            if (!confirm(`Are you sure you want to ${action} ${staffName}? ${!newStatus ? 'They will not be able to log in.' : 'They will regain access.'}`)) {
                return
            }

            const clinicId = localStorage.getItem('hure_clinic_id')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/staff/${staffId}/status`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify({ isActive: newStatus })
                })

                if (res.ok) {
                    const data = await res.json()
                    setOrg(prev => ({
                        ...prev,
                        staff: prev.staff.map(s => s.id === staffId ? { ...s, is_active: newStatus } : s)
                    }))
                    // Update staff count if needed
                    const activeCount = org.staff.filter(s => s.id !== staffId && s.is_active !== false).length + (newStatus ? 1 : 0)
                    setOrg(prev => ({
                        ...prev,
                        staffCount: activeCount // This might be redundant if staffCount is derived, but safe to update
                    }))
                } else {
                    if (res.status === 401) {
                        alert('Your session has expired. Please log in again.')
                        logout() // Uses the logout hook from context
                        navigate('/login')
                        return
                    }
                    const err = await res.json()
                    alert(err.error || `Failed to ${action} staff`)
                }
            } catch (err) {
                console.error('Status update error:', err)
                alert(`Failed to ${action} staff`)
            }
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Staff Management</h1>
                        <p className="text-slate-500 text-sm">{org.staff.filter(s => s && s.role !== 'superadmin' && !s.email?.includes('@hure.app') && s.is_active !== false).length} of {limits.staff} staff used (Active only)</p>
                    </div>
                    <button
                        onClick={() => setShowAddForm(true)}
                        disabled={!canAddStaff}
                        className={`px-4 py-2 rounded-lg font-medium ${canAddStaff
                            ? 'bg-primary-600 hover:bg-primary-700 text-white'
                            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        {canAddStaff ? '+ Add Staff' : 'Staff Limit Reached'}
                    </button>
                </div>

                {/* Add Staff Form */}
                {showAddForm && (
                    <Card title="Add New Staff Member">
                        <form onSubmit={handleAddStaff} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                                    <input
                                        type="text"
                                        value={newStaff.first_name}
                                        onChange={(e) => setNewStaff({ ...newStaff, first_name: e.target.value })}
                                        placeholder="John"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                                    <input
                                        type="text"
                                        value={newStaff.last_name}
                                        onChange={(e) => setNewStaff({ ...newStaff, last_name: e.target.value })}
                                        placeholder="Doe"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                                    <input
                                        type="email"
                                        value={newStaff.email}
                                        onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                                        placeholder="john@example.com"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        value={newStaff.phone}
                                        onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                                        placeholder="+254..."
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Job Title *</label>
                                    <input
                                        type="text"
                                        value={newStaff.job_title}
                                        onChange={(e) => setNewStaff({ ...newStaff, job_title: e.target.value })}
                                        placeholder="e.g., Nurse, Receptionist"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">System Role</label>
                                    <select
                                        value={newStaff.system_role || 'EMPLOYEE'}
                                        onChange={(e) => setNewStaff({ ...newStaff, system_role: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    >
                                        <option value="EMPLOYEE">EMPLOYEE</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                                    <select
                                        value={newStaff.location_id}
                                        onChange={(e) => setNewStaff({ ...newStaff, location_id: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    >
                                        <option value="">No specific location</option>
                                        {org.locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Employment Type *</label>
                                    <select
                                        value={newStaff.employment_type}
                                        onChange={(e) => setNewStaff({ ...newStaff, employment_type: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    >
                                        <option value="full-time">Full-Time (Salary)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Monthly Salary (KSh)
                                    </label>
                                    <input
                                        type="number"
                                        value={newStaff.pay_rate}
                                        onChange={(e) => setNewStaff({ ...newStaff, pay_rate: e.target.value })}
                                        placeholder="e.g., 45000"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Hire Date</label>
                                    <input
                                        type="date"
                                        value={newStaff.hire_date}
                                        onChange={(e) => setNewStaff({ ...newStaff, hire_date: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    />
                                </div>
                            </div>

                            {/* Permissions Panel - Show only for ADMIN */}
                            {newStaff.system_role === 'ADMIN' && (
                                <div className="border rounded-lg p-4 bg-slate-50">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Admin Permissions</h3>
                                    <p className="text-xs text-slate-500 mb-3">Select specific permissions for this admin user. This allows fine-grained access control.</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {allPermissions.map(perm => (
                                            <label key={perm} className="flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={newStaff.permissions?.includes(perm) || false}
                                                    onChange={(e) => {
                                                        const perms = newStaff.permissions || []
                                                        if (e.target.checked) {
                                                            setNewStaff({ ...newStaff, permissions: [...perms, perm] })
                                                        } else {
                                                            setNewStaff({ ...newStaff, permissions: perms.filter(p => p !== perm) })
                                                        }
                                                    }}
                                                    className="rounded"
                                                />
                                                <span className="text-slate-700">{perm.replace(/_/g, ' ')}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={adding}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                                >
                                    {adding ? 'Adding...' : 'Add Staff Member'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </Card>
                )
                }

                <Card title="Staff Members">
                    {org.staff.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="text-4xl mb-4">👥</div>
                            <div>No staff members yet. Add your first staff member to get started.</div>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Name</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Job Title</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Role</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Email</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Location</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {org.staff
                                    .filter(s => s && s.role !== 'superadmin' && !s.email?.includes('@hure.app'))
                                    .map(s => {
                                        // Determine badge color based on role
                                        // If permission_role is 'Staff' (or missing and defaults to Staff), it's Gray.
                                        // Any other role (Owner, Managers, etc.) is Blue.
                                        const roleName = s.permission_role || 'Staff'
                                        const isStaff = roleName === 'Staff' || roleName === 'staff'

                                        const badgeClass = isStaff
                                            ? 'bg-gray-100 text-gray-600 border border-gray-200'
                                            : 'bg-blue-100 text-blue-800 border border-blue-200'

                                        return (
                                            <tr key={s.id} className="border-t hover:bg-slate-50">
                                                <td className="p-3 font-medium">{s.first_name} {s.last_name}</td>
                                                <td className="p-3">{s.job_title || '-'}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${badgeClass}`}>
                                                        {roleName}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-sm text-slate-500">{s.email}</td>
                                                <td className="p-3">{s.location?.name || s.clinic_locations?.name || '-'}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded text-xs ${s.status === 'invited' ? 'bg-blue-100 text-blue-700' :
                                                        s.status === 'inactive' || s.is_active === false ? 'bg-slate-100 text-slate-600' :
                                                            s.status === 'archived' ? 'bg-red-100 text-red-600' :
                                                                'bg-green-100 text-green-700'
                                                        }`}>
                                                        {s.status === 'invited' ? 'Invited' :
                                                            s.status === 'inactive' || s.is_active === false ? 'Inactive' :
                                                                s.status === 'archived' ? 'Archived' : 'Active'}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleEditStaff(s)}
                                                            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                                        >
                                                            Edit
                                                        </button>
                                                        {s.role !== 'Owner' && (
                                                            <button
                                                                onClick={() => handleToggleStatus(s.id, s.is_active !== false, `${s.first_name} ${s.last_name}`)}
                                                                className={`text-sm font-medium ${s.is_active !== false ? 'text-amber-600 hover:text-amber-700' : 'text-green-600 hover:text-green-700'}`}
                                                            >
                                                                {s.is_active !== false ? 'Deactivate' : 'Activate'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                            </tbody>
                        </table>
                    )}
                </Card>

                {/* Edit Staff Modal */}
                {
                    showEditForm && editingStaff && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                                <div className="p-4 border-b flex items-center justify-between">
                                    <h2 className="text-lg font-bold">Edit Staff Member</h2>
                                    <button onClick={() => { setShowEditForm(false); setEditingStaff(null) }} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
                                </div>
                                <form onSubmit={handleUpdateStaff} className="p-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                                            <input type="text" value={editingStaff.first_name} onChange={(e) => setEditingStaff({ ...editingStaff, first_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" required />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                                            <input type="text" value={editingStaff.last_name} onChange={(e) => setEditingStaff({ ...editingStaff, last_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" required />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                        <input type="email" value={editingStaff.email} onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                                        <input type="tel" value={editingStaff.phone} onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                                        <input type="text" value={editingStaff.job_title} onChange={(e) => setEditingStaff({ ...editingStaff, job_title: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">System Role</label>
                                        {editingStaff.system_role === 'OWNER' || editingStaff.role === 'Owner' ? (
                                            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 font-medium">OWNER (immutable)</div>
                                        ) : (
                                            <select
                                                value={editingStaff.system_role || 'EMPLOYEE'}
                                                onChange={(e) => setEditingStaff({ ...editingStaff, system_role: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                            >
                                                <option value="EMPLOYEE">EMPLOYEE</option>
                                                <option value="ADMIN">ADMIN</option>
                                            </select>
                                        )}
                                        <p className="text-xs text-slate-500 mt-1">
                                            Admin seats: {org.staff.filter(s => s.system_role === 'ADMIN' && s.is_active !== false).length} / {limits.adminSeats} used
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                                        <select value={editingStaff.location_id} onChange={(e) => setEditingStaff({ ...editingStaff, location_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300">
                                            <option value="">No location</option>
                                            {org.locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Employment Type</label>
                                            <select value={editingStaff.employment_type} onChange={(e) => setEditingStaff({ ...editingStaff, employment_type: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300">
                                                <option value="full-time">Full-time</option>
                                                <option value="part-time">Part-time</option>
                                                <option value="casual">Casual</option>
                                                <option value="contract">Contract</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Pay Rate (KES)</label>
                                            <input type="number" value={editingStaff.pay_rate} onChange={(e) => setEditingStaff({ ...editingStaff, pay_rate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                                        </div>
                                    </div>

                                    {/* Permissions Panel for Edit - Show only for ADMIN */}
                                    {editingStaff.system_role === 'ADMIN' && (
                                        <div className="border rounded-lg p-4 bg-slate-50">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Admin Permissions</h3>
                                            <p className="text-xs text-slate-500 mb-3">Select specific permissions for this admin user.</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {allPermissions.map(perm => (
                                                    <label key={perm} className="flex items-center gap-2 text-sm">
                                                        <input
                                                            type="checkbox"
                                                            checked={editingStaff.permissions?.includes(perm) || false}
                                                            onChange={(e) => {
                                                                const perms = editingStaff.permissions || []
                                                                if (e.target.checked) {
                                                                    setEditingStaff({ ...editingStaff, permissions: [...perms, perm] })
                                                                } else {
                                                                    setEditingStaff({ ...editingStaff, permissions: perms.filter(p => p !== perm) })
                                                                }
                                                            }}
                                                            className="rounded"
                                                        />
                                                        <span className="text-slate-700">{perm.replace(/_/g, ' ')}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" id="is_active" checked={editingStaff.is_active} onChange={(e) => setEditingStaff({ ...editingStaff, is_active: e.target.checked })} className="rounded" />
                                        <label htmlFor="is_active" className="text-sm text-slate-700">Active Employee</label>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button type="submit" disabled={updating} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg font-medium disabled:opacity-50">
                                            {updating ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        <button type="button" onClick={() => { setShowEditForm(false); setEditingStaff(null) }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }
            </div >
        )
    }

    // ============================================
    // PLACEHOLDER VIEWS
    // ============================================

    const PlaceholderView = ({ title, icon, message }) => (
        <div className="text-center py-20">
            <div className="text-6xl mb-4">{icon}</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">{title}</h2>
            <p className="text-slate-500">{message}</p>
        </div>
    )

    const LockedView = ({ feature }) => (
        <div className="text-center py-20">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">{feature} is Locked</h2>
            <p className="text-slate-500 mb-4">Complete facility verification to unlock this feature.</p>
            <button
                onClick={() => setView('verification')}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg"
            >
                Go to Verification
            </button>
        </div>
    )

    // ============================================
    // VERIFICATION VIEW
    // ============================================

    const VerificationView = () => {
        const [orgForm, setOrgForm] = useState({
            kra_pin: '',
            business_reg_no: '',
            business_reg_doc: null,
            business_reg_expiry: '',
            facility_license_doc: null,
            facility_license_expiry: ''
        })
        const [facForm, setFacForm] = useState({ locationId: '', license_no: '', licensing_body: '', expiry_date: '' })
        const [submitting, setSubmitting] = useState(false)
        const [uploading, setUploading] = useState(false)

        // Calculate days until expiry
        const getDaysUntilExpiry = (expiryDate) => {
            if (!expiryDate) return null
            const today = new Date()
            const expiry = new Date(expiryDate)
            const diffTime = expiry - today
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            return diffDays
        }

        // Get expiry warning badge
        const getExpiryBadge = (expiryDate) => {
            const days = getDaysUntilExpiry(expiryDate)
            if (days === null) return null

            if (days < 0) {
                return <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">Expired {Math.abs(days)} days ago</span>
            } else if (days < 30) {
                return <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">⚠️ Expires in {days} days</span>
            } else if (days < 60) {
                return <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">⚠️ Expires in {days} days</span>
            }
            return null
        }

        //Handle document upload to Supabase Storage
        const handleDocumentUpload = async (e, documentType) => {
            const file = e.target.files[0]
            if (!file) return

            // Validate file type
            const validTypes = ['application/pdf', 'image/jpeg', 'image/png']
            if (!validTypes.includes(file.type)) {
                alert('Please upload a PDF, JPG, or PNG file')
                return
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB')
                return
            }

            setUploading(true)
            const clinicId = localStorage.getItem('hure_clinic_id')

            try {
                // Create FormData to send file
                const formData = new FormData()
                formData.append('file', file)
                formData.append('documentType', documentType)
                formData.append('expiryDate', documentType === 'business_reg' ? orgForm.business_reg_expiry : orgForm.facility_license_expiry)

                // Upload to backend which will save to Supabase Storage
                const res = await fetch(`/api/clinics/${clinicId}/documents/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                        // Note: Don't set Content-Type for FormData - browser sets it with boundary
                    },
                    body: formData
                })

                if (res.ok) {
                    const data = await res.json()
                    // Update org state with new document URL
                    setOrg(prev => ({ ...prev, ...data.clinic }))

                    // Update local form state with filename
                    if (documentType === 'business_reg') {
                        setOrgForm(prev => ({ ...prev, business_reg_doc: file.name }))
                    } else {
                        setOrgForm(prev => ({ ...prev, facility_license_doc: file.name }))
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

        // Submit for verification
        const handleSubmitVerification = async () => {
            const clinicId = localStorage.getItem('hure_clinic_id')

            if (!org.business_reg_doc || !org.facility_license_doc) {
                alert('Please upload both required documents before submitting')
                return
            }

            setSubmitting(true)
            try {
                const res = await fetch(`/api/clinics/${clinicId}/verification/submit`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    }
                })

                if (res.ok) {
                    const data = await res.json()
                    setOrg(prev => ({ ...prev, ...data.clinic }))
                    alert('Submitted for verification! Our team will review your documents.')
                } else {
                    const error = await res.json()
                    alert(error.error || 'Failed to submit')
                }
            } catch (err) {
                console.error('Submit error:', err)
                alert('Failed to submit for verification')
            } finally {
                setSubmitting(false)
            }
        }

        const handleOrgSubmit = async (e) => {
            e.preventDefault()
            const clinicId = localStorage.getItem('hure_clinic_id')
            setSubmitting(true)
            try {
                const res = await fetch(`/api/clinics/${clinicId}/verification`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify(orgForm)
                })
                if (res.ok) {
                    setOrg(prev => ({ ...prev, orgVerificationStatus: 'under_review' }))
                    alert('Organization submitted for verification!')
                }
            } catch (err) {
                console.error('Submit error:', err)
            } finally {
                setSubmitting(false)
            }
        }

        const handleFacilitySubmit = async (e) => {
            e.preventDefault()
            const clinicId = localStorage.getItem('hure_clinic_id')
            setSubmitting(true)
            try {
                const res = await fetch(`/api/clinics/${clinicId}/locations/${facForm.locationId}/verification`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify({
                        license_no: facForm.license_no,
                        licensing_body: facForm.licensing_body,
                        license_expiry: facForm.expiry_date
                    })
                })
                if (res.ok) {
                    fetchDashboardData(clinicId)
                    alert('Facility submitted for verification!')
                    setFacForm({ locationId: '', license_no: '', licensing_body: '', expiry_date: '' })
                }
            } catch (err) {
                console.error('Facility submit error:', err)
            } finally {
                setSubmitting(false)
            }
        }

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-xl font-bold">Organization Details</h1>
                    <p className="text-slate-500 text-sm">Submit your documents for verification by HURE administrators.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Organization Verification */}
                    <Card title="Organization Verification" right={
                        <span className={`px-2 py-1 rounded text-xs font-medium ${org.org_verification_status === 'approved' ? 'bg-green-100 text-green-700' :
                            org.org_verification_status === 'under_review' ? 'bg-amber-100 text-amber-700' :
                                org.org_verification_status === 'rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-slate-100 text-slate-600'
                            }`}>
                            {org.org_verification_status || 'draft'}
                        </span>
                    }>
                        {/* Rejection Reason Alert */}
                        {org.org_verification_status === 'rejected' && org.verification_rejection_reason && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm font-medium text-red-800">❌ Verification Rejected</p>
                                <p className="text-sm text-red-700 mt-1">{org.verification_rejection_reason}</p>
                                <p className="text-xs text-red-600 mt-2">Please update your documents and resubmit.</p>
                            </div>
                        )}

                        {/* Field Locking Notice */}
                        {org.org_verification_status === 'approved' && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                                <span className="text-green-700">🔒</span>
                                <p className="text-sm text-green-800">Organization verified! Contact support to update details.</p>
                            </div>
                        )}

                        <form onSubmit={handleOrgSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    KRA PIN
                                    <span className="text-slate-400 font-normal ml-1">(Recommended for tax & invoicing)</span>
                                </label>
                                <input
                                    type="text"
                                    value={orgForm.kra_pin}
                                    onChange={(e) => setOrgForm({ ...orgForm, kra_pin: e.target.value })}
                                    placeholder="e.g., A123456789Z"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    disabled={org.org_verification_status === 'approved'}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Business Registration No. *</label>
                                <input
                                    type="text"
                                    value={orgForm.business_reg_no}
                                    onChange={(e) => setOrgForm({ ...orgForm, business_reg_no: e.target.value })}
                                    placeholder="e.g., PVT-2024-12345"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    required
                                    disabled={org.org_verification_status === 'approved'}
                                />
                            </div>

                            {/* Business Registration Document */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium text-slate-700">Business Registration Document *</label>
                                    {getExpiryBadge(org.business_reg_expiry)}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) => handleDocumentUpload(e, 'business_reg')}
                                        className="hidden"
                                        id="business-reg-upload"
                                        disabled={org.org_verification_status === 'approved' || uploading}
                                    />
                                    <label
                                        htmlFor="business-reg-upload"
                                        className={`flex-1 px-3 py-2 border rounded-lg cursor-pointer text-sm ${org.org_verification_status === 'approved' ? 'bg-slate-100 cursor-not-allowed' : 'hover:bg-slate-50'
                                            }`}
                                    >
                                        {org.business_reg_doc ? '📄 ' + (orgForm.business_reg_doc || 'Document uploaded') : '📎 Upload PDF, JPG, or PNG'}
                                    </label>
                                </div>
                                <div className="mt-1">
                                    <label className="block text-xs text-slate-600 mb-1">Expiry Date (if applicable)</label>
                                    <input
                                        type="date"
                                        value={orgForm.business_reg_expiry}
                                        onChange={(e) => setOrgForm({ ...orgForm, business_reg_expiry: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                                        disabled={org.org_verification_status === 'approved'}
                                    />
                                </div>
                            </div>



                            {/* Submit/Resubmit Button */}
                            {org.org_verification_status === 'approved' ? (
                                <div className="text-green-600 text-sm font-medium">✓ Your organization is verified!</div>
                            ) : org.org_verification_status === 'under_review' ? (
                                <div className="text-amber-600 text-sm font-medium">⏳ Verification under review...</div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSubmitVerification}
                                    disabled={submitting || uploading || !org.business_reg_doc || !org.facility_license_doc}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Submitting...' : org.org_verification_status === 'rejected' ? 'Resubmit for Review' : 'Submit for Review'}
                                </button>
                            )}
                        </form>
                    </Card>

                    {/* Facility Verification */}
                    <Card title="Facility Verification">
                        {org.locations.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <p>No locations yet. Add a location first.</p>
                                <button
                                    onClick={() => setView('locations')}
                                    className="mt-2 text-primary-600 hover:text-primary-700 font-medium"
                                >
                                    Go to Locations
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleFacilitySubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Location *</label>
                                    <select
                                        value={facForm.locationId}
                                        onChange={(e) => setFacForm({ ...facForm, locationId: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    >
                                        <option value="">Choose a location...</option>
                                        {org.locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>
                                                {loc.name} - {loc.city || 'No city'} {loc.facility_verification_status === 'approved' ? '✓' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">License Number *</label>
                                    <input
                                        type="text"
                                        value={facForm.license_no}
                                        onChange={(e) => setFacForm({ ...facForm, license_no: e.target.value })}
                                        placeholder="Facility license number"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Licensing Body *</label>
                                    <select
                                        value={facForm.licensing_body}
                                        onChange={(e) => setFacForm({ ...facForm, licensing_body: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    >
                                        <option value="">Select...</option>
                                        <option value="KMPDB">Kenya Medical Practitioners and Dentists Board</option>
                                        <option value="NCK">Nursing Council of Kenya</option>
                                        <option value="PPB">Pharmacy and Poisons Board</option>
                                        <option value="MOH">Ministry of Health</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">License Expiry Date *</label>
                                    <input
                                        type="date"
                                        value={facForm.expiry_date}
                                        onChange={(e) => setFacForm({ ...facForm, expiry_date: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
                                </div>
                                {/* Facility Operating License (Moved) */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-sm font-medium text-slate-700">Facility Operating License *</label>
                                        {getExpiryBadge(org.facility_license_expiry)}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={(e) => handleDocumentUpload(e, 'facility_license')}
                                            className="hidden"
                                            id="facility-license-upload"
                                            disabled={org.org_verification_status === 'approved' || uploading}
                                        />
                                        <label
                                            htmlFor="facility-license-upload"
                                            className={`flex-1 px-3 py-2 border rounded-lg cursor-pointer text-sm ${org.org_verification_status === 'approved' ? 'bg-slate-100 cursor-not-allowed' : 'hover:bg-slate-50'
                                                }`}
                                        >
                                            {org.facility_license_doc ? '📄 ' + (orgForm.facility_license_doc || 'Document uploaded') : '📎 Upload PDF, JPG, or PNG'}
                                        </label>
                                    </div>
                                    <div className="mt-1">
                                        <label className="block text-xs text-slate-600 mb-1">Expiry Date (if applicable)</label>
                                        <input
                                            type="date"
                                            value={orgForm.facility_license_expiry}
                                            onChange={(e) => setOrgForm({ ...orgForm, facility_license_expiry: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                                            disabled={org.org_verification_status === 'approved'}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                                >
                                    {submitting ? 'Submitting...' : 'Submit for Review'}
                                </button>
                            </form>
                        )}
                    </Card>
                </div>

                {/* Compliance Summary */}
                <Card title="Compliance Summary">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-lg">
                            <div className="font-medium mb-2">Organization</div>
                            <span className={`px-2 py-1 rounded text-xs ${org.orgVerificationStatus === 'approved' ? 'bg-green-100 text-green-700' : 'bg-slate-200'}`}>
                                {org.orgVerificationStatus}
                            </span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg">
                            <div className="font-medium mb-2">Facilities ({org.locationCount} locations)</div>
                            <div className="text-sm text-slate-600">
                                {org.locations.filter(l => l.facility_verification_status === 'approved').length} Approved ·
                                {org.locations.filter(l => l.facility_verification_status === 'pending_review').length} Pending ·
                                {org.locations.filter(l => !l.facility_verification_status || l.facility_verification_status === 'draft').length} Draft
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        )
    }

    // ============================================
    // LOCATIONS VIEW
    // ============================================

    const LocationsView = () => {
        const [showAddForm, setShowAddForm] = useState(false)
        const [newLocation, setNewLocation] = useState({ name: '', city: '', address: '', phone: '', is_primary: false })
        const [adding, setAdding] = useState(false)
        const canAddLocation = org.locationCount < limits.locations

        const handleAddLocation = async (e) => {
            e.preventDefault()
            const clinicId = localStorage.getItem('hure_clinic_id')
            setAdding(true)
            try {
                const res = await fetch(`/api/clinics/${clinicId}/locations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify(newLocation)
                })
                if (res.ok) {
                    const data = await res.json()
                    setOrg(prev => ({
                        ...prev,
                        locations: [...prev.locations, data.location],
                        locationCount: prev.locationCount + 1
                    }))
                    setShowAddForm(false)
                    setNewLocation({ name: '', city: '', address: '', phone: '', is_primary: false })
                } else {
                    const err = await res.json()
                    alert(err.error || 'Failed to add location')
                }
            } catch (err) {
                console.error('Add location error:', err)
            } finally {
                setAdding(false)
            }
        }

        const handleDeleteLocation = async (locationId) => {
            if (!window.confirm('Are you sure you want to delete this location? This action cannot be undone.')) return

            const clinicId = localStorage.getItem('hure_clinic_id')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/locations/${locationId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                })

                if (res.ok) {
                    setOrg(prev => ({
                        ...prev,
                        locations: prev.locations.filter(l => l.id !== locationId),
                        locationCount: prev.locationCount - 1
                    }))
                } else {
                    const data = await res.json()
                    alert(data.error || 'Failed to delete location')
                }
            } catch (err) {
                console.error('Delete location error:', err)
                alert('Failed to delete location. Please check your network connection.')
            }
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Location Management</h1>
                        <p className="text-slate-500 text-sm">{org.locationCount} of {limits.locations} locations used</p>
                    </div>
                    <button
                        onClick={() => setShowAddForm(true)}
                        disabled={!canAddLocation}
                        className={`px-4 py-2 rounded-lg font-medium ${canAddLocation
                            ? 'bg-primary-600 hover:bg-primary-700 text-white'
                            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        {canAddLocation ? '+ Add Location' : 'Upgrade to Add More'}
                    </button>
                </div>

                {/* Add Location Form */}
                {showAddForm && (
                    <Card title="Add New Location">
                        <form onSubmit={handleAddLocation} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Location Name *</label>
                                    <input
                                        type="text"
                                        value={newLocation.name}
                                        onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                                        placeholder="e.g., Main Clinic"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">City *</label>
                                    <input
                                        type="text"
                                        value={newLocation.city}
                                        onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
                                        placeholder="e.g., Nairobi"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Address</label>
                                    <input
                                        type="text"
                                        value={newLocation.address}
                                        onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                                        placeholder="Street address, building, etc."
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                    <input
                                        type="text"
                                        value={newLocation.phone}
                                        onChange={(e) => setNewLocation({ ...newLocation, phone: e.target.value })}
                                        placeholder="e.g. +254..."
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    />
                                </div>
                            </div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={newLocation.is_primary}
                                    onChange={(e) => setNewLocation({ ...newLocation, is_primary: e.target.checked })}
                                    className="rounded"
                                />
                                <span className="text-sm">Set as primary location</span>
                            </label>
                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={adding}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                                >
                                    {adding ? 'Adding...' : 'Add Location'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </Card>
                )
                }

                {/* Usage bar */}
                <Card>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Location Usage</span>
                        <span className="text-sm text-slate-500">{org.locationCount} of {limits.locations}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full ${org.locationCount >= limits.locations ? 'bg-red-500' : 'bg-primary-500'}`}
                            style={{ width: `${(org.locationCount / limits.locations) * 100}%` }}
                        />
                    </div>
                </Card>

                {/* Locations list */}
                <Card title="Your Locations">
                    {org.locations.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            No locations yet. Add your first location to get started.
                        </div>
                    ) : (
                        <div className="divide-y">
                            {org.locations.map(loc => (
                                <div key={loc.id} className="py-4 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium flex items-center gap-2">
                                            {loc.name}
                                            {loc.is_primary && (
                                                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">Primary</span>
                                            )}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            {loc.city || 'No city set'}
                                            {loc.address ? ` · ${loc.address}` : ''}
                                            {loc.phone ? ` · 📞 ${loc.phone}` : ''}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-2 py-1 rounded text-xs ${loc.facility_verification_status === 'approved' ? 'bg-green-100 text-green-700' :
                                            loc.facility_verification_status === 'pending_review' ? 'bg-amber-100 text-amber-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                            {loc.facility_verification_status || 'Draft'}
                                        </span>
                                        {!loc.is_primary && (
                                            <button
                                                onClick={() => handleDeleteLocation(loc.id)}
                                                className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                                title="Delete Location"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                            }
                        </div >
                    )}
                </Card >
            </div >
        )
    }

    // ============================================
    // PERMISSIONS VIEW
    // ============================================

    const ELEVATED_PERMISSIONS = [
        'manage_staff',
        'manage_schedule',
        'approve_leave',
        'edit_attendance',
        'export_payroll',
        'manage_docs_policies',
        'manage_verification',
        'manage_settings'
    ]

    const DEFAULT_ROLES = [
        {
            name: 'Owner',
            description: 'Full access to all features',
            permissions: ELEVATED_PERMISSIONS,
            isSystem: true
        },
        {
            name: 'HR Manager',
            description: 'Manage staff, leave, and attendance',
            permissions: ['manage_staff', 'approve_leave', 'edit_attendance'],
            isSystem: false
        },
        {
            name: 'Shift Manager',
            description: 'Manage schedules and coverage',
            permissions: ['manage_schedule'],
            isSystem: false
        },
        {
            name: 'Payroll Officer',
            description: 'Export payroll and view attendance',
            permissions: ['export_payroll', 'edit_attendance'],
            isSystem: false
        },
        {
            name: 'Staff',
            description: 'Basic employee access only',
            permissions: [],
            isSystem: true
        }
    ]

    const PermissionsView = () => {
        const [roles, setRoles] = useState(DEFAULT_ROLES)
        const [showAddRole, setShowAddRole] = useState(false)
        const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] })

        // Count admin roles used (users with elevated permissions) - exclude SuperAdmin
        const adminSeatsUsed = org.staff.filter(s => {
            if (!s) return false
            // Skip SuperAdmin (platform owner, not a clinic user)
            if (s.role === 'superadmin' || s.email?.includes('@hure.app')) return false
            // Check if user has any elevated permissions via their permission_role
            return s.permission_role && ['HR Manager', 'Shift Manager', 'Payroll Officer', 'Owner'].includes(s.permission_role)
        }).length + 1 // +1 for clinic owner

        const canAddAdmin = adminSeatsUsed < limits.adminSeats

        // Handle role change for a staff member
        const handleRoleChange = async (staffId, newRole) => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            const token = localStorage.getItem('hure_token')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/staff/${staffId}/role`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ role: newRole })
                })
                if (res.ok) {
                    // Update local state
                    setOrg(prev => ({
                        ...prev,
                        staff: prev.staff.map(s =>
                            s.id === staffId ? { ...s, permission_role: newRole } : s
                        )
                    }))
                } else {
                    const err = await res.json()
                    alert(err.error || 'Failed to update role')
                }
            } catch (err) {
                console.error('Role update error:', err)
                alert('Failed to update role')
            }
        }

        const togglePermission = (roleIndex, permission) => {
            if (roles[roleIndex].isSystem) return
            const updated = [...roles]
            const perms = updated[roleIndex].permissions
            if (perms.includes(permission)) {
                updated[roleIndex].permissions = perms.filter(p => p !== permission)
            } else {
                updated[roleIndex].permissions = [...perms, permission]
            }
            setRoles(updated)
        }

        const handleAddRole = (e) => {
            e.preventDefault()
            setRoles([...roles, { ...newRole, isSystem: false }])
            setNewRole({ name: '', description: '', permissions: [] })
            setShowAddRole(false)
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Permissions & Roles</h1>
                        <p className="text-slate-500 text-sm">Define roles and assign permissions to staff</p>
                    </div>
                    <button
                        onClick={() => setShowAddRole(true)}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm"
                    >
                        + Create Role
                    </button>
                </div>

                {/* Admin Roles Usage */}
                <Card>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium">Admin Roles</div>
                            <div className="text-sm text-slate-500">
                                Users with elevated permissions (manage staff, schedule, leave, etc.)
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`text-2xl font-bold ${adminSeatsUsed >= limits.adminSeats ? 'text-red-600' : 'text-primary-600'}`}>
                                {adminSeatsUsed} / {limits.adminSeats}
                            </div>
                            <div className="text-xs text-slate-500">seats used</div>
                        </div>
                    </div>
                    {adminSeatsUsed >= limits.adminSeats && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                            ⚠️ You've reached your plan's admin access limit. Upgrade or change an existing admin to Staff role.
                        </div>
                    )}
                </Card>

                {/* Add Role Form */}
                {showAddRole && (
                    <Card title="Create New Role">
                        <form onSubmit={handleAddRole} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Role Name *</label>
                                    <input
                                        type="text"
                                        value={newRole.name}
                                        onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                                        placeholder="e.g., Compliance Officer"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={newRole.description}
                                        onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                                        placeholder="Brief description of this role"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg">
                                    Create Role
                                </button>
                                <button type="button" onClick={() => setShowAddRole(false)} className="px-4 py-2 border rounded-lg hover:bg-slate-50">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </Card>
                )}

                {/* Roles List */}
                <Card title="Roles">
                    <div className="space-y-4">
                        {roles.map((role, idx) => (
                            <div key={idx} className="p-4 border rounded-lg">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="font-medium flex items-center gap-2">
                                            {role.name}
                                            {role.isSystem && (
                                                <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">System</span>
                                            )}
                                            {role.permissions.length > 0 && (
                                                <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">Admin</span>
                                            )}
                                        </div>
                                        <div className="text-sm text-slate-500">{role.description}</div>
                                    </div>
                                    {!role.isSystem && (
                                        <button className="text-red-600 hover:text-red-700 text-sm">Delete</button>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {ELEVATED_PERMISSIONS.map(perm => (
                                        <label
                                            key={perm}
                                            className={`flex items-center gap-2 p-2 rounded text-sm ${role.isSystem ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={role.permissions.includes(perm)}
                                                onChange={() => togglePermission(idx, perm)}
                                                disabled={role.isSystem}
                                                className="rounded"
                                            />
                                            <span className="capitalize">{perm.replace(/_/g, ' ')}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Staff Role Assignments */}
                <Card title="Staff Role Assignments">
                    {org.staff.filter(s => s && s.role !== 'superadmin' && !s.email?.includes('@hure.app') && s.is_active !== false).length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            No staff members yet. Add staff first to assign roles.
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Staff Member</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Current Role</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Permissions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {org.staff
                                    .filter(s => s && s.role !== 'superadmin' && !s.email?.includes('@hure.app') && s.is_active !== false)
                                    .map(s => {
                                        const staffRole = roles.find(r => r.name === (s.permission_role || 'Staff')) || roles.find(r => r.name === 'Staff')
                                        return (
                                            <tr key={s.id} className="border-t">
                                                <td className="p-3">
                                                    <div className="font-medium">{s.first_name} {s.last_name}</div>
                                                    <div className="text-xs text-slate-500">{s.email}</div>
                                                </td>
                                                <td className="p-3">
                                                    <select
                                                        className="px-3 py-1.5 rounded border border-slate-300 text-sm"
                                                        value={s.permission_role || 'Staff'}
                                                        onChange={(e) => handleRoleChange(s.id, e.target.value)}
                                                        disabled={!canAddAdmin && (s.permission_role || 'Staff') === 'Staff'}
                                                    >
                                                        {roles.map(r => (
                                                            <option key={r.name} value={r.name}>{r.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-3 text-sm text-slate-500">
                                                    {staffRole?.permissions.length ? staffRole.permissions.length + ' elevated' : 'Basic access'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                            </tbody>
                        </table>
                    )}
                </Card>
            </div>
        )
    }



    const BillingView = () => {
        const [showUpgradeModal, setShowUpgradeModal] = useState(false)
        const [upgrading, setUpgrading] = useState(false)

        // Calculate admin roles used (staff with admin roles + owner)
        const adminSeatsUsed = org.staff.filter(s =>
            s.job_title && ['Owner', 'HR Manager', 'Shift Manager', 'Payroll Officer'].includes(s.job_title)
        ).length + 1 // +1 for owner

        const handleUpgrade = async (newPlan) => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            setUpgrading(true)
            try {
                const res = await fetch(`/api/clinics/${clinicId}/plan`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify({ planKey: newPlan })
                })
                if (res.ok) {
                    setOrg(prev => ({ ...prev, plan: newPlan, planStatus: 'active' }))
                    setShowUpgradeModal(false)
                    alert('Plan upgraded successfully! Your data is preserved.')
                } else {
                    alert('Failed to upgrade plan')
                }
            } catch (err) {
                console.error('Upgrade error:', err)
                alert('Failed to upgrade plan')
            } finally {
                setUpgrading(false)
            }
        }

        const plans = [
            { key: 'essential', name: 'Essential', price: 'KES 8,000/mo', locations: 1, staff: 10, adminSeats: 2 },
            { key: 'professional', name: 'Professional', price: 'KES 15,000/mo', locations: 2, staff: 30, adminSeats: 5 },
            { key: 'enterprise', name: 'Enterprise', price: 'KES 25,000/mo', locations: 5, staff: 75, adminSeats: 10 }
        ]

        return (
            <div className="space-y-6">
                <h1 className="text-xl font-bold">Billing</h1>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card title="Current Plan">
                        <div className="text-2xl font-bold text-primary-600 capitalize">{org.plan}</div>
                        <div className="text-sm text-slate-500 mt-1">Status: {org.planStatus}</div>
                    </Card>

                    <Card title="Plan Limits">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>Locations</span>
                                <span className={`font-medium ${org.locationCount >= limits.locations ? 'text-red-600' : ''}`}>
                                    {org.locationCount} / {limits.locations}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Staff</span>
                                <span className={`font-medium ${org.staffCount >= limits.staff ? 'text-red-600' : ''}`}>
                                    {org.staffCount} / {limits.staff}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Admin Roles</span>
                                <span className={`font-medium ${adminSeatsUsed >= limits.adminSeats ? 'text-red-600' : ''}`}>
                                    {adminSeatsUsed} / {limits.adminSeats}
                                </span>
                            </div>
                        </div>
                    </Card>

                    <Card title="Invoices">
                        <div className="text-sm text-slate-500">No invoices yet.</div>
                    </Card>
                </div>

                <Card>
                    <div className="text-center py-8">
                        <div className="text-4xl mb-4">💳</div>
                        <div className="font-medium mb-2">Need to upgrade?</div>
                        <p className="text-slate-500 text-sm mb-4">Upgrade your plan to get more locations, staff slots, and admin roles.</p>
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg"
                        >
                            Upgrade Plan
                        </button>
                    </div>
                </Card>

                {/* Upgrade Modal */}
                {showUpgradeModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold">Upgrade Your Plan</h2>
                                <button onClick={() => setShowUpgradeModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                            </div>

                            <p className="text-sm text-slate-500 mb-6">
                                Your existing staff, locations, and data will be preserved. You only gain access to more capacity.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {plans.map(plan => (
                                    <div
                                        key={plan.key}
                                        className={`p-4 border-2 rounded-xl ${org.plan === plan.key ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}`}
                                    >
                                        <div className="font-bold text-lg">{plan.name}</div>
                                        <div className="text-primary-600 font-bold text-xl mt-2">{plan.price}</div>
                                        <ul className="text-sm text-slate-600 mt-4 space-y-1">
                                            <li>✓ {plan.locations} Location{plan.locations > 1 ? 's' : ''}</li>
                                            <li>✓ {plan.staff} Staff Members</li>
                                            <li>✓ {plan.adminSeats} Admin Roles</li>
                                        </ul>
                                        <button
                                            onClick={() => handleUpgrade(plan.key)}
                                            disabled={upgrading || org.plan === plan.key}
                                            className={`w-full mt-4 py-2 rounded-lg font-medium ${org.plan === plan.key
                                                ? 'bg-slate-100 text-slate-500'
                                                : 'bg-primary-600 hover:bg-primary-700 text-white'
                                                }`}
                                        >
                                            {org.plan === plan.key ? 'Current Plan' : upgrading ? 'Upgrading...' : 'Select Plan'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ============================================
    // SCHEDULE VIEW
    // ============================================

    const ScheduleView = () => {
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

        useEffect(() => {
            fetchSchedules()
        }, [selectedLocation])

        const fetchSchedules = async () => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            try {
                const locQuery = selectedLocation && selectedLocation !== 'all' ? `?locationId=${selectedLocation}` : ''
                const res = await fetch(`/api/clinics/${clinicId}/schedule${locQuery}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    const shiftsWithLocums = data.data || []

                    // Fetch locum counts for each shift
                    for (const shift of shiftsWithLocums) {
                        try {
                            const locumRes = await fetch(`/api/clinics/${clinicId}/schedule/${shift.id}/locums`, {
                                headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
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
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify(newShift)
                })
                if (res.ok) {
                    setShowAddShift(false)
                    setNewShift({ locationId: '', date: '', startTime: '09:00', endTime: '17:00', roleRequired: '', headcountRequired: 1 })
                    fetchSchedules()
                }
            } catch (err) {
                console.error('Create shift error:', err)
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
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${shift.id}/locums`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    setLocums(data.data || [])
                }
            } catch (err) {
                console.error('Fetch locums error:', err)
            }
        }

        // External locum state
        const [coverageTab, setCoverageTab] = useState('staff') // 'staff' | 'locum'
        const [staffSearch, setStaffSearch] = useState('')
        const [locums, setLocums] = useState([])
        const [locumForm, setLocumForm] = useState({ name: '', phone: '', dailyRate: '', supervisorId: '', notes: '' })
        const [addingLocum, setAddingLocum] = useState(false)

        const handleAddLocum = async () => {
            if (!locumForm.name.trim()) {
                alert('Locum name is required')
                return
            }
            setAddingLocum(true)
            const clinicId = localStorage.getItem('hure_clinic_id')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${selectedShift.id}/locums`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
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
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${selectedShift.id}/locums/${locumId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
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
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${selectedShift.id}/locums`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                })
                if (res.ok) {
                    const removedCount = locums.length
                    setLocums([])

                    // Update schedules list count
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
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${shiftId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
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
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/${selectedShift.id}/assign`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify({ userId: staffId })
                })
                const responseData = await res.json()
                if (res.ok) {
                    // Get the new assignment from response
                    const newAssignment = responseData.data

                    // Update selectedShift immediately
                    const updatedShift = {
                        ...selectedShift,
                        schedule_assignments: [...(selectedShift.schedule_assignments || []), newAssignment]
                    }
                    setSelectedShift(updatedShift)

                    // Update schedules list
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
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule/assignments/${assignmentId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                })
                if (res.ok) {
                    // Update selectedShift immediately
                    const updatedShift = {
                        ...selectedShift,
                        schedule_assignments: (selectedShift.schedule_assignments || []).filter(a => a.id !== assignmentId)
                    }
                    setSelectedShift(updatedShift)

                    // Update schedules list
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

        const formatDate = (dateStr) => {
            if (!dateStr) return '-'
            const d = new Date(dateStr)
            const day = String(d.getDate()).padStart(2, '0')
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const year = d.getFullYear()
            return `${day}/${month}/${year}`
        }

        const formatTime = (time) => time?.slice(0, 5)

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Schedule Management</h1>
                        <p className="text-slate-500 text-sm">Create and manage staff shifts</p>
                    </div>
                    <button
                        onClick={() => setShowAddShift(true)}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"
                    >
                        + Create Shift
                    </button>
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
                                        {org.locations.map(loc => (
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
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            📅
                                        </div>
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
                                <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg">
                                    Create Shift
                                </button>
                                <button type="button" onClick={() => setShowAddShift(false)} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">
                                    Cancel
                                </button>
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
                            <div>No shifts scheduled yet. Create your first shift above.</div>
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
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleManageCoverage(shift)}
                                                    disabled={expired}
                                                    className={`px-3 py-1.5 text-sm rounded-lg ${expired ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 text-white'}`}
                                                >
                                                    {expired ? 'Expired' : 'Manage coverage'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteShift(shift.id)}
                                                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 border border-red-300 rounded-lg"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </Card>

                {/* Manage Coverage Modal - Redesigned per client demo */}
                {showManageCoverage && selectedShift && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden">
                            {/* Header */}
                            <div className="p-4 border-b flex items-center justify-between">
                                <h2 className="text-lg font-bold">Manage coverage</h2>
                                <button
                                    onClick={() => { setShowManageCoverage(false); setSelectedShift(null) }}
                                    className="text-slate-400 hover:text-slate-600 text-2xl"
                                >×</button>
                            </div>

                            {/* Shift Info */}
                            <div className="p-4 bg-slate-50 border-b">
                                <div className="font-medium">{formatDate(selectedShift.date)} · {formatTime(selectedShift.start_time)} - {formatTime(selectedShift.end_time)} · {selectedShift.role_required || 'Any Role'}</div>
                                <div className="text-sm text-slate-500">Location: {selectedShift.clinic_locations?.name}</div>
                                <div className="text-sm text-slate-500">Required: {selectedShift.headcount_required} · Assigned: {(selectedShift.schedule_assignments?.length || 0) + locums.length}</div>
                            </div>

                            {/* Toggle Tabs */}
                            <div className="p-4 border-b">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-600">Showing:</span>
                                    <button
                                        onClick={() => setCoverageTab('staff')}
                                        className={`px-3 py-1.5 text-sm rounded-lg border ${coverageTab === 'staff'
                                            ? 'bg-slate-800 text-white border-slate-800'
                                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                                    >
                                        Monthly staff (in-house)
                                    </button>
                                    <button
                                        onClick={() => setCoverageTab('locum')}
                                        className={`px-3 py-1.5 text-sm rounded-lg border ${coverageTab === 'locum'
                                            ? 'bg-teal-600 text-white border-teal-600'
                                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                                    >
                                        External locum
                                    </button>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="p-4 overflow-y-auto max-h-[45vh]">
                                {coverageTab === 'staff' ? (
                                    <>
                                        {/* Currently Assigned */}
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
                                        {/* Available Staff */}
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
                                                {org.staff
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
                                        {/* External Locum Tab */}
                                        <div className="mb-4">
                                            <p className="text-sm text-slate-600 mb-2">Add locum / external cover <span className="text-slate-400">(kept for payroll-ready record later)</span></p>
                                        </div>

                                        {/* Existing Locums */}
                                        {locums.length > 0 ? (
                                            <div className="mb-4">
                                                <h3 className="text-sm font-medium text-slate-700 mb-2">Assigned Locums</h3>
                                                <div className="space-y-2">
                                                    {locums.map(l => (
                                                        <div key={l.id} className="flex items-center justify-between p-2 bg-teal-50 rounded-lg border border-teal-200">
                                                            <div>
                                                                <span className="font-medium text-teal-800">{l.name}</span>
                                                                <span className="ml-2 px-2 py-0.5 text-xs bg-teal-200 text-teal-800 rounded-full">External</span>
                                                                {l.phone && <span className="text-sm text-slate-500 ml-2">{l.phone}</span>}
                                                            </div>
                                                            <button onClick={() => handleRemoveLocum(l.id)} className="text-red-600 hover:text-red-700 text-sm">Remove</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mb-4 p-3 bg-slate-100 rounded-lg text-sm text-slate-500 text-center">
                                                No locums added yet.
                                            </div>
                                        )}

                                        {/* Add Locum Form */}
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">External locum name *</label>
                                                <input
                                                    type="text"
                                                    value={locumForm.name}
                                                    onChange={(e) => setLocumForm({ ...locumForm, name: e.target.value })}
                                                    placeholder="e.g. Jane Wanjiku"
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone (optional)</label>
                                                <input
                                                    type="tel"
                                                    value={locumForm.phone}
                                                    onChange={(e) => setLocumForm({ ...locumForm, phone: e.target.value })}
                                                    placeholder="+254..."
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Daily Rate (KSh) *</label>
                                                <input
                                                    type="number"
                                                    value={locumForm.dailyRate}
                                                    onChange={(e) => setLocumForm({ ...locumForm, dailyRate: e.target.value })}
                                                    placeholder="e.g. 3000"
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Supervisor (optional)</label>
                                                <select
                                                    value={locumForm.supervisorId}
                                                    onChange={(e) => setLocumForm({ ...locumForm, supervisorId: e.target.value })}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500"
                                                >
                                                    <option value="">— Select —</option>
                                                    {org.staff
                                                        .filter(s => s.role !== 'superadmin' && !s.email?.includes('@hure.app') && s.is_active !== false)
                                                        .map(staff => (
                                                            <option key={staff.id} value={staff.id}>{staff.first_name} {staff.last_name}</option>
                                                        ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                                                <input
                                                    type="text"
                                                    value={locumForm.notes}
                                                    onChange={(e) => setLocumForm({ ...locumForm, notes: e.target.value })}
                                                    placeholder="Agency / agreed pay / reporting notes"
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>

                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={() => setLocumForm({ name: '', phone: '', dailyRate: '', supervisorId: '', notes: '' })}
                                                    className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                                                >
                                                    Clear
                                                </button>
                                                <button
                                                    onClick={handleAddLocum}
                                                    disabled={addingLocum || !locumForm.name.trim()}
                                                    className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg disabled:opacity-50"
                                                >
                                                    {addingLocum ? 'Adding...' : 'Add locum'}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t flex justify-between">
                                {coverageTab === 'locum' && locums.length > 0 && (
                                    <button
                                        onClick={handleClearLocums}
                                        className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 border border-red-300 rounded-lg"
                                    >
                                        Clear locums
                                    </button>
                                )}
                                <button
                                    onClick={() => { setShowManageCoverage(false); setSelectedShift(null) }}
                                    className={`px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg ${coverageTab !== 'locum' || locums.length === 0 ? 'w-full' : ''}`}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ============================================
    // ATTENDANCE VIEW
    // ============================================

    const AttendanceView = () => {
        const [attendance, setAttendance] = useState([])
        const [attendanceLoading, setAttendanceLoading] = useState(true)
        const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
        const [endDateFilter, setEndDateFilter] = useState(new Date().toISOString().split('T')[0])
        const [searchName, setSearchName] = useState('')
        const [dateRange, setDateRange] = useState('custom')
        const [staffTypeFilter, setStaffTypeFilter] = useState('all') // 'all', 'internal', 'external'

        useEffect(() => {
            fetchAttendance()
        }, [dateFilter, endDateFilter, selectedLocation])

        const fetchAttendance = async () => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            try {
                // Fetch staff attendance with location filter, but locums without (they're fetched separately in backend)
                const locQuery = selectedLocation && selectedLocation !== 'all' ? `&locationId=${selectedLocation}` : ''
                const url = `/api/clinics/${clinicId}/attendance?startDate=${dateFilter}&endDate=${endDateFilter}&includeLocums=true${locQuery}`
                console.log('Fetching Attendance URL:', url)
                const staffRes = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                })
                let allAttendanceData = []
                let recordedLocumIds = new Set()

                if (staffRes.ok) {
                    const data = await staffRes.json()
                    console.log('=== ATTENDANCE DEBUG ===')
                    console.log('API Version:', data._version)
                    console.log('Raw attendance data:', data.data?.length, 'records')
                    console.log('API Debug info:', data.debug)
                    console.log('Locum records:', data.data?.filter(a => a.type === 'locum' || a.external_locum_id).length)

                    allAttendanceData = (data.data || []).map(a => {
                        // Track which locums already have attendance recorded
                        if (a.external_locum_id) {
                            console.log(`  Adding to recordedLocumIds: ${a.external_locum_id} (${a.locum_name || a.external_locums?.name}), status: ${a.status}`)
                            recordedLocumIds.add(a.external_locum_id)
                            return {
                                ...a,
                                type: 'locum',
                                locum_id: a.external_locum_id,
                                locum_name: a.external_locums?.name || a.locum_name || 'External Locum',
                                locum_role: a.external_locums?.role || a.locum_role,
                                locum_phone: a.external_locums?.phone || a.locum_phone,
                                status: a.status || a.locum_status, // Use status from new table
                                recorded: true
                            }
                        }
                        return { ...a, type: 'staff' }
                    })
                } else {
                    const errData = await staffRes.json()
                    console.error('❌ Attendance API Failed:', errData)
                }
                console.log('recordedLocumIds set:', [...recordedLocumIds])


                // Fetch external locums from today's shifts (only ones NOT already recorded)
                // Fetch external locums from today's shifts (only ones NOT already recorded)
                const scheduleRes = await fetch(`/api/clinics/${clinicId}/schedule?startDate=${dateFilter}&endDate=${dateFilter}${locQuery}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                })

                if (scheduleRes.ok) {
                    const scheduleData = await scheduleRes.json()
                    const shifts = scheduleData.data || []

                    // For each shift, fetch locums
                    for (const shift of shifts) {
                        const locumRes = await fetch(`/api/clinics/${clinicId}/schedule/${shift.id}/locums`, {
                            headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                        })
                        if (locumRes.ok) {
                            const locums = await locumRes.json()
                            for (const locum of (locums.data || [])) {
                                // Skip if already has attendance recorded
                                console.log(`  Checking locum ${locum.name} (${locum.id}) - in recordedLocumIds: ${recordedLocumIds.has(locum.id)}`)
                                if (recordedLocumIds.has(locum.id)) continue

                                allAttendanceData.push({
                                    id: `locum_${locum.id}`,
                                    locum_id: locum.id,
                                    type: 'locum',
                                    locum_name: locum.name,
                                    locum_role: locum.role,
                                    locum_phone: locum.phone,
                                    shift_id: shift.id,
                                    shift_date: shift.date,
                                    shift_time: `${shift.start_time?.slice(0, 5)} - ${shift.end_time?.slice(0, 5)}`,
                                    location_name: shift.clinic_locations?.name,
                                    status: null,
                                    recorded: false
                                })
                            }
                        }
                    }
                }

                setAttendance(allAttendanceData)
            } catch (err) {
                console.error('Fetch attendance error:', err)
            } finally {
                setAttendanceLoading(false)
            }
        }

        const handleLocumAttendance = async (locum, status) => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/attendance/locum`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify({
                        externalLocumId: locum.locum_id,
                        date: dateFilter,
                        status: status
                    })
                })
                if (res.ok) {
                    // Update local state
                    setAttendance(prev => prev.map(a =>
                        a.id === locum.id ? { ...a, status: status, recorded: true } : a
                    ))
                }
            } catch (err) {
                console.error('Record locum attendance error:', err)
            }
        }

        const formatTime = (timeStr) => {
            if (!timeStr) return '-'
            return new Date(timeStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        }

        const getStatusColor = (status) => {
            switch (status) {
                case 'present_full': return 'bg-green-100 text-green-700'
                case 'present_partial': return 'bg-amber-100 text-amber-700'
                case 'absent': return 'bg-red-100 text-red-700'
                case 'late': return 'bg-orange-100 text-orange-700'
                default: return 'bg-slate-100 text-slate-600'
            }
        }

        const setQuickDateRange = (range) => {
            const now = new Date()
            const today = new Date().toISOString().split('T')[0]
            let startDate

            if (range === 'today') {
                startDate = today
            } else if (range === 'week') {
                const dayOfWeek = now.getDay()
                const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
                const weekStart = new Date(now)
                weekStart.setDate(now.getDate() - diff)
                startDate = weekStart.toISOString().split('T')[0]
            } else if (range === 'month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
            }
            setDateFilter(startDate)
            setEndDateFilter(today)
            setDateRange(range)
        }

        const filteredAttendance = attendance.filter(a => {
            // Staff type filter
            if (staffTypeFilter === 'internal' && a.type === 'locum') return false
            if (staffTypeFilter === 'external' && a.type !== 'locum') return false

            const search = searchName.toLowerCase()
            if (!search) return true // Show all if search is empty

            if (a.type === 'locum') {
                // Search locum: name, role, location, status
                const locumName = (a.locum_name || '').toLowerCase()
                const locumRole = (a.locum_role || '').toLowerCase()
                const location = (a.clinic_locations?.name || '').toLowerCase()
                const status = (a.status || a.locum_status || '').toLowerCase()

                return locumName.includes(search) ||
                    locumRole.includes(search) ||
                    location.includes(search) ||
                    status.includes(search)
            } else {
                // Search staff: name, job title, location, status
                const firstName = (a.users?.first_name || '').toLowerCase()
                const lastName = (a.users?.last_name || '').toLowerCase()
                const jobTitle = (a.users?.job_title || '').toLowerCase()
                const location = (a.clinic_locations?.name || '').toLowerCase()
                const status = (a.status || '').toLowerCase()

                return firstName.includes(search) ||
                    lastName.includes(search) ||
                    jobTitle.includes(search) ||
                    location.includes(search) ||
                    status.includes(search)
            }
        })

        return (
            <div className="space-y-6">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-xl font-bold">Attendance Tracking</h1>
                            <p className="text-slate-500 text-sm">Monitor staff attendance and work hours</p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search Input */}
                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="Search employee by name..."
                                value={searchName}
                                onChange={(e) => setSearchName(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>

                        {/* Date Range Quick Filters */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setQuickDateRange('today')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium ${dateRange === 'today' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                            >
                                Today
                            </button>
                            <button
                                onClick={() => setQuickDateRange('week')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium ${dateRange === 'week' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                            >
                                This Week
                            </button>
                            <button
                                onClick={() => setQuickDateRange('month')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium ${dateRange === 'month' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                            >
                                This Month
                            </button>
                        </div>

                        {/* Staff Type Filter */}
                        <div className="flex gap-1 border rounded-lg p-1">
                            <button
                                onClick={() => setStaffTypeFilter('all')}
                                className={`px-3 py-1 rounded text-sm font-medium ${staffTypeFilter === 'all' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setStaffTypeFilter('internal')}
                                className={`px-3 py-1 rounded text-sm font-medium ${staffTypeFilter === 'internal' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                Salaried
                            </button>
                            <button
                                onClick={() => setStaffTypeFilter('external')}
                                className={`px-3 py-1 rounded text-sm font-medium ${staffTypeFilter === 'external' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                External
                            </button>
                        </div>

                        {/* Custom Date Range Picker */}
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-600">From:</label>
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => { setDateFilter(e.target.value); setDateRange('custom') }}
                                className="px-3 py-2 rounded-lg border border-slate-300"
                            />
                            <label className="text-sm text-slate-600">To:</label>
                            <input
                                type="date"
                                value={endDateFilter}
                                onChange={(e) => { setEndDateFilter(e.target.value); setDateRange('custom') }}
                                className="px-3 py-2 rounded-lg border border-slate-300"
                            />
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-green-600">{filteredAttendance.filter(a => a.status === 'present_full').length}</div>
                            <div className="text-sm text-slate-500">Present</div>
                        </div>
                    </Card>
                    <Card>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-amber-600">{filteredAttendance.filter(a => a.status === 'present_partial').length}</div>
                            <div className="text-sm text-slate-500">Partial</div>
                        </div>
                    </Card>
                    <Card>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-red-600">{filteredAttendance.filter(a => a.status === 'absent').length}</div>
                            <div className="text-sm text-slate-500">Absent</div>
                        </div>
                    </Card>
                    <Card>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-primary-600">
                                {filteredAttendance.reduce((sum, a) => sum + (parseFloat(a.total_hours) || 0), 0).toFixed(1)}
                            </div>
                            <div className="text-sm text-slate-500">Total Hours</div>
                        </div>
                    </Card>
                </div>

                {/* Attendance Table */}
                <Card title={`Attendance for ${(() => { const d = new Date(dateFilter); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })()}`}>
                    {attendanceLoading ? (
                        <div className="text-center py-8">Loading...</div>
                    ) : filteredAttendance.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="text-4xl mb-4">⏰</div>
                            <div>No attendance records for this date.</div>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Staff Member</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Clock In</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Clock Out</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Hours</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAttendance.map(record => (
                                    <tr key={record.id} className="border-t">
                                        <td className="p-3">
                                            {record.type === 'locum' ? (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{record.locum_name || 'External Locum'}</span>
                                                        <span className="px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded-full">External</span>
                                                    </div>
                                                    <div className="text-xs text-slate-500">{record.locum_role} · {record.shift_time}</div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="font-medium">{record.users?.first_name || record.user?.first_name} {record.users?.last_name || record.user?.last_name}</div>
                                                    <div className="text-xs text-slate-500">{record.users?.job_title || record.user?.job_title}</div>
                                                </>
                                            )}
                                        </td>
                                        <td className="p-3 text-sm">
                                            {record.type === 'locum' ? <span className="text-slate-400">—</span> : formatTime(record.clock_in)}
                                        </td>
                                        <td className="p-3 text-sm">
                                            {record.type === 'locum' ? <span className="text-slate-400">—</span> : formatTime(record.clock_out)}
                                        </td>
                                        <td className="p-3 text-sm">{record.total_hours ? `${record.total_hours}h` : '-'}</td>
                                        <td className="p-3">
                                            {record.type === 'locum' ? (
                                                record.recorded || record.status ? (
                                                    <span className={`px-2 py-1 rounded text-xs ${record.status === 'WORKED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {record.status}
                                                    </span>
                                                ) : (
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleLocumAttendance(record, 'WORKED')}
                                                            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
                                                        >
                                                            Worked
                                                        </button>
                                                        <button
                                                            onClick={() => handleLocumAttendance(record, 'NO_SHOW')}
                                                            className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                                                        >
                                                            No-Show
                                                        </button>
                                                    </div>
                                                )
                                            ) : (
                                                <span className={`px-2 py-1 rounded text-xs ${getStatusColor(record.status)}`}>
                                                    {record.status?.replace('_', ' ') || 'No clock-out'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            </div>
        )
    }

    // ============================================
    // LEAVE VIEW
    // ============================================

    const LeaveView = () => {
        const [tab, setTab] = useState('requests') // requests | settings
        const [leaveRequests, setLeaveRequests] = useState([])
        const [leaveLoading, setLeaveLoading] = useState(true)
        const [statusFilter, setStatusFilter] = useState('')

        useEffect(() => {
            if (tab === 'requests') fetchLeaveRequests()
        }, [statusFilter, selectedLocation, tab])

        const fetchLeaveRequests = async () => {
            setLeaveLoading(true)
            const clinicId = localStorage.getItem('hure_clinic_id')
            let url = `/api/clinics/${clinicId}/leave?`
            if (statusFilter) url += `status=${statusFilter}&`
            if (selectedLocation && selectedLocation !== 'all') url += `locationId=${selectedLocation}&`

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
            try {
                const res = await fetch(`/api/clinics/${clinicId}/leave/${leaveId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify({ status })
                })
                if (res.ok) {
                    fetchLeaveRequests()
                } else {
                    alert(`Failed to ${status} leave request`)
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
                            Settings
                        </button>
                    </div>
                </div>

                {tab === 'settings' ? (
                    <LeaveTypesManager clinicId={localStorage.getItem('hure_clinic_id')} token={localStorage.getItem('hure_token')} />
                ) : (
                    <>
                        <div className="flex justify-end">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                            >
                                <option value="">All Requests</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>

                        {/* Stats */}
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

                        {/* Leave Requests */}
                        <Card title="Leave Requests">
                            {leaveLoading ? (
                                <div className="text-center py-8">Loading...</div>
                            ) : leaveRequests.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <div className="text-4xl mb-4">🏖️</div>
                                    <div>No leave requests found.</div>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {leaveRequests.map(leave => (
                                        <div key={leave.id} className="py-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl">
                                                    {getLeaveTypeIcon(leave.leave_type)}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{leave.user?.first_name} {leave.user?.last_name}</div>
                                                    <div className="text-sm text-slate-500">
                                                        {leave.leave_type?.charAt(0).toUpperCase() + leave.leave_type?.slice(1)} Leave · {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                                                    </div>
                                                    {leave.reason && <div className="text-xs text-slate-400 mt-1">{leave.reason}</div>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {leave.status === 'pending' ? (
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
                                    ))}
                                </div>
                            )}
                        </Card>
                    </>
                )}
            </div>
        )
    }

    // ============================================
    // SETTINGS VIEW
    // ============================================

    const SettingsView = () => {
        const [settings, setSettings] = useState({
            name: org.name,
            phone: '',
            contact_name: ''
        })
        const [saving, setSaving] = useState(false)

        // Fetch settings when component loads
        useEffect(() => {
            const fetchSettings = async () => {
                const clinicId = localStorage.getItem('hure_clinic_id')
                try {
                    const res = await fetch(`/api/clinics/${clinicId}/settings`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                    })
                    if (res.ok) {
                        const data = await res.json()
                        const clinic = data.clinic || {}
                        setSettings({
                            name: clinic.name || org.name,
                            phone: clinic.phone || '',
                            contact_name: clinic.contact_name || ''
                        })
                    }
                } catch (err) {
                    console.error('Fetch settings error:', err)
                }
            }
            fetchSettings()
        }, [])

        const handleSave = async () => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            setSaving(true)
            try {
                const res = await fetch(`/api/clinics/${clinicId}/settings`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify(settings)
                })
                if (res.ok) {
                    setOrg(prev => ({ ...prev, name: settings.name }))
                }
            } catch (err) {
                console.error('Save settings error:', err)
            } finally {
                setSaving(false)
            }
        }

        return (
            <div className="space-y-6">
                <h1 className="text-xl font-bold">Organization Settings</h1>

                <Card title="General Information">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Organization Name</label>
                            <input
                                type="text"
                                value={settings.name}
                                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Contact Phone</label>
                            <input
                                type="tel"
                                value={settings.phone}
                                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300"
                            />
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </Card>

                <Card title="Deactivate Organization">
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="font-medium text-amber-800 mb-2">Deactivate Organization</div>
                        <p className="text-sm text-amber-700 mb-4">
                            This action will suspend all staff accounts, pause billing, and strictly limit access.
                            <br />
                            <strong>Data will be preserved but read-only.</strong> Only an administrator can reactivate it.
                        </p>
                        <button
                            onClick={async () => {
                                const confirmed = window.confirm(
                                    'Are you sure you want to deactivate this organization?\n\n' +
                                    '• All staff logins will be suspended immediately.\n' +
                                    '• No new shifts, payroll, or documents can be created.\n' +
                                    '• Subscription billing will be paused/cancelled.\n\n' +
                                    'This action is reversible only by contacting support.'
                                )
                                if (confirmed) {
                                    const clinicId = localStorage.getItem('hure_clinic_id')
                                    try {
                                        const res = await fetch(`/api/clinics/${clinicId}/deactivate`, {
                                            method: 'POST',
                                            headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                                        })
                                        if (res.ok) {
                                            alert('Organization deactivated successfully. You will now be logged out.')
                                            localStorage.removeItem('hure_clinic_id')
                                            localStorage.removeItem('hure_token')
                                            window.location.href = '/login'
                                        } else {
                                            alert('Failed to deactivate organization. Please try again.')
                                        }
                                    } catch (err) {
                                        console.error('Deactivate error:', err)
                                        alert('Failed to deactivate organization. Please try again.')
                                    }
                                }
                            }}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm"
                        >
                            Deactivate Organization
                        </button>
                    </div>
                </Card>
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

        // Check for locked features
        if (featuresLocked && ['schedule', 'attendance', 'payroll'].includes(view)) {
            return <LockedView feature={view.charAt(0).toUpperCase() + view.slice(1)} />
        }

        switch (view) {
            case 'dashboard': return <DashboardView />
            case 'staff': return <StaffView />
            case 'schedule': return <ScheduleView />
            case 'attendance': return <AttendanceView />
            case 'payroll': return <PayrollView clinicId={localStorage.getItem('hure_clinic_id')} token={localStorage.getItem('hure_token')} locationId={selectedLocation} />
            case 'leave': return <LeaveView />
            case 'verification': return <VerificationView />
            case 'locations': return <LocationsView />
            case 'permissions': return <PermissionsView />
            case 'settings': return <SettingsView />
            case 'billing': return <BillingView />
            default: return <DashboardView />
        }
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Show plan selection modal if no plan selected */}
            {!loading && !hasPlan && <PlanSelectionModal />}

            <TopBar />
            <div className="flex pt-[53px]">
                <Sidebar />
                <main className="flex-1 p-6 lg:ml-64 overflow-y-auto min-h-[calc(100vh-53px)]">
                    {renderView()}
                </main>
            </div>
        </div>
    )
}
