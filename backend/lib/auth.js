import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'hure-dev-secret-key-min-32-chars'

export function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}


// Role Definitions (Must match frontend)
export const ROLE_PERMISSIONS = {
    'Staff': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile'],
    'Shift Manager': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'team_schedule', 'manage_schedule', 'payroll', 'manage_staff'],
    'HR Manager': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'staff_list', 'manage_staff', 'approve_leave', 'team_attendance', 'manage_schedule'],
    'Payroll Officer': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'team_attendance', 'payroll', 'manage_schedule'],
    'Owner': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'team_schedule', 'manage_schedule', 'staff_list', 'manage_staff', 'approve_leave', 'team_attendance', 'payroll', 'settings'],
    'Employer': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'team_schedule', 'manage_schedule', 'staff_list', 'manage_staff', 'approve_leave', 'team_attendance', 'payroll', 'settings']
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET)
    } catch (err) {
        console.error('❌ Token verification error:', err.message)
        return null
    }
}

// Middleware to protect routes
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('❌ authMiddleware: No token provided. Header:', authHeader)
        return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = verifyToken(token)

    if (!decoded) {
        console.log('❌ authMiddleware: Token verification failed for token:', token.substring(0, 10) + '...')
        return res.status(401).json({ error: 'Invalid or expired token' })
    }

    req.user = decoded
    next()
}

// Middleware to check if user is superadmin
export function superadminMiddleware(req, res, next) {
    if (req.user?.role !== 'superadmin') {
        return res.status(403).json({ error: 'SuperAdmin access required' })
    }
    next()
}

// Middleware to check for specific permission
export function requirePermission(permission) {
    return (req, res, next) => {
        // Superadmin bypass
        if (req.user?.role === 'superadmin' || req.user?.email?.includes('@hure.app')) {
            return next()
        }

        let userRole = req.user?.permission_role || req.user?.role || 'Staff'

        // Normalize role name (capitalize first letter) to match ROLE_PERMISSIONS keys
        // e.g. 'owner' -> 'Owner', 'staff' -> 'Staff'
        if (userRole && /^[a-z]/.test(userRole)) {
            userRole = userRole.charAt(0).toUpperCase() + userRole.slice(1)
        }

        const permissions = ROLE_PERMISSIONS[userRole] || []

        if (!permissions.includes(permission)) {
            console.log(`❌ Access denied: User ${req.user?.userId} (${userRole}) needs permission '${permission}'`)
            return res.status(403).json({
                error: `Access denied: Insufficient permissions. Role '${userRole}' cannot '${permission}'.`
            })
        }
        next()
    }
}


