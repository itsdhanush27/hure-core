// Plan limits configuration
export const PLAN_LIMITS = {
    essential: { locations: 1, staff: 10, adminSeats: 2 },
    professional: { locations: 2, staff: 30, adminSeats: 5 },
    enterprise: { locations: 5, staff: 75, adminSeats: 10 }
}

export function getPlanLimits(planKey) {
    return PLAN_LIMITS[planKey] || PLAN_LIMITS.essential
}

export function checkLocationLimit(planKey, currentCount) {
    const limits = getPlanLimits(planKey)
    return currentCount < limits.locations
}

export function checkStaffLimit(planKey, currentCount) {
    const limits = getPlanLimits(planKey)
    return currentCount < limits.staff
}

export function checkAdminSeatLimit(planKey, currentCount) {
    const limits = getPlanLimits(planKey)
    return currentCount < limits.adminSeats
}
