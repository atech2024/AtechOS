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
const coordinatorLinks = exports.permittedNavigation(['teacher'], false, true).map(item => item.href)
assert.ok(coordinatorLinks.includes('/dashboard/staff'), 'the designated coordinator should see the limited Staff entry')
assert.ok(coordinatorLinks.includes('/dashboard/teacher-requests'), 'the designated coordinator should see teacher requests')
assert.ok(!coordinatorLinks.includes('/dashboard/parents'), 'coordinator capability must not grant unrelated staff/family access')

const staffPage = readFileSync(new URL('../src/app/dashboard/staff/page.tsx', import.meta.url), 'utf8')
assert.match(staffPage, /teacher_staff_management_access/)
assert.match(staffPage, /<InviteForm owner=\{false\} teacherOnly/)
assert.match(staffPage, /PreschoolCoordinatorAssignment/)
assert.match(staffPage, /getStaffPagePresentation\(Boolean\(context\.owner\), context\.roles \|\| \[\]\)/)

const migration = readFileSync(new URL('../supabase/migrations/20261020170000_kind_staff_teacher_access.sql', import.meta.url), 'utf8')
assert.ok(migration.includes("director_guard:='if not (private.has_role(sid,array[''school_admin'']) or (p_role=''parent'' and private.has_role(sid,array[''director''])))"), 'must recognize the existing Director parent-invitation grant')
assert.ok(migration.includes("i.role=''parent'' and exists(select 1 from public.school_members m where m.school_id=i.school_id and m.user_id=i.invited_by and m.role=''director'' and m.enabled)"), 'must preserve Director parent-invitation acceptance')

console.log('Kind coordinator and teacher-access checks passed.')

