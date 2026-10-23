export const PRESCHOOL_COORDINATOR_ELIGIBLE_STAFF_ROLES = [
  'school_admin',
  'director',
  'censeur',
  'secretary',
  'surveillant',
  'teacher',
  'accountant',
] as const

export function isPreschoolCoordinatorEligibleStaffRole(role: string) {
  return (PRESCHOOL_COORDINATOR_ELIGIBLE_STAFF_ROLES as readonly string[]).includes(role)
}
