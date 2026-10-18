export const STAFF_PROFILE_ROLES = Object.freeze([
  'school_admin',
  'director',
  'secretary',
  'censeur',
  'teacher',
  'accountant',
  'surveillant',
])

export function canAccessStaffProfile(roles) {
  return Boolean(roles?.some(role => STAFF_PROFILE_ROLES.includes(role)))
}

export function dateInHaiti(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Port-au-Prince',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function staffGreetingAt(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Port-au-Prince',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date),
  )
  return hour < 18 ? 'Good morning' : 'Good evening'
}

export function isStaffProfileSchemaUnavailable(code) {
  return code === '42P01' || code === 'PGRST205'
}
