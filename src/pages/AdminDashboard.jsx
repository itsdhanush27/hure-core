import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

// Plan configuration
const PLANS = {
    core: [
        { key: 'essential', name: 'Essential', price: 'KSh 8,000', staff: '10 staff' },
        { key: 'professional', name: 'Professional', price: 'KSh 15,000', staff: '30 staff' },
        { key: 'enterprise', name: 'Enterprise', price: 'KSh 25,000', staff: '75 staff' }
    ],
    care: [
        { key: 'care_standard', name: 'Care Standard', price: 'KSh 10,000', staff: 'Unlimited staff' },
        { key: 'care_professional', name: 'Care Professional', price: 'KSh 18,000', staff: 'Unlimited staff' },
        { key: 'care_enterprise', name: 'Care Enterprise', price: 'KSh 30,000', staff: 'Unlimited staff' }
    ]
}

export default function AdminDashboard() {
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const [view, setView] = useState('dashboard')
    const [loading, setLoading] = useState(true)
    const [clinics, setClinics] = useState([])
    const [pendingVerifications, setPendingVerifications] = useState([])
    const [auditEvents, setAuditEvents] = useState([])

    useEffect(() => {
        fetchData()
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchData, 30000)
        return () => clearInterval(interval)
    }, [])

    const fetchData = async () => {
        setLoading(true)
        const token = localStorage.getItem('hure_token')
        try {
            // Fetch clinics
            const clinicsRes = await fetch('/api/admin/clinics', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (clinicsRes.ok) {
                const data = await clinicsRes.json()
                setClinics(data.clinics || [])
            }

            // Fetch pending verifications
            const verRes = await fetch('/api/admin/verifications/pending', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (verRes.ok) {
                const data = await verRes.json()
                setPendingVerifications(data.verifications || [])
            }
        } catch (err) {
            console.error('Fetch error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleVerification = async (type, id, status) => {
        const token = localStorage.getItem('hure_token')
        try {
            const url = type === 'organization'
                ? `/api/admin/clinics/${id}/org-verification`
                : `/api/admin/locations/${id}/facility-verification`

            const res = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            })

            if (res.ok) {
                fetchData() // Refresh data
            }
        } catch (err) {
            console.error('Verification error:', err)
        }
    }

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    // ============================================
    // COMPONENTS
    // ============================================

    const Card = ({ title, children, className = '' }) => (
        <div className={`bg-white rounded-xl border border-slate-200 ${className}`}>
            {title && (
                <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800">{title}</h3>
                </div>
            )}
            <div className="p-4">{children}</div>
        </div>
    )

    const StatCard = ({ label, value, color = 'primary', bgColor }) => (
        <div className={`bg-white rounded-xl p-5 border ${bgColor || ''}`} style={{ background: bgColor }}>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{label}</div>
            <div className={`text-3xl font-bold text-${color}-600`}>{value}</div>
        </div>
    )

    const NavBtn = ({ icon, label, active, onClick, badge }) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left text-sm transition ${active ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
        >
            <span>{icon}</span>
            <span>{label}</span>
            {badge > 0 && (
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${active ? 'bg-white/20' : 'bg-amber-500 text-white'
                    }`}>
                    {badge}
                </span>
            )}
        </button>
    )

    // ============================================
    // DASHBOARD VIEW
    // ============================================

    const DashboardView = () => {
        const activeClinics = clinics.filter(c => c.status === 'active').length
        const pendingOnboarding = clinics.filter(c => c.status === 'pending_verification').length

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
                        <p className="text-slate-500">Manage your platform with ease</p>
                    </div>
                    <button
                        onClick={fetchData}
                        className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                    >
                        <span>🔄</span> Refresh Data
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-primary-50 to-cyan-50 rounded-xl p-5 border border-primary-100">
                        <div className="text-xs font-medium text-primary-600 uppercase tracking-wider mb-2">Total Clinics</div>
                        <div className="text-3xl font-bold text-primary-700">{clinics.length}</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
                        <div className="text-xs font-medium text-green-600 uppercase tracking-wider mb-2">Active Clinics</div>
                        <div className="text-3xl font-bold text-green-700">{activeClinics}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-5 border border-purple-100">
                        <div className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-2">Active Bundles</div>
                        <div className="text-3xl font-bold text-purple-700">{clinics.filter(c => c.plan_key?.includes('care')).length}</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-100">
                        <div className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-2">Pending</div>
                        <div className="text-3xl font-bold text-amber-700">{pendingOnboarding}</div>
                    </div>
                </div>

                {/* Plans Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span>
                            <h3 className="font-semibold">Core Plans</h3>
                        </div>
                        <div className="space-y-3">
                            {PLANS.core.map(plan => (
                                <div key={plan.key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                                    <span className="font-medium">{plan.name}</span>
                                    <span className="text-slate-500 text-sm">{plan.price} · {plan.staff}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                    <Card>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                            <h3 className="font-semibold">Care Plans</h3>
                        </div>
                        <div className="space-y-3">
                            {PLANS.care.map(plan => (
                                <div key={plan.key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                                    <span className="font-medium">{plan.name}</span>
                                    <span className="text-slate-500 text-sm">{plan.price} · {plan.staff}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Recent Audit Events */}
                <Card>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                        <h3 className="font-semibold">Recent Audit Events</h3>
                    </div>
                    {clinics.slice(0, 5).map(c => (
                        <div key={c.id} className="py-3 border-b border-slate-100 last:border-0">
                            <div className="font-medium text-sm">New clinic registered</div>
                            <div className="text-xs text-slate-500">
                                {c.name} · {new Date(c.created_at).toLocaleString('en-GB', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </div>
                        </div>
                    ))}
                </Card>
            </div>
        )
    }

    // ============================================
    // PENDING ONBOARDING VIEW
    // ============================================

    const PendingOnboardingView = () => {
        const pending = clinics.filter(c => c.status === 'pending_verification' || !c.email_verified)

        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">Pending Onboarding</h1>
                <p className="text-slate-500">Clinics that haven't completed their setup</p>

                <Card>
                    {pending.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="text-4xl mb-4">✅</div>
                            <div>All clinics have completed onboarding!</div>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Clinic</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Email Verified</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pending.map(c => (
                                    <tr key={c.id} className="border-t">
                                        <td className="p-3">
                                            <div className="font-medium">{c.name}</div>
                                            <div className="text-xs text-slate-500">{c.email}</div>
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs ${c.email_verified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {c.email_verified ? 'Yes' : 'No'}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-sm text-slate-500">
                                            {new Date(c.created_at).toLocaleDateString('en-GB')}
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
    // VERIFICATIONS VIEW
    // ============================================

    const VerificationsView = () => (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Pending Verifications</h1>
            <p className="text-slate-500">Review and approve clinic verification requests</p>

            <Card>
                {pendingVerifications.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <div className="text-4xl mb-4">✅</div>
                        <div>No pending verifications!</div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pendingVerifications.map(v => (
                            <div key={v.id} className="p-4 border rounded-xl bg-slate-50">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 text-xs rounded ${v.type === 'organization' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                {v.type === 'organization' ? 'ORG' : 'FACILITY'}
                                            </span>
                                            <span className="font-semibold text-lg">{v.clinic_name || v.name}</span>
                                        </div>
                                        {v.type === 'organization' ? (
                                            <div className="text-sm text-slate-600 space-y-1">
                                                <div><strong>Email:</strong> {v.email}</div>
                                                <div><strong>KRA PIN:</strong> {v.kra_pin || 'Not provided'}</div>
                                                <div><strong>Business Reg:</strong> {v.business_reg_no || 'Not provided'}</div>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-600 space-y-1">
                                                <div><strong>Location:</strong> {v.name}</div>
                                                <div><strong>License:</strong> {v.license_no || 'Not provided'}</div>
                                                <div><strong>Authority:</strong> {v.licensing_body || 'Not provided'}</div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleVerification(v.type, v.id, 'approved')}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                                        >
                                            ✓ Approve
                                        </button>
                                        <button
                                            onClick={() => handleVerification(v.type, v.id, 'rejected')}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
                                        >
                                            ✗ Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    )

    // ============================================
    // CLINICS VIEW
    // ============================================

    const ClinicsView = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">All Clinics</h1>
                    <p className="text-slate-500">{clinics.length} clinics registered</p>
                </div>
                <button onClick={fetchData} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                    🔄 Refresh
                </button>
            </div>

            <Card>
                <table className="w-full">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="text-left p-3 text-sm font-medium text-slate-600">Clinic</th>
                            <th className="text-left p-3 text-sm font-medium text-slate-600">Plan</th>
                            <th className="text-left p-3 text-sm font-medium text-slate-600">Org Status</th>
                            <th className="text-left p-3 text-sm font-medium text-slate-600">Account</th>
                            <th className="text-left p-3 text-sm font-medium text-slate-600">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clinics.map(c => (
                            <tr key={c.id} className="border-t hover:bg-slate-50">
                                <td className="p-3">
                                    <div className="font-medium">{c.name}</div>
                                    <div className="text-xs text-slate-500">{c.email}</div>
                                </td>
                                <td className="p-3">
                                    <span className="px-2 py-1 rounded text-xs bg-primary-100 text-primary-700 capitalize">
                                        {c.plan_key || 'No plan'}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs ${c.org_verification_status === 'approved' ? 'bg-green-100 text-green-700' :
                                        c.org_verification_status === 'under_review' ? 'bg-amber-100 text-amber-700' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                        {c.org_verification_status || 'pending'}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs ${c.status === 'active' ? 'bg-green-100 text-green-700' :
                                        c.status === 'suspended' ? 'bg-red-100 text-red-700' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>
                                        {c.status}
                                    </span>
                                </td>
                                <td className="p-3 text-sm text-slate-500">
                                    {new Date(c.created_at).toLocaleDateString('en-GB')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    )

    // ============================================
    // PLACEHOLDER VIEW
    // ============================================

    const PlaceholderView = ({ title, icon }) => (
        <div className="text-center py-20">
            <div className="text-6xl mb-4">{icon}</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">{title}</h2>
            <p className="text-slate-500">Coming soon...</p>
        </div>
    )

    // ============================================
    // RENDER
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
            case 'dashboard': return <DashboardView />
            case 'onboarding': return <PendingOnboardingView />
            case 'verifications': return <VerificationsView />
            case 'clinics': return <ClinicsView />
            case 'transactions': return <PlaceholderView title="Transactions" icon="💳" />
            case 'subscriptions': return <PlaceholderView title="Subscriptions" icon="📦" />
            case 'promos': return <PlaceholderView title="Promos" icon="🎁" />
            case 'audit': return <PlaceholderView title="Audit Log" icon="📋" />
            case 'content': return <PlaceholderView title="Site Content" icon="📝" />
            case 'settings': return <PlaceholderView title="Settings" icon="⚙️" />
            default: return <DashboardView />
        }
    }

    return (
        <div className="min-h-screen bg-slate-100">
            {/* TopBar */}
            <header className="fixed top-0 left-0 right-0 h-14 bg-slate-800 text-white flex items-center justify-between px-6 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center font-bold">H</div>
                    <div>
                        <div className="font-bold text-sm">HURE</div>
                        <div className="text-xs text-slate-400">SuperAdmin Panel</div>
                    </div>
                </div>
                <button onClick={handleLogout} className="text-slate-400 hover:text-white text-sm">
                    Logout
                </button>
            </header>

            <div className="flex pt-14">
                {/* Sidebar */}
                <aside className="fixed w-56 h-[calc(100vh-56px)] bg-slate-900 text-white p-3 overflow-y-auto">
                    <nav className="space-y-1">
                        <NavBtn icon="📊" label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
                        <NavBtn icon="⏳" label="Pending Onboarding" active={view === 'onboarding'} onClick={() => setView('onboarding')} badge={clinics.filter(c => c.status === 'pending_verification').length} />
                        <NavBtn icon="✅" label="Verifications" active={view === 'verifications'} onClick={() => setView('verifications')} badge={pendingVerifications.length} />
                        <NavBtn icon="🏥" label="Clinics" active={view === 'clinics'} onClick={() => setView('clinics')} />
                        <NavBtn icon="💳" label="Transactions" active={view === 'transactions'} onClick={() => setView('transactions')} />
                        <NavBtn icon="📦" label="Subscriptions" active={view === 'subscriptions'} onClick={() => setView('subscriptions')} />
                        <NavBtn icon="🎁" label="Promos" active={view === 'promos'} onClick={() => setView('promos')} />
                        <NavBtn icon="📋" label="Audit" active={view === 'audit'} onClick={() => setView('audit')} />
                        <NavBtn icon="📝" label="Site Content" active={view === 'content'} onClick={() => setView('content')} />
                        <NavBtn icon="⚙️" label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />
                    </nav>
                </aside>

                {/* Main */}
                <main className="flex-1 ml-56 p-6 min-h-[calc(100vh-56px)]">
                    {renderView()}
                </main>
            </div>
        </div>
    )
}
