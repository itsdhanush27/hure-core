import { Link } from 'react-router-dom'

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Navigation */}
            <nav className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
                <div className="text-2xl font-bold text-white">
                    <span className="text-primary-400">HURE</span> Core
                </div>
                <div className="flex items-center gap-4">
                    <Link to="/login" className="text-slate-300 hover:text-white transition">
                        Login
                    </Link>
                    <Link
                        to="/signup"
                        className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition"
                    >
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="max-w-7xl mx-auto px-6 pt-20 pb-32">
                <div className="text-center">
                    <div className="inline-block px-4 py-1 bg-primary-500/10 border border-primary-500/20 rounded-full text-primary-400 text-sm mb-6">
                        Multi-Tenant Staff Management Platform
                    </div>
                    <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                        Streamline Your <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-emerald-400">
                            Clinic Operations
                        </span>
                    </h1>
                    <p className="text-slate-400 text-xl max-w-2xl mx-auto mb-10">
                        Complete staff management solution for healthcare facilities.
                        Schedule, attendance, payroll, and compliance — all in one place.
                    </p>
                    <div className="flex items-center justify-center gap-4">
                        <Link
                            to="/signup"
                            className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg text-lg font-medium transition shadow-lg shadow-primary-500/25"
                        >
                            Start Free Trial
                        </Link>
                        <Link
                            to="/login"
                            className="border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white px-8 py-3 rounded-lg text-lg font-medium transition"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: '👥', title: 'Staff Management', desc: 'Onboard staff, manage roles, track licenses and certifications.' },
                        { icon: '📅', title: 'Smart Scheduling', desc: 'Create shifts, manage coverage gaps, handle external locums.' },
                        { icon: '⏰', title: 'Attendance Tracking', desc: 'Clock in/out, automatic status calculation, review workflow.' },
                        { icon: '💰', title: 'Payroll Export', desc: 'Export salary, daily, and hourly payroll with attendance mapping.' },
                        { icon: '🏥', title: 'Multi-Location', desc: 'Manage multiple clinic locations with per-facility verification.' },
                        { icon: '✅', title: 'Compliance', desc: 'Organization and facility verification with license tracking.' },
                    ].map((feature, i) => (
                        <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-primary-500/50 transition">
                            <div className="text-4xl mb-4">{feature.icon}</div>
                            <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
                            <p className="text-slate-400">{feature.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Pricing Preview */}
                <div className="mt-32">
                    <h2 className="text-3xl font-bold text-white text-center mb-12">Simple, Transparent Pricing</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { name: 'Essential', price: 'KES 2,500', locations: 1, staff: 10, admins: 2, popular: false },
                            { name: 'Professional', price: 'KES 5,000', locations: 2, staff: 30, admins: 5, popular: true },
                            { name: 'Enterprise', price: 'KES 10,000', locations: 5, staff: 75, admins: 10, popular: false },
                        ].map((plan, i) => (
                            <div key={i} className={`relative rounded-xl p-6 ${plan.popular ? 'bg-primary-600 ring-2 ring-primary-400' : 'bg-slate-800/50 border border-slate-700'}`}>
                                {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-400 text-primary-900 text-xs font-semibold rounded-full">
                                        Most Popular
                                    </div>
                                )}
                                <h3 className={`text-xl font-bold mb-2 ${plan.popular ? 'text-white' : 'text-white'}`}>{plan.name}</h3>
                                <div className={`text-3xl font-bold mb-4 ${plan.popular ? 'text-white' : 'text-primary-400'}`}>
                                    {plan.price}<span className="text-sm font-normal opacity-70">/month</span>
                                </div>
                                <ul className={`space-y-2 mb-6 ${plan.popular ? 'text-primary-100' : 'text-slate-400'}`}>
                                    <li>✓ {plan.locations} Location{plan.locations > 1 ? 's' : ''}</li>
                                    <li>✓ {plan.staff} Staff Accounts</li>
                                    <li>✓ {plan.admins} Admin Seats</li>
                                    <li>✓ All Core Features</li>
                                </ul>
                                <Link
                                    to="/signup"
                                    className={`block text-center py-2 rounded-lg font-medium transition ${plan.popular ? 'bg-white text-primary-600 hover:bg-slate-100' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
                                >
                                    Get Started
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800 py-8 text-center text-slate-500">
                <p>© 2024 HURE Core. All rights reserved.</p>
            </footer>
        </div>
    )
}
