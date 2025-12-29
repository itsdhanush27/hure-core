import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

export default function Signup() {
    const navigate = useNavigate()
    const { login } = useAuth()
    const [step, setStep] = useState(1) // 1: Account, 2: Verify Email
    const [clinicId, setClinicId] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Step 1: Account creation form
    const [formData, setFormData] = useState({
        orgName: '',
        contactName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
    })

    // Step 2: OTP verification
    const [otp, setOtp] = useState('')
    const [otpSent, setOtpSent] = useState(false)

    // Handle account creation
    const handleCreateAccount = async (e) => {
        e.preventDefault()
        setError('')

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match')
            return
        }

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/onboard/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orgName: formData.orgName,
                    contactName: formData.contactName,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Registration failed')

            setClinicId(data.clinicId)
            setStep(2)
            // Automatically send OTP
            await sendOtp(data.clinicId)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Send OTP
    const sendOtp = async (cId) => {
        setLoading(true)
        try {
            const res = await fetch('/api/onboard/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clinicId: cId || clinicId, email: formData.email })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to send OTP')
            setOtpSent(true)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Verify OTP
    const handleVerifyOtp = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await fetch('/api/onboard/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clinicId, code: otp })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Invalid code')

            // Store clinic ID
            localStorage.setItem('hure_clinic_id', clinicId)

            // Auto-login
            login(data.user, data.token)
            navigate('/employer')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-8 mb-8">
                    {[1, 2].map((s) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${step >= s ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                {step > s ? '✓' : s}
                            </div>
                            <span className={`text-sm ${step >= s ? 'text-primary-600 font-medium' : 'text-slate-400'}`}>
                                {s === 1 ? 'Account' : 'Verify Email'}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Step 1: Account Creation */}
                    {step === 1 && (
                        <>
                            <div className="text-center mb-6">
                                <h1 className="text-2xl font-bold text-primary-600 mb-1">HURE</h1>
                                <h2 className="text-xl font-semibold text-slate-800">Create Your Account</h2>
                                <p className="text-slate-500 text-sm">Start managing your clinic operations</p>
                            </div>

                            <form onSubmit={handleCreateAccount} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Organization Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.orgName}
                                        onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                                        placeholder="e.g., Nairobi Medical Centre"
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Contact Person Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.contactName}
                                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                                        placeholder="Your full name"
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Email *
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="you@company.com"
                                            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Phone *
                                        </label>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="+254..."
                                            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Password *
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            placeholder="Min 8 characters"
                                            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Confirm Password *
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.confirmPassword}
                                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                            placeholder="Confirm password"
                                            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-medium transition disabled:opacity-50"
                                >
                                    {loading ? 'Creating Account...' : 'Create Account'}
                                </button>
                            </form>
                        </>
                    )}

                    {/* Step 2: Email Verification */}
                    {step === 2 && (
                        <>
                            <div className="text-center mb-6">
                                <div className="text-5xl mb-4">📧</div>
                                <h2 className="text-xl font-semibold text-slate-800">Verify Your Email</h2>
                                <p className="text-slate-500 text-sm">
                                    We sent a verification code to <strong>{formData.email}</strong>
                                </p>
                            </div>

                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Verification Code
                                    </label>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="Enter 6-digit code"
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-2xl tracking-widest"
                                        maxLength={6}
                                        required
                                    />
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || otp.length < 6}
                                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-medium transition disabled:opacity-50"
                                >
                                    {loading ? 'Verifying...' : 'Verify & Continue'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => sendOtp()}
                                    disabled={loading}
                                    className="w-full text-primary-600 hover:text-primary-700 py-2 text-sm"
                                >
                                    Resend Code
                                </button>
                            </form>
                        </>
                    )}

                    {/* Footer */}
                    <div className="mt-6 text-center text-sm text-slate-500">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                            Sign in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
