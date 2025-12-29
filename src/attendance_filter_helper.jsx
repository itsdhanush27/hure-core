// ATTENDANCE FILTER HELPER - Copy to EmployerDashboard.jsx

// ============================================
// ADD THIS FUNCTION after getStatusColor() function (around line 2233)
// ============================================

const setQuickDateRange = (range) => {
    const now = new Date()
    let startDate

    if (range === 'today') {
        startDate = now.toISOString().split('T')[0]
    } else if (range === 'week') {
        const dayOfWeek = now.getDay()
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        startDate = new Date(now.setDate(now.getDate() - diff)).toISOString().split('T')[0]
    } else if (range === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    }
    setDateFilter(startDate)
    setDateRange(range)
}

const filteredAttendance = attendance.filter(a => {
    const staffName = `${a.users?.first_name || ''} ${a.users?.last_name || ''}`.toLowerCase()
    return staffName.includes(searchName.toLowerCase())
})


// ============================================
// UPDATE THE STATS SECTION (around line 2290-2330)
// Replace all instances of "attendance" with "filteredAttendance"
// ============================================

// Example changes:
// OLD: {attendance.filter(a => a.status === 'present_full').length}
// NEW: {filteredAttendance.filter(a => a.status === 'present_full').length}

// OLD: {attendance.reduce((sum, a) => sum + (parseFloat(a.total_hours) || 0), 0).toFixed(1)}
// NEW: {filteredAttendance.reduce((sum, a) => sum + (parseFloat(a.total_hours) || 0), 0).toFixed(1)}


// ============================================
// UPDATE THE TABLE (around line 2320-2360)
// Replace "attendance.length === 0" with "filteredAttendance.length === 0"
// Replace "attendance.map" with "filteredAttendance.map"
// ============================================
