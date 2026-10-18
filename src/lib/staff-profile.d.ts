export declare const STAFF_PROFILE_ROLES: readonly [
  'school_admin',
  'director',
  'secretary',
  'censeur',
  'teacher',
  'accountant',
  'surveillant',
]
export declare function canAccessStaffProfile(roles: readonly string[] | null | undefined): boolean
export declare function dateInHaiti(date?: Date): string
export type StaffGreetingKey = 'Good morning' | 'Good evening'
export declare function staffGreetingAt(date?: Date): StaffGreetingKey
