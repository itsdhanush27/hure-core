import jwt from 'jsonwebtoken'
import { supabaseAdmin } from './supabase.js'

const JWT_SECRET = process.env.JWT_SECRET || 'hure-dev-secret-key-min-32-chars'

export function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}


// Role Definitions (Must match frontend)
// Role Definitions (Must match frontend)
export const ROLE_PERMISSIONS = {
    'Staff': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile'],
    'Shift Manager': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'team_schedule', 'manage_schedule', 'payroll', 'manage_staff'],
    'HR Manager': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'staff_list', 'manage_staff', 'approve_leave', 'team_attendance', 'manage_schedule', 'edit_attendance', 'manage_settings', 'manage_verification', 'manage_docs_policies'],
    'Payroll Officer': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'team_attendance', 'payroll', 'manage_schedule', 'export_payroll'],
    'Owner': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'team_schedule', 'manage_schedule', 'staff_list', 'manage_staff', 'approve_leave', 'team_attendance', 'payroll', 'export_payroll', 'manage_settings', 'manage_verification', 'manage_docs_policies', 'edit_attendance'],
    'Employer': ['my_schedule', 'my_attendance', 'my_leave', 'my_profile', 'team_schedule', 'manage_schedule', 'staff_list', 'manage_staff', 'approve_leave', 'team_attendance', 'payroll', 'export_payroll', 'manage_settings', 'manage_verification', 'manage_docs_policies', 'edit_attendance']
}

// Get all unique permissions across all roles
export function getAllPermissions() {
    const allPerms = new Set()
    Object.values(ROLE_PERMISSIONS).forEach(perms => {
        perms.forEach(p => allPerms.add(p))
    })
    return Array.from(allPerms).sort()
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
    return async (req, res, next) => {
        // Superadmin bypass
        if (req.user?.role === 'superadmin' || req.user?.email?.includes('@hure.app')) {
            return next()
        }

        // Owner/Employer bypass (Always treat owner as Owner regardless of assigned permission_role)
        if (req.user?.role === 'owner' || req.user?.role === 'employer') {
            const ownerPerms = ROLE_PERMISSIONS['Owner']
            if (ownerPerms.includes(permission)) {
                return next()
            }
            // Fallthrough to check if mapped elsewhere, but usually Owner list is definitive.
        }

        let originalRole = req.user?.permission_role || req.user?.role || 'Staff'

        // Safe check: if owner role, force Key to 'Owner' for system lookup
        let systemRoleKey = originalRole
        if (req.user?.role === 'owner') systemRoleKey = 'Owner'

        // Normalize role name (capitalize first letter) to match ROLE_PERMISSIONS keys
        if (systemRoleKey && /^[a-z]/.test(systemRoleKey)) {
            systemRoleKey = systemRoleKey.charAt(0).toUpperCase() + systemRoleKey.slice(1)
        }

        // 1. Check hardcoded permissions (Title Cased Key)
        let permissions = ROLE_PERMISSIONS[systemRoleKey]

        // 2. If not found, check custom roles in DB (Original Key, Case Insensitive)
        if (!permissions && req.user?.clinicId) {
            try {
                const { data: clinic } = await supabaseAdmin
                    .from('clinics')
                    .select('custom_roles')
                    .eq('id', req.user.clinicId)
                    .single()

                if (clinic && clinic.custom_roles) {
                    const customRole = clinic.custom_roles.find(r =>
                        r.name === originalRole ||
                        r.name.toLowerCase() === originalRole.toLowerCase()
                    )
                    if (customRole) {
                        permissions = customRole.permissions
                    }
                }
            } catch (err) {
                console.error('Custom role fetch error:', err)
            }
        }

        permissions = permissions || []

        // Safety: If somehow still owner but permissions empty (?), merge default Owner permissions
        if (req.user?.role === 'owner') {
            const ownerPerms = ROLE_PERMISSIONS['Owner'] || []
            permissions = [...new Set([...permissions, ...ownerPerms])]
        }

        if (!permissions.includes(permission)) {
            console.log(`❌ Access denied: User ${req.user?.userId} (${originalRole}) needs permission '${permission}'`)
            return res.status(403).json({
                error: `Access denied: Insufficient permissions. Role '${originalRole}' cannot '${permission}'.`
            })
        }
        next()
    }
}
