import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authMiddleware } from '../lib/auth.js'

const router = express.Router({ mergeParams: true })

// GET /api/users/:userId/documents
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params

        // TODO: Strict permission check (Self OR HR/Admin)
        // For now, authMiddleware ensures logged in. 
        // We could add: if (req.user.userId !== userId && !req.user.role.includes('HR')) ...

        const { data, error } = await supabaseAdmin
            .from('user_documents')
            .select('*')
            .eq('user_id', userId)
            .order('uploaded_at', { ascending: false })

        if (error) throw error
        res.json({ data })
    } catch (err) {
        console.error('Fetch documents error:', err)
        res.status(500).json({ error: 'Failed to fetch user documents' })
    }
})

// POST /api/users/:userId/documents
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params
        const { type, title, document_number, expiry_date, file_url } = req.body

        console.log('📄 Upload Document Request:', { userId, type, title, file_url })

        const clinicId = req.user.clinicId || (await getUserClinicId(userId))

        if (!clinicId) {
            console.error('❌ Upload Document Error: Clinic ID not found for user', userId)
            return res.status(400).json({ error: 'Clinic ID not found for user' })
        }

        if (!type || !file_url) {
            console.error('❌ Upload Document Error: Missing fields', { type, file_url })
            return res.status(400).json({ error: 'Type and file URL are required' })
        }

        const { data, error } = await supabaseAdmin
            .from('user_documents')
            .insert({
                user_id: userId,
                clinic_id: clinicId,
                type,
                title,
                document_number,
                expiry_date: expiry_date || null,
                file_url,
                status: 'pending'
            })
            .select()
            .single()

        if (error) throw error
        res.json({ success: true, data })
    } catch (err) {
        console.error('❌ Create document error:', err)
        res.status(500).json({ error: err.message || 'Failed to upload document' })
    }
})

// DELETE /api/users/:userId/documents/:docId
router.delete('/:docId', authMiddleware, async (req, res) => {
    try {
        const { userId, docId } = req.params

        const { error } = await supabaseAdmin
            .from('user_documents')
            .delete()
            .eq('id', docId)
            .eq('user_id', userId) // Security: Ensure ownership

        if (error) throw error
        res.json({ success: true })
    } catch (err) {
        console.error('Delete document error:', err)
        res.status(500).json({ error: 'Failed to delete document' })
    }
})

// Helper to get clinic ID if not in token (e.g. for superadmin or special cases, though usually in token)
async function getUserClinicId(userId) {
    const { data } = await supabaseAdmin.from('users').select('clinic_id').eq('id', userId).single()
    return data?.clinic_id
}

export default router
