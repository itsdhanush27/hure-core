import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../App'

export default function Invite() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { login } = useAuth()

    const token = searchParams.get('token')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [inviteData, setInviteData] = useState(null)
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (!token) {
            setError('Invalid invite link - no token provided')
            setLoading(false)
            return
        }
        validateToken()
    }, [token])

    const validateToken = async () => {
        try {
            const res = await fetch(`/api/auth/invite/${token}`)
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Invalid invite link')
            } else {
                setInviteData(data.user)
            }
        } catch (err) {
            setError('Failed to validate invite')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters')
            return
        }

        setSubmitting(true)
        setError('')

        try {
            const res = await fetch(`/api/auth/invite/${token}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to accept invite')
            }

            // Store credentials and login
            localStorage.setItem('hure_clinic_id', data.user.clinicId)
            login(data.user, data.token)

            // Redirect to employee dashboard
            navigate('/employee')
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Validating invite...</p>
                </div>
            </div>
        )
    }

    if (error && !inviteData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="text-5xl mb-4">❌</div>
                    <h1 className="text-xl font-bold text-slate-800 mb-2">Invalid Invite</h1>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="text-primary-600 hover:underline"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-primary-600 mb-1">HURE</h1>
                    <h2 className="text-xl font-semibold text-slate-800">Welcome Aboard!</h2>
                    <p className="text-slate-500 text-sm mt-2">
                        You've been invited to join <strong>{inviteData?.clinicName}</strong>
                    </p>
                </div>

                {/* User Info */}
                <div className="bg-slate-50 rounded-lg p-4 mb-6">
                    <div className="text-sm text-slate-500 mb-1">Joining as</div>
                    <div className="font-medium text-slate-800">
                        {inviteData?.firstName} {inviteData?.lastName}
                    </div>
                    <div className="text-sm text-slate-600">{inviteData?.email}</div>
                    <div className="text-xs text-primary-600 mt-1">{inviteData?.jobTitle}</div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Create Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="At least 6 characters"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Re-enter password"
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-medium transition disabled:opacity-50"
                    >
                        {submitting ? 'Activating...' : 'Activate Account'}
                    </button>
                </form>

                <p className="text-center text-xs text-slate-500 mt-6">
                    By joining, you agree to HURE's Terms of Service and Privacy Policy
                </p>
            </div>
        </div>
    )
}
