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
    // TRANSACTIONS VIEW
    // ============================================

    const TransactionsView = () => {
        const [transactions, setTransactions] = useState([])
        const [loading, setLoading] = useState(true)

        useEffect(() => {
            const fetchTransactions = async () => {
                try {
                    const res = await fetch('/api/admin/transactions', {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                    })
                    if (res.ok) {
                        const data = await res.json()
                        setTransactions(data.transactions || [])
                    }
                } catch (err) {
                    console.error('Fetch transactions error:', err)
                } finally {
                    setLoading(false)
                }
            }
            fetchTransactions()
        }, [])

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Transactions</h1>
                    <p className="text-slate-500">Payment history and subscription transactions</p>
                </div>
                <Card>
                    {loading ? (
                        <div className="text-center py-8">Loading...</div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="text-4xl mb-4">💳</div>
                            <div>No transactions yet</div>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Clinic</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Plan</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Amount</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(t => (
                                    <tr key={t.id} className="border-t hover:bg-slate-50">
                                        <td className="p-3">
                                            <div className="font-medium">{t.clinic_name}</div>
                                            <div className="text-xs text-slate-500">{t.email}</div>
                                        </td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 rounded text-xs bg-primary-100 text-primary-700 capitalize">
                                                {t.plan || 'None'}
                                            </span>
                                        </td>
                                        <td className="p-3 font-medium">KSh {t.amount.toLocaleString()}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs ${t.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-sm text-slate-500">
                                            {new Date(t.created_at).toLocaleDateString('en-GB')}
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
    // SUBSCRIPTIONS VIEW
    // ============================================

    const SubscriptionsView = () => {
        const [subscriptions, setSubscriptions] = useState([])
        const [loading, setLoading] = useState(true)

        useEffect(() => {
            fetchSubscriptions()
        }, [])

        const fetchSubscriptions = async () => {
            try {
                const res = await fetch('/api/admin/subscriptions', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    setSubscriptions(data.subscriptions || [])
                }
            } catch (err) {
                console.error('Fetch subscriptions error:', err)
            } finally {
                setLoading(false)
            }
        }

        const handleStatusChange = async (id, newStatus) => {
            try {
                await fetch(`/api/admin/subscriptions/${id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify({ status: newStatus })
                })
                fetchSubscriptions()
            } catch (err) {
                console.error('Update subscription error:', err)
            }
        }

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Subscriptions</h1>
                    <p className="text-slate-500">Manage active subscriptions and plans</p>
                </div>
                <Card>
                    {loading ? (
                        <div className="text-center py-8">Loading...</div>
                    ) : subscriptions.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="text-4xl mb-4">📦</div>
                            <div>No active subscriptions</div>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Clinic</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Plan</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Amount/mo</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Renewal</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subscriptions.map(s => (
                                    <tr key={s.id} className="border-t hover:bg-slate-50">
                                        <td className="p-3">
                                            <div className="font-medium">{s.clinic_name}</div>
                                            <div className="text-xs text-slate-500">{s.email}</div>
                                        </td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700 capitalize">
                                                {s.plan}
                                            </span>
                                        </td>
                                        <td className="p-3 font-medium">KSh {s.amount.toLocaleString()}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs ${s.status === 'active' ? 'bg-green-100 text-green-700' : s.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-sm text-slate-500">
                                            {new Date(s.renewal_date).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="p-3">
                                            <select
                                                value={s.status}
                                                onChange={(e) => handleStatusChange(s.id, e.target.value)}
                                                className="text-xs border rounded px-2 py-1"
                                            >
                                                <option value="active">Active</option>
                                                <option value="suspended">Suspended</option>
                                                <option value="cancelled">Cancelled</option>
                                            </select>
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
    // PROMOS VIEW
    // ============================================

    const PromosView = () => {
        const [promos, setPromos] = useState([])
        const [loading, setLoading] = useState(true)
        const [showForm, setShowForm] = useState(false)
        const [form, setForm] = useState({ code: '', discount_percent: 10, expires_at: '', max_uses: '', description: '' })

        useEffect(() => {
            fetchPromos()
        }, [])

        const fetchPromos = async () => {
            try {
                const res = await fetch('/api/admin/promos', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    setPromos(data.promos || [])
                }
            } catch (err) {
                console.error('Fetch promos error:', err)
            } finally {
                setLoading(false)
            }
        }

        const handleCreate = async (e) => {
            e.preventDefault()
            try {
                const res = await fetch('/api/admin/promos', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify(form)
                })
                if (res.ok) {
                    setForm({ code: '', discount_percent: 10, expires_at: '', max_uses: '', description: '' })
                    setShowForm(false)
                    fetchPromos()
                } else {
                    alert('Failed to create promo. Make sure the promos table exists in Supabase.')
                }
            } catch (err) {
                console.error('Create promo error:', err)
            }
        }

        const handleDelete = async (id) => {
            if (window.confirm('Delete this promo code?')) {
                try {
                    await fetch(`/api/admin/promos/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                    })
                    fetchPromos()
                } catch (err) {
                    console.error('Delete promo error:', err)
                }
            }
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Promo Codes</h1>
                        <p className="text-slate-500">Create and manage promotional codes</p>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                    >
                        {showForm ? 'Cancel' : '+ New Promo'}
                    </button>
                </div>

                {showForm && (
                    <Card title="Create Promo Code">
                        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Code</label>
                                <input
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                                    placeholder="SUMMER20"
                                    className="w-full px-3 py-2 border rounded-lg"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Discount %</label>
                                <input
                                    type="number"
                                    value={form.discount_percent}
                                    onChange={(e) => setForm({ ...form, discount_percent: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    min="1"
                                    max="100"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Expires</label>
                                <input
                                    type="date"
                                    value={form.expires_at}
                                    onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Max Uses</label>
                                <input
                                    type="number"
                                    value={form.max_uses}
                                    onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                                    placeholder="Unlimited"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <input
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Summer discount campaign"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div className="col-span-2">
                                <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                                    Create Promo
                                </button>
                            </div>
                        </form>
                    </Card>
                )}

                <Card>
                    {loading ? (
                        <div className="text-center py-8">Loading...</div>
                    ) : promos.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="text-4xl mb-4">🎁</div>
                            <div>No promo codes yet. Create one above!</div>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Code</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Discount</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Uses</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Expires</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                                    <th className="text-left p-3 text-sm font-medium text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {promos.map(p => (
                                    <tr key={p.id} className="border-t hover:bg-slate-50">
                                        <td className="p-3 font-mono font-bold">{p.code}</td>
                                        <td className="p-3">{p.discount_percent}%</td>
                                        <td className="p-3">{p.uses_count || 0} / {p.max_uses || '∞'}</td>
                                        <td className="p-3 text-sm">{p.expires_at ? new Date(p.expires_at).toLocaleDateString('en-GB') : 'Never'}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {p.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-700 text-sm">
                                                Delete
                                            </button>
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
    // AUDIT LOG VIEW
    // ============================================

    const AuditLogView = () => {
        const [events, setEvents] = useState([])
        const [loading, setLoading] = useState(true)

        useEffect(() => {
            const fetchAudit = async () => {
                try {
                    const res = await fetch('/api/admin/audit', {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                    })
                    if (res.ok) {
                        const data = await res.json()
                        setEvents(data.events || [])
                    }
                } catch (err) {
                    console.error('Fetch audit error:', err)
                } finally {
                    setLoading(false)
                }
            }
            fetchAudit()
        }, [])

        const getEventIcon = (type) => {
            const icons = {
                clinic_registered: '🏥',
                org_verified: '✅',
                plan_changed: '📦',
                user_login: '👤',
                default: '📋'
            }
            return icons[type] || icons.default
        }

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Audit Log</h1>
                    <p className="text-slate-500">System activity and event history</p>
                </div>
                <Card>
                    {loading ? (
                        <div className="text-center py-8">Loading...</div>
                    ) : events.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="text-4xl mb-4">📋</div>
                            <div>No audit events recorded yet</div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {events.map(e => (
                                <div key={e.id} className="flex items-start gap-4 p-3 border-b border-slate-100 last:border-0">
                                    <div className="text-2xl">{getEventIcon(e.event_type)}</div>
                                    <div className="flex-1">
                                        <div className="font-medium">{e.description || e.event_type}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-2">
                                            <span>{new Date(e.created_at).toLocaleString('en-GB', {
                                                day: '2-digit', month: '2-digit', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}</span>
                                            {e.clinic_id && <span className="text-slate-400">• ID: {e.clinic_id.slice(0, 8)}...</span>}
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-600">
                                        {e.event_type}
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
    // SITE CONTENT VIEW
    // ============================================

    const SiteContentView = () => {
        const [content, setContent] = useState({})
        const [loading, setLoading] = useState(true)
        const [saving, setSaving] = useState(false)

        useEffect(() => {
            const fetchContent = async () => {
                try {
                    const res = await fetch('/api/admin/content', {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
                    })
                    if (res.ok) {
                        const data = await res.json()
                        setContent(data.content || {})
                    }
                } catch (err) {
                    console.error('Fetch content error:', err)
                } finally {
                    setLoading(false)
                }
            }
            fetchContent()
        }, [])

        const handleSave = async () => {
            setSaving(true)
            try {
                await fetch('/api/admin/content', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
                    },
                    body: JSON.stringify(content)
                })
                alert('Content saved successfully!')
            } catch (err) {
                console.error('Save content error:', err)
                alert('Failed to save content')
            } finally {
                setSaving(false)
            }
        }

        if (loading) {
            return <div className="text-center py-8">Loading...</div>
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Site Content</h1>
                        <p className="text-slate-500">Manage homepage and site settings</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

                <Card title="Homepage Hero">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Hero Title</label>
                            <input
                                value={content.hero_title || ''}
                                onChange={(e) => setContent({ ...content, hero_title: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="Streamline Your Workforce Operations"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Hero Subtitle</label>
                            <textarea
                                value={content.hero_subtitle || ''}
                                onChange={(e) => setContent({ ...content, hero_subtitle: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                                rows={2}
                                placeholder="Complete staff management solution for your organization."
                            />
                        </div>
                    </div>
                </Card>

                <Card title="Pricing (KSh)">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Essential</label>
                            <input
                                type="number"
                                value={content.pricing_essential || 8000}
                                onChange={(e) => setContent({ ...content, pricing_essential: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Professional</label>
                            <input
                                type="number"
                                value={content.pricing_professional || 15000}
                                onChange={(e) => setContent({ ...content, pricing_professional: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Enterprise</label>
                            <input
                                type="number"
                                value={content.pricing_enterprise || 25000}
                                onChange={(e) => setContent({ ...content, pricing_enterprise: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>
                    </div>
                </Card>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                    <strong>Note:</strong> To persist changes, you need to create a 'site_content' table in Supabase with columns: id (uuid), key (text, unique), value (text), updated_at (timestamp).
                </div>
            </div>
        )
    }

    const SettingsView = () => (
        <div className="text-center py-20">
            <div className="text-6xl mb-4">⚙️</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Settings</h2>
            <p className="text-slate-500">Admin settings coming soon...</p>
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
            case 'transactions': return <TransactionsView />
            case 'subscriptions': return <SubscriptionsView />
            case 'audit': return <AuditLogView />
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
                        <NavBtn icon="📋" label="Audit" active={view === 'audit'} onClick={() => setView('audit')} />
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
