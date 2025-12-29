import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

// MOCK MODE - Set to false when backend is ready
const MOCK_MODE = false

export default function Login() {
    const navigate = useNavigate()
    const { login } = useAuth()
    const [formData, setFormData] = useState({ identifier: '', password: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        // === MOCK LOGIN FOR TESTING ===
        if (MOCK_MODE) {
            const id = formData.identifier.toLowerCase().trim()

            // Mock users based on identifier
            const mockUsers = {
                employer: {
                    id: 'mock-employer-1',
                    email: 'employer@demo.com',
                    username: 'employer',
                    role: 'owner',
                    clinicId: 'mock-clinic-1',
                    clinicName: 'Demo Medical Centre'
                },
                employee: {
                    id: 'mock-employee-1',
                    email: 'employee@demo.com',
                    username: 'employee',
                    role: 'staff',
                    clinicId: 'mock-clinic-1',
                    firstName: 'John',
                    lastName: 'Doe'
                },
                admin: {
                    id: 'mock-admin-1',
                    email: 'admin@hure.app',
                    username: 'superadmin',
                    role: 'superadmin'
                }
            }

            const mockUser = mockUsers[id] || mockUsers.employer

            setTimeout(() => {
                localStorage.setItem('hure_clinic_id', mockUser.clinicId || '')
                login(mockUser, 'mock-token-12345')

                if (mockUser.role === 'superadmin') {
                    navigate('/admin')
                } else if (mockUser.role === 'staff') {
                    navigate('/employee')
                } else {
                    navigate('/employer')
                }
            }, 500)
            return
        }
        // === END MOCK LOGIN ===

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Login failed')
            }

            // Store clinic ID
            if (data.user?.clinicId) {
                localStorage.setItem('hure_clinic_id', data.user.clinicId)
            }

            // Login via context
            login(data.user, data.token)

            // Redirect based on role
            if (data.user.role === 'superadmin') {
                navigate('/admin')
            } else if (data.user.role === 'staff') {
                navigate('/employee')
            } else {
                navigate('/employer')
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }


    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-primary-600 mb-1">HURE</h1>
                        <h2 className="text-xl font-semibold text-slate-800">Welcome Back</h2>
                        <p className="text-slate-500 text-sm">Sign in to your account</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Username or Email
                            </label>
                            <input
                                type="text"
                                value={formData.identifier}
                                onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                                placeholder="Enter your email or username"
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder="Enter your password"
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
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
                            disabled={loading}
                            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 text-center">
                        <Link to="/" className="text-primary-600 hover:text-primary-700 text-sm">
                            Back to Home
                        </Link>
                    </div>

                    <div className="mt-4 text-center text-sm text-slate-500">
                        Don't have an account?{' '}
                        <Link to="/signup" className="text-primary-600 hover:text-primary-700 font-medium">
                            Sign up
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
