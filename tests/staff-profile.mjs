import assert from 'node:assert/strict'
import { canAccessStaffProfile, dateInHaiti, staffGreetingAt } from '../src/lib/staff-profile.mjs'

assert.equal(canAccessStaffProfile(['teacher']), true)
assert.equal(canAccessStaffProfile(['parent']), false)
assert.equal(canAccessStaffProfile(['student']), false)
assert.equal(canAccessStaffProfile([]), false)

assert.equal(dateInHaiti(new Date('2026-10-18T15:00:00.000Z')), '2026-10-18')
assert.equal(staffGreetingAt(new Date('2026-10-18T15:00:00.000Z')), 'Good morning')
assert.equal(staffGreetingAt(new Date('2026-10-18T22:00:00.000Z')), 'Good evening')

console.log('Staff profile role and Haiti-time greeting checks passed.')
