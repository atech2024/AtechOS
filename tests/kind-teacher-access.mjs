import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const navigationSource = readFileSync(new URL('../src/lib/navigation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(navigationSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const exports = {}
vm.runInNewContext(compiled, { exports })
const links = roles => exports.permittedNavigation(roles).map(item => item.href)

assert.ok(links(['school_admin']).includes('/dashboard/staff'))
assert.ok(links(['director']).includes('/dashboard/teacher-requests'))
assert.ok(links(['censeur']).includes('/dashboard/staff'))
assert.ok(!links(['teacher']).includes('/dashboard/staff'), 'an ordinary teacher should not see staff management')
assert.ok(!links(['teacher']).includes('/dashboard/teacher-requests'), 'an ordinary teacher should not see approval tools')
const coordinatorLinks = exports.permittedNavigation(['teacher','preschool_coordinator'], false, true).map(item => item.href)
assert.ok(coordinatorLinks.includes('/dashboard/staff'), 'the designated coordinator should see the limited Staff entry')
assert.ok(coordinatorLinks.includes('/dashboard/teacher-requests'), 'the designated coordinator should see teacher requests')
assert.ok(coordinatorLinks.includes('/dashboard/preschool/overview'), 'coordinator role should expose its Kind workspace')
assert.ok(coordinatorLinks.includes('/dashboard/attendance/kindergarten-pickup'), 'coordinator role should expose the Kind pickup flow')
assert.ok(!coordinatorLinks.includes('/dashboard/parents'), 'coordinator capability must not grant unrelated staff/family access')
const standaloneCoordinatorLinks = exports.permittedNavigation(['preschool_coordinator'], false, true).map(item => item.href)
assert.ok(standaloneCoordinatorLinks.includes('/dashboard/staff'), 'coordinator access should expose limited staff and teacher approvals')
assert.ok(standaloneCoordinatorLinks.includes('/dashboard/teacher-requests'), 'coordinator access should expose teacher approvals')
assert.ok(!standaloneCoordinatorLinks.includes('/dashboard/finance'), 'coordinator role must not grant finance access')

const staffPage = readFileSync(new URL('../src/app/dashboard/staff/page.tsx', import.meta.url), 'utf8')
const coordinatorPolicySource = readFileSync(new URL('../src/lib/preschool-coordinator-policy.ts', import.meta.url), 'utf8')
const coordinatorPolicyCompiled = ts.transpileModule(coordinatorPolicySource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const coordinatorPolicyExports = {}
vm.runInNewContext(coordinatorPolicyCompiled, { exports: coordinatorPolicyExports })
for (const role of ['school_admin', 'director', 'censeur', 'secretary', 'surveillant', 'teacher', 'accountant']) {
  assert.equal(coordinatorPolicyExports.isPreschoolCoordinatorEligibleStaffRole(role), true, `${role} staff should be eligible for coordinator assignment`)
}
for (const role of ['parent', 'student', 'preschool_coordinator']) {
  assert.equal(coordinatorPolicyExports.isPreschoolCoordinatorEligibleStaffRole(role), false, `${role} must not be an eligible base staff role`)
}

assert.match(staffPage, /teacher_staff_management_access/)
assert.match(staffPage, /preschool_coordinator/)
assert.match(staffPage, /canManageCoordinator=\{presentation\.fullDirectory\}/)
assert.match(staffPage, /<InviteForm owner=\{false\} teacherOnly/)
assert.ok(!staffPage.includes('PreschoolCoordinatorAssignment'), 'coordinator assignment should not be rendered as a standalone panel')
const staffDirectory = readFileSync(new URL('../src/components/staff-directory.tsx', import.meta.url), 'utf8')
assert.ok(!staffDirectory.includes('PreschoolCoordinatorAssignment'), 'the duplicate standalone coordinator panel should stay removed')
assert.match(staffDirectory, /person\.preschoolCoordinator && <span[^>]*><T text="Preschool coordinator"/, 'the coordinator must remain visible in the staff directory')
assert.match(staffDirectory, /<MemberAction[^>]*canManageCoordinator=\{canManageCoordinator\}/, 'coordinator assignment stays with the existing staff-row actions')
assert.ok(!staffDirectory.includes('Change this role from the coordinator assignment above.'), 'the coordinator access row should not point to a removed duplicate control')
assert.match(staffDirectory, /getDirectorySections\(person\.access, person\.preschoolCoordinator\)/, 'the assigned coordinator must remain in Personnel even without another staff capability')
assert.match(staffDirectory, /Number\(Boolean\(b\.preschoolCoordinator\)\)/, 'the assigned coordinator should appear first in Personnel')
assert.match(staffPage, /<StaffDirectory people=\{people\} readOnly/,'Director should see a read-only staff directory without family or student records')
assert.match(staffPage, /getStaffPagePresentation\(Boolean\(context\.owner\), context\.roles \|\| \[\]\)/)
assert.match(staffPage, /if \(!presentation\.fullDirectory && !staffRoles\.has\(member\.role\)\) continue/, 'Director directory data must exclude parents and students')

const migration = readFileSync(new URL('../supabase/migrations/20261020170000_kind_staff_teacher_access.sql', import.meta.url), 'utf8')
assert.ok(migration.includes("director_guard:='if not (private.has_role(sid,array[''school_admin'']) or (p_role=''parent'' and private.has_role(sid,array[''director''])))"), 'must recognize the existing Director parent-invitation grant')
assert.ok(migration.includes("i.role=''parent'' and exists(select 1 from public.school_members m where m.school_id=i.school_id and m.user_id=i.invited_by and m.role=''director'' and m.enabled)"), 'must preserve Director parent-invitation acceptance')

const roleForm = readFileSync(new URL('../src/app/dashboard/staff/invite-form.tsx', import.meta.url), 'utf8')
assert.match(roleForm, /existing staff role was kept/i)
assert.match(roleForm, /isPreschoolCoordinatorEligibleStaffRole\(role\)/, 'staff role actions must use the shared coordinator eligibility rule')
assert.ok(!roleForm.includes('coordinator-role-guidance'), 'invitation form should not show redundant coordinator guidance')
assert.ok(!roleForm.includes('value="preschool_coordinator" disabled'), 'direct coordinator invitations stay unavailable')
const staffActions = readFileSync(new URL('../src/app/dashboard/staff/actions.ts', import.meta.url), 'utf8')
assert.match(staffActions, /assign_preschool_coordinator/)
const invitationRoles = roleForm.match(/\(owner \? (\[[^\]]+\]) : (\[[^\]]+\])\)/)
assert.ok(invitationRoles, 'staff invitations should use the existing role lists')
assert.ok(!invitationRoles[1].includes('preschool_coordinator') && !invitationRoles[2].includes('preschool_coordinator'), 'coordinator must not be offered as a direct invitation role')
const roleMigration = readFileSync(new URL('../supabase/migrations/20261022180000_add_preschool_coordinator_school_role.sql', import.meta.url), 'utf8')
const coordinatorMigration = readFileSync(new URL('../supabase/migrations/20261022180100_preschool_coordinator_access_role.sql', import.meta.url), 'utf8')
assert.match(roleMigration, /add value if not exists 'preschool_coordinator'/)
assert.match(coordinatorMigration, /assign_preschool_coordinator/)
assert.match(coordinatorMigration, /use_preschool_coordinator_assignment/)
assert.match(coordinatorMigration, /coordinator_must_be_assigned_to_existing_staff/)
const eligibilityMigration = readFileSync(new URL('../supabase/migrations/20261022221707_preschool_coordinator_any_active_staff.sql', import.meta.url), 'utf8')
for (const role of ['school_admin', 'director', 'censeur', 'secretary', 'surveillant', 'teacher', 'accountant']) {
  assert.ok(eligibilityMigration.includes(`'${role}'`), `${role} should be eligible in the SQL authorization rule`)
}
assert.match(eligibilityMigration, /where school_id=p_school and user_id=p_coordinator and enabled[\s\S]*staff_member_not_found/)
assert.match(eligibilityMigration, /where id=p_member_id and school_id=sid and enabled[\s\S]*staff_member_not_found/)
console.log('Kind coordinator and teacher-access checks passed.')

