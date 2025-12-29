import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

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
    }, [])

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
                }
            }

            // Fetch staff
            const staffRes = await fetch(`/api/clinics/${clinicId}/staff`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (staffRes.ok) {
                const staffData = await staffRes.json()
                setOrg(prev => ({
                    ...prev,
                    staff: staffData.data || [],
                    staffCount: staffData.data?.length || 0
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
                price: 'KES 2,500/mo',
                features: ['1 Location', '10 Staff Members', '2 Admin Seats', 'Basic Scheduling', 'Attendance Tracking']
            },
            {
                key: 'professional',
                name: 'Professional',
                price: 'KES 5,000/mo',
                popular: true,
                features: ['2 Locations', '30 Staff Members', '5 Admin Seats', 'Advanced Scheduling', 'Leave Management', 'Payroll Export']
            },
            {
                key: 'enterprise',
                name: 'Enterprise',
                price: 'KES 10,000/mo',
                features: ['5 Locations', '75 Staff Members', '10 Admin Seats', 'All Features', 'Priority Support', 'Custom Integrations']
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
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white
        transform transition-transform lg:transform-none pt-[53px]
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
                {/* User info */}
                <div className="p-4 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center font-bold">
                            {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                            <div className="font-medium">{user?.username || 'Owner'}</div>
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
                {/* Location selector (only for multi-location plans) */}
                {limits.locations > 1 && org.locations.length > 0 && (
                    <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="bg-slate-700 border-none rounded-lg px-3 py-1.5 text-sm"
                    >
                        <option value="all">All Locations</option>
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
                <StatCard icon="📅" label="Today's Shifts" value="-" sublabel="No data yet" />
                <StatCard icon="⏰" label="Present Today" value="-" sublabel="No data yet" />
            </div>

            {/* Compliance Status */}
            <Card title="Compliance Status">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${org.orgVerificationStatus === 'approved' ? 'bg-green-100 text-green-700' :
                            org.orgVerificationStatus === 'under_review' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                            }`}>
                            {org.orgVerificationStatus}
                        </span>
                        <span className="text-sm text-slate-600">Organization Verification</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-600">
                            Facility Licenses: {org.locations.filter(l => l.facility_verification_status === 'approved').length} / {org.locationCount} Approved
                        </span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-600">Staff Licenses: Coming soon</span>
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
        const [newStaff, setNewStaff] = useState({
            first_name: '', last_name: '', email: '', phone: '',
            job_title: '', location_id: '', hourly_rate: ''
        })
        const [adding, setAdding] = useState(false)
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
                        staffCount: prev.staffCount + 1
                    }))
                    setShowAddForm(false)
                    setNewStaff({ first_name: '', last_name: '', email: '', phone: '', job_title: '', location_id: '', hourly_rate: '' })
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

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Staff Management</h1>
                        <p className="text-slate-500 text-sm">{org.staffCount} of {limits.staff} staff used</p>
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate (KSh)</label>
                                    <input
                                        type="number"
                                        value={newStaff.hourly_rate}
                                        onChange={(e) => setNewStaff({ ...newStaff, hourly_rate: e.target.value })}
                                        placeholder="e.g., 500"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    />
                                </div>
                            </div>
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
                )}

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
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Role</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Email</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Location</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {org.staff.map(s => (
                                    <tr key={s.id} className="border-t hover:bg-slate-50">
                                        <td className="p-3 font-medium">{s.first_name} {s.last_name}</td>
                                        <td className="p-3">{s.job_title || s.role}</td>
                                        <td className="p-3 text-sm text-slate-500">{s.email}</td>
                                        <td className="p-3">{s.location?.name || s.clinic_locations?.name || '-'}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs ${s.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {s.is_active !== false ? 'Active' : 'Inactive'}
                                            </span>
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
        const [orgForm, setOrgForm] = useState({ kra_pin: '', business_reg_no: '' })
        const [facForm, setFacForm] = useState({ locationId: '', license_no: '', licensing_body: '', expiry_date: '' })
        const [submitting, setSubmitting] = useState(false)

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
                        <span className={`px-2 py-1 rounded text-xs font-medium ${org.orgVerificationStatus === 'approved' ? 'bg-green-100 text-green-700' :
                            org.orgVerificationStatus === 'under_review' ? 'bg-amber-100 text-amber-700' :
                                org.orgVerificationStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-slate-100 text-slate-600'
                            }`}>
                            {org.orgVerificationStatus}
                        </span>
                    }>
                        <form onSubmit={handleOrgSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">KRA PIN *</label>
                                <input
                                    type="text"
                                    value={orgForm.kra_pin}
                                    onChange={(e) => setOrgForm({ ...orgForm, kra_pin: e.target.value })}
                                    placeholder="e.g., A123456789Z"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                    required
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
                                />
                            </div>
                            {org.orgVerificationStatus === 'approved' ? (
                                <div className="text-green-600 text-sm font-medium">✓ Your organization is verified!</div>
                            ) : org.orgVerificationStatus === 'under_review' ? (
                                <div className="text-amber-600 text-sm font-medium">⏳ Verification under review...</div>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                                >
                                    {submitting ? 'Submitting...' : 'Submit for Review'}
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
        const [newLocation, setNewLocation] = useState({ name: '', city: '', address: '', is_primary: false })
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
                    setNewLocation({ name: '', city: '', address: '', is_primary: false })
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
                )}

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
                                        <div className="text-sm text-slate-500">{loc.city || 'No city set'}{loc.address ? ` · ${loc.address}` : ''}</div>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs ${loc.facility_verification_status === 'approved' ? 'bg-green-100 text-green-700' :
                                        loc.facility_verification_status === 'pending_review' ? 'bg-amber-100 text-amber-700' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                        {loc.facility_verification_status || 'Draft'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
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

        // Count admin seats used (users with elevated permissions)
        const adminSeatsUsed = org.staff.filter(s => {
            // Check if user has any elevated permissions via their role
            return s.job_title && ['HR Manager', 'Shift Manager', 'Payroll Officer', 'Owner'].includes(s.job_title)
        }).length + 1 // +1 for owner

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
                            s.id === staffId ? { ...s, job_title: newRole } : s
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

                {/* Admin Seats Usage */}
                <Card>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium">Admin Seats</div>
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
                    {org.staff.length === 0 ? (
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
                                {org.staff.map(s => {
                                    const staffRole = roles.find(r => r.name === s.job_title) || roles.find(r => r.name === 'Staff')
                                    return (
                                        <tr key={s.id} className="border-t">
                                            <td className="p-3">
                                                <div className="font-medium">{s.first_name} {s.last_name}</div>
                                                <div className="text-xs text-slate-500">{s.email}</div>
                                            </td>
                                            <td className="p-3">
                                                <select
                                                    className="px-3 py-1.5 rounded border border-slate-300 text-sm"
                                                    value={s.job_title || 'Staff'}
                                                    onChange={(e) => handleRoleChange(s.id, e.target.value)}
                                                    disabled={!canAddAdmin && s.job_title === 'Staff'}
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

    // ============================================
    // PAYROLL VIEW
    // ============================================

    const PayrollView = () => {
        const [activeTab, setActiveTab] = useState('salaried')
        const [dateRange, setDateRange] = useState({ start: '', end: '' })
        const [externalCoverage, setExternalCoverage] = useState([])

        // Mock data for demonstration
        const salariedStaff = org.staff.filter(s => !s.pay_type || s.pay_type === 'monthly')
        const dailyStaff = org.staff.filter(s => s.pay_type === 'daily')

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Payroll Export</h1>
                        <p className="text-slate-500 text-sm">Calculate and export payroll based on attendance</p>
                    </div>
                    <button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg">
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
                            <button className="px-3 py-2 border rounded-lg text-sm hover:bg-slate-50">Last Month</button>
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
                    <button
                        onClick={() => setActiveTab('external')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'external' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500'}`}
                    >
                        External Coverage ({externalCoverage.length})
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
                                    {salariedStaff.map(s => (
                                        <tr key={s.id} className="border-t">
                                            <td className="p-3 font-medium">{s.first_name} {s.last_name}</td>
                                            <td className="p-3">{s.job_title || 'Staff'}</td>
                                            <td className="p-3">-</td>
                                            <td className="p-3">-</td>
                                            <td className="p-3">-</td>
                                            <td className="p-3">KSh {(s.monthly_salary || 0).toLocaleString()}</td>
                                            <td className="p-3 font-medium">KSh {(s.monthly_salary || 0).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Card>
                )}

                {/* Daily/Casual Staff Tab */}
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
                                    {dailyStaff.map(s => (
                                        <tr key={s.id} className="border-t">
                                            <td className="p-3 font-medium">{s.first_name} {s.last_name}</td>
                                            <td className="p-3">-</td>
                                            <td className="p-3">-</td>
                                            <td className="p-3">KSh {(s.daily_rate || 0).toLocaleString()}</td>
                                            <td className="p-3 font-medium">KSh 0</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Card>
                )}

                {/* External Coverage Tab */}
                {activeTab === 'external' && (
                    <Card title="External Coverage Register">
                        <p className="text-sm text-slate-500 mb-4">
                            External locums from Schedule → Manage Coverage. Not employees, for records/export only.
                        </p>
                        {externalCoverage.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <div className="text-4xl mb-4">📋</div>
                                <div>No external coverage entries in this period.</div>
                                <p className="text-xs mt-2">External coverage is added via Schedule → Manage Coverage</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Date</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">External Name</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Role</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Location</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Units</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Agreed Pay</th>
                                        <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {externalCoverage.map((ext, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td className="p-3">{ext.date}</td>
                                            <td className="p-3 font-medium">{ext.name}</td>
                                            <td className="p-3">{ext.role}</td>
                                            <td className="p-3">{ext.location}</td>
                                            <td className="p-3">{ext.units}</td>
                                            <td className="p-3">{ext.agreedPay}</td>
                                            <td className="p-3">
                                                <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">Draft</span>
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
    // BILLING VIEW
    // ============================================

    const BillingView = () => {
        const [showUpgradeModal, setShowUpgradeModal] = useState(false)
        const [upgrading, setUpgrading] = useState(false)

        // Calculate admin seats used (staff with admin roles + owner)
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
            { key: 'essential', name: 'Essential', price: 'KES 2,500/mo', locations: 1, staff: 10, adminSeats: 2 },
            { key: 'professional', name: 'Professional', price: 'KES 5,000/mo', locations: 2, staff: 30, adminSeats: 5 },
            { key: 'enterprise', name: 'Enterprise', price: 'KES 10,000/mo', locations: 5, staff: 75, adminSeats: 10 }
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
                                <span>Admin Seats</span>
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
                        <p className="text-slate-500 text-sm mb-4">Upgrade your plan to get more locations, staff slots, and admin seats.</p>
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
                                            <li>✓ {plan.adminSeats} Admin Seats</li>
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
        }, [])

        const fetchSchedules = async () => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/schedule`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    setSchedules(data.data || [])
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

        const formatDate = (dateStr) => {
            const date = new Date(dateStr)
            return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
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
                                    <input
                                        type="date"
                                        value={newShift.date}
                                        onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                                        required
                                    />
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
                            {schedules.map(shift => (
                                <div key={shift.id} className="py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                                            <span className="text-primary-600 font-bold">{formatDate(shift.date).slice(0, 3)}</span>
                                        </div>
                                        <div>
                                            <div className="font-medium">{formatDate(shift.date)}</div>
                                            <div className="text-sm text-slate-500">
                                                {formatTime(shift.start_time)} - {formatTime(shift.end_time)} · {shift.clinic_locations?.name}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-slate-600">{shift.role_required || 'Any role'}</div>
                                        <div className="text-xs text-slate-400">{shift.schedule_assignments?.length || 0} / {shift.headcount_required} assigned</div>
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
    // ATTENDANCE VIEW
    // ============================================

    const AttendanceView = () => {
        const [attendance, setAttendance] = useState([])
        const [attendanceLoading, setAttendanceLoading] = useState(true)
        const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])

        useEffect(() => {
            fetchAttendance()
        }, [dateFilter])

        const fetchAttendance = async () => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            try {
                const res = await fetch(`/api/clinics/${clinicId}/attendance?startDate=${dateFilter}&endDate=${dateFilter}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    setAttendance(data.data || [])
                }
            } catch (err) {
                console.error('Fetch attendance error:', err)
            } finally {
                setAttendanceLoading(false)
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

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Attendance Tracking</h1>
                        <p className="text-slate-500 text-sm">Monitor staff attendance and work hours</p>
                    </div>
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-300"
                    />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-green-600">{attendance.filter(a => a.status === 'present_full').length}</div>
                            <div className="text-sm text-slate-500">Present</div>
                        </div>
                    </Card>
                    <Card>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-amber-600">{attendance.filter(a => a.status === 'present_partial').length}</div>
                            <div className="text-sm text-slate-500">Partial</div>
                        </div>
                    </Card>
                    <Card>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-red-600">{attendance.filter(a => a.status === 'absent').length}</div>
                            <div className="text-sm text-slate-500">Absent</div>
                        </div>
                    </Card>
                    <Card>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-primary-600">
                                {attendance.reduce((sum, a) => sum + (parseFloat(a.total_hours) || 0), 0).toFixed(1)}
                            </div>
                            <div className="text-sm text-slate-500">Total Hours</div>
                        </div>
                    </Card>
                </div>

                {/* Attendance Table */}
                <Card title={`Attendance for ${new Date(dateFilter).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}>
                    {attendanceLoading ? (
                        <div className="text-center py-8">Loading...</div>
                    ) : attendance.length === 0 ? (
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
                                {attendance.map(record => (
                                    <tr key={record.id} className="border-t">
                                        <td className="p-3">
                                            <div className="font-medium">{record.users?.first_name} {record.users?.last_name}</div>
                                            <div className="text-xs text-slate-500">{record.users?.job_title}</div>
                                        </td>
                                        <td className="p-3 text-sm">{formatTime(record.clock_in)}</td>
                                        <td className="p-3 text-sm">{formatTime(record.clock_out)}</td>
                                        <td className="p-3 text-sm">{record.total_hours ? `${record.total_hours}h` : '-'}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(record.status)}`}>
                                                {record.status?.replace('_', ' ') || 'No clock-out'}
                                            </span>
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
        const [leaveRequests, setLeaveRequests] = useState([])
        const [leaveLoading, setLeaveLoading] = useState(true)
        const [statusFilter, setStatusFilter] = useState('')

        useEffect(() => {
            fetchLeaveRequests()
        }, [statusFilter])

        const fetchLeaveRequests = async () => {
            const clinicId = localStorage.getItem('hure_clinic_id')
            const url = statusFilter
                ? `/api/clinics/${clinicId}/leave?status=${statusFilter}`
                : `/api/clinics/${clinicId}/leave`
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
                }
            } catch (err) {
                console.error('Update leave error:', err)
            }
        }

        const formatDate = (dateStr) => {
            return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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
                        <p className="text-slate-500 text-sm">Review and manage staff leave requests</p>
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-300"
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
                                            <div className="font-medium">{leave.users?.first_name} {leave.users?.last_name}</div>
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
                                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(leave.status)}`}>
                                                {leave.status}
                                            </span>
                                        )}
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
    // SETTINGS VIEW
    // ============================================

    const SettingsView = () => {
        const [settings, setSettings] = useState({
            name: org.name,
            phone: '',
            contact_name: ''
        })
        const [saving, setSaving] = useState(false)

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

                <Card title="Danger Zone">
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                        <div className="font-medium text-red-700 mb-2">Delete Organization</div>
                        <p className="text-sm text-red-600 mb-4">This action cannot be undone. All data will be permanently deleted.</p>
                        <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">
                            Delete Organization
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
            case 'payroll': return <PayrollView />
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
                <main className="flex-1 p-6 lg:ml-0">
                    {renderView()}
                </main>
            </div>
        </div>
    )
}
