import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const inviteForm = readFileSync(new URL('../src/app/dashboard/staff/invite-form.tsx', import.meta.url), 'utf8')
const staffDirectory = readFileSync(new URL('../src/components/staff-directory.tsx', import.meta.url), 'utf8')
const coordinatorMigration = readFileSync(new URL('../supabase/migrations/20261022180100_preschool_coordinator_access_role.sql', import.meta.url), 'utf8')

assert.match(inviteForm, /value="preschool_coordinator" disabled/, 'the invite role menu should explain that coordinator access is assigned after staff membership exists')
assert.match(inviteForm, /href="#staff-directory"/, 'the invitation form should link directly to the staff directory')
assert.match(staffDirectory, /id="staff-directory"/, 'the staff directory should provide the invitation form anchor target')
assert.match(inviteForm, /isPreschoolCoordinatorEligibleStaffRole\(role\)/, 'the active staff directory must retain the coordinator assignment action')
assert.match(coordinatorMigration, /new\.role='preschool_coordinator' then raise exception/, 'the database must keep blocking direct coordinator invitations')
console.log('Coordinator invitation guidance checks passed.')
