import 'dotenv/config'
import express from 'express'
import cors from 'cors'

// Import routes
import authRoutes from './routes/auth.js'
import onboardRoutes from './routes/onboard.js'
import clinicsRoutes from './routes/clinics.js'
import locationsRoutes from './routes/locations.js'
import staffRoutes from './routes/staff.js'
import scheduleRoutes from './routes/schedule.js'
import attendanceRoutes from './routes/attendance.js'
import leaveRoutes from './routes/leave.js'
import adminRoutes from './routes/admin.js'
import employeeRoutes from './routes/employee.js'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`)
    next()
})

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/onboard', onboardRoutes)
app.use('/api/clinics', clinicsRoutes)
app.use('/api/clinics/:clinicId/locations', locationsRoutes)
app.use('/api/clinics/:clinicId/staff', staffRoutes)
app.use('/api/clinics/:clinicId/schedule', scheduleRoutes)
app.use('/api/clinics/:clinicId/attendance', attendanceRoutes)
app.use('/api/clinics/:clinicId/leave', leaveRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/employee', employeeRoutes)

// Route summary
console.log('\n📋 Available Routes:')
console.log('   POST         /api/auth/login')
console.log('   POST         /api/onboard/register')
console.log('   POST         /api/onboard/verify-email')
console.log('   POST         /api/onboard/verify-otp')
console.log('   GET/PATCH    /api/clinics/:clinicId/settings')
console.log('   GET/POST     /api/clinics/:clinicId/locations')
console.log('   GET/POST     /api/clinics/:clinicId/staff')
console.log('   GET/POST     /api/clinics/:clinicId/schedule')
console.log('   GET/POST     /api/clinics/:clinicId/attendance')
console.log('   GET/POST     /api/clinics/:clinicId/leave')
console.log('   GET          /api/admin/clinics')
console.log('   GET          /api/admin/verifications/pending')
console.log('   GET          /api/employee/profile')
console.log('   GET          /api/employee/schedule')
console.log('   GET          /api/employee/attendance')

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err)
    res.status(500).json({ error: 'Internal server error' })
})

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' })
})

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 HURE Core Backend running on http://localhost:${PORT}`)
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
})
