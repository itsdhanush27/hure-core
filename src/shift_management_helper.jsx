// ============================================
// COPY-PASTE HELPER FILE FOR SHIFT MANAGEMENT
// ============================================
// This file contains code snippets to add to EmployerDashboard.jsx

// ============================================
// STEP 1: Add these HANDLER FUNCTIONS
// Location: After handleCreateShift function (around line 1875)
// ============================================

const handleManageCoverage = (shift) => {
    setSelectedShift(shift)
    setShowManageCoverage(true)
}

const handleDeleteShift = async (shiftId) => {
    if (!confirm('Are you sure you want to delete this shift? This cannot be undone.')) {
        return
    }
    const clinicId = localStorage.getItem('hure_clinic_id')
    try {
        const res = await fetch(`/api/clinics/${clinicId}/schedule/${shiftId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
        })
        if (res.ok) {
            fetchSchedules()
        } else {
            alert('Failed to delete shift')
        }
    } catch (err) {
        console.error('Delete shift error:', err)
    }
}

const handleAssignStaff = async (staffId) => {
    const clinicId = localStorage.getItem('hure_clinic_id')
    try {
        const res = await fetch(`/api/clinics/${clinicId}/schedule/${selectedShift.id}/assign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('hure_token')}`
            },
            body: JSON.stringify({ userId: staffId })
        })
        if (res.ok) {
            // Refresh the schedules and update selectedShift
            const updatedRes = await fetch(`/api/clinics/${clinicId}/schedule`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
            })
            if (updatedRes.ok) {
                const data = await updatedRes.json()
                setSchedules(data.data || [])
                const updated = data.data.find(s => s.id === selectedShift.id)
                setSelectedShift(updated)
            }
        } else {
            alert('Failed to assign staff')
        }
    } catch (err) {
        console.error('Assign staff error:', err)
    }
}

const handleUnassignStaff = async (assignmentId) => {
    const clinicId = localStorage.getItem('hure_clinic_id')
    try {
        const res = await fetch(`/api/clinics/${clinicId}/schedule/${selectedShift.id}/unassign/${assignmentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
        })
        if (res.ok) {
            // Refresh the schedules and update selectedShift
            const updatedRes = await fetch(`/api/clinics/${clinicId}/schedule`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hure_token')}` }
            })
            if (updatedRes.ok) {
                const data = await updatedRes.json()
                setSchedules(data.data || [])
                const updated = data.data.find(s => s.id === selectedShift.id)
                setSelectedShift(updated)
            }
        } else {
            alert('Failed to unassign staff')
        }
    } catch (err) {
        console.error('Unassign staff error:', err)
    }
}


// ============================================
// STEP 2: Add this MODAL JSX
// Location: After the </Card> for "Upcoming Shifts" (around line 2050)
// Before the closing </div> of the return statement
// ============================================

{/* Manage Coverage Modal */ }
{
    showManageCoverage && selectedShift && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden">
                {/* Modal Header */}
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="text-lg font-bold">Manage coverage</h2>
                    <button
                        onClick={() => { setShowManageCoverage(false); setSelectedShift(null) }}
                        className="text-slate-400 hover:text-slate-600 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Shift Details */}
                <div className="p-4 bg-slate-50 border-b">
                    <div className="font-medium">
                        {formatDate(selectedShift.date)} · {formatTime(selectedShift.start_time)} - {formatTime(selectedShift.end_time)}
                    </div>
                    <div className="text-sm text-slate-500">
                        Location: {selectedShift.clinic_locations?.name} · Role: {selectedShift.role_required || 'Any'}
                    </div>
                    <div className="text-sm text-slate-500">
                        Required: {selectedShift.headcount_required} · Assigned: {selectedShift.schedule_assignments?.length || 0}
                    </div>
                </div>

                <div className="p-4 overflow-y-auto max-h-[50vh]">
                    {/* Currently Assigned */}
                    {selectedShift.schedule_assignments?.length > 0 && (
                        <div className="mb-4">
                            <h3 className="text-sm font-medium text-slate-700 mb-2">Currently Assigned</h3>
                            <div className="space-y-2">
                                {selectedShift.schedule_assignments.map(assignment => (
                                    <div key={assignment.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                                        <span className="font-medium text-green-800">
                                            {assignment.users?.first_name} {assignment.users?.last_name}
                                        </span>
                                        <button
                                            onClick={() => handleUnassignStaff(assignment.id)}
                                            className="text-red-600 hover:text-red-700 text-sm"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Available Staff */}
                    <div>
                        <h3 className="text-sm font-medium text-slate-700 mb-2">Available Staff</h3>
                        <div className="space-y-2">
                            {org.staff
                                .filter(s => !selectedShift.schedule_assignments?.some(a => a.user_id === s.id))
                                .filter(s => !selectedShift.role_required || s.job_title?.toLowerCase().includes(selectedShift.role_required?.toLowerCase()))
                                .map(staff => (
                                    <div key={staff.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border">
                                        <div>
                                            <span className="font-medium">{staff.first_name} {staff.last_name}</span>
                                            <span className="text-sm text-slate-500 ml-2">{staff.job_title}</span>
                                        </div>
                                        <button
                                            onClick={() => handleAssignStaff(staff.id)}
                                            className="px-3 py-1 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                                        >
                                            Assign
                                        </button>
                                    </div>
                                ))}
                            {org.staff.filter(s => !selectedShift.schedule_assignments?.some(a => a.user_id === s.id)).length === 0 && (
                                <div className="text-center py-4 text-slate-500">
                                    All staff are assigned to this shift
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t">
                    <button
                        onClick={() => { setShowManageCoverage(false); setSelectedShift(null) }}
                        className="w-full px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}


// ============================================
// SUMMARY OF CHANGES NEEDED:
// ============================================
//
// 1. State variables are already added (showManageCoverage, selectedShift)
//
// 2. Copy the handler functions (handleManageCoverage, handleDeleteShift,
//    handleAssignStaff, handleUnassignStaff) after handleCreateShift
//
// 3. Copy the Modal JSX after the "Upcoming Shifts" Card
//
// 4. The buttons are already added to the shifts!
//
// Backend endpoints:
// - POST /api/clinics/:clinicId/schedule/:blockId/assign (existed)
// - DELETE /api/clinics/:clinicId/schedule/:blockId (NEW)
// - DELETE /api/clinics/:clinicId/schedule/:blockId/unassign/:assignmentId (NEW)
