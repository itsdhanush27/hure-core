// Date formatting utilities for Kenya (dd/mm/yyyy format)

/**
 * Format a date to dd/mm/yyyy
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date as dd/mm/yyyy
 */
export const formatDateKE = (date) => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
}

/**
 * Format a date for display with day name (e.g., "Wed, 24 Dec 2025")
 * @param {Date|string} dateStr - Date object or ISO string
 * @returns {string} Formatted date with weekday
 */
export const formatDateWithDay = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Format a date for input fields (yyyy-mm-dd)
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date as yyyy-mm-dd for input[type="date"]
 */
export const formatDateForInput = (date) => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toISOString().split('T')[0]
}

/**
 * Parse dd/mm/yyyy to Date object
 * @param {string} dateStr - Date string in dd/mm/yyyy format
 * @returns {Date|null} Date object or null if invalid
 */
export const parseDateKE = (dateStr) => {
    if (!dateStr) return null
    const parts = dateStr.split('/')
    if (parts.length !== 3) return null
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1 // Month is 0-indexed
    const year = parseInt(parts[2], 10)
    return new Date(year, month, day)
}

/**
 * Format time to HH:MM (24-hour format, no seconds)
 * @param {Date|string} timeStr - Time string or ISO datetime
 * @returns {string} Formatted time as HH:MM
 */
export const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const d = new Date(timeStr)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Check if a shift has expired (start time has passed)
 * @param {string} shiftDate - Date string (yyyy-mm-dd)
 * @param {string} shiftStartTime - Time string (HH:MM:SS)
 * @returns {boolean} True if shift has expired
 */
export const isShiftExpired = (shiftDate, shiftStartTime) => {
    if (!shiftDate || !shiftStartTime) return false
    const shiftDateTime = new Date(`${shiftDate}T${shiftStartTime}`)
    return shiftDateTime < new Date()
}
