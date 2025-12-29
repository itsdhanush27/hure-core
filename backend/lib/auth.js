import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'hure-dev-secret-key-min-32-chars'

export function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET)
    } catch (err) {
        return null
    }
}

// Middleware to protect routes
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = verifyToken(token)

    if (!decoded) {
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
