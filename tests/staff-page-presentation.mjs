import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/staff-page-presentation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const exports = {}
vm.runInNewContext(compiled, { exports })
const present = exports.getStaffPagePresentation

assert.deepEqual(JSON.parse(JSON.stringify(present(true, []))), { fullDirectory: true, coordinatorAssignment: true })
assert.deepEqual(JSON.parse(JSON.stringify(present(false, ['school_admin']))), { fullDirectory: true, coordinatorAssignment: true })
assert.deepEqual(JSON.parse(JSON.stringify(present(false, ['director']))), { fullDirectory: false, coordinatorAssignment: true })
assert.deepEqual(JSON.parse(JSON.stringify(present(false, ['censeur']))), { fullDirectory: false, coordinatorAssignment: false })
assert.deepEqual(JSON.parse(JSON.stringify(present(false, ['teacher']))), { fullDirectory: false, coordinatorAssignment: false })
assert.deepEqual(JSON.parse(JSON.stringify(present(false, ['teacher', 'director']))), { fullDirectory: false, coordinatorAssignment: true })

console.log('Staff page role presentation checks passed.')


const sectionsSource = readFileSync(new URL('../src/lib/staff-directory-sections.ts', import.meta.url), 'utf8')
const sectionsCompiled = ts.transpileModule(sectionsSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const sectionExports = {}
vm.runInNewContext(sectionsCompiled, { exports: sectionExports })
const getDirectorySections = sectionExports.getDirectorySections

assert.equal(sectionExports.getDisplayMemberRole('school_admin', true), 'owner')
assert.equal(sectionExports.getDisplayMemberRole('school_admin', false), 'school_admin')
assert.equal(sectionExports.getDisplayMemberRole('teacher', true), 'teacher')
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([
  { role: sectionExports.getDisplayMemberRole('school_admin', true) },
  { role: sectionExports.getDisplayMemberRole('teacher', true) },
]))), ['staff', 'teachers'])

assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'school_admin' }]))), ['staff'])
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'accountant' }]))), ['staff'])
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'teacher' }]))), ['teachers'])
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'teacher' }], true))), ['staff', 'teachers'])
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'parent' }]))), ['parents'])
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'student' }]))), ['students'])
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'unknown' }]))), [])
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'director' }, { role: 'teacher' }]))), ['staff', 'teachers'])
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'parent' }, { role: 'student' }]))), ['parents', 'students'])

console.log('Staff directory section checks passed.')

const inviteActions = readFileSync(new URL('../src/app/dashboard/staff/actions.ts', import.meta.url), 'utf8')
const originPreflight = inviteActions.indexOf("const origin = (await headers()).get('origin')")
const invitationWrite = inviteActions.indexOf("supabase.rpc('create_school_invitation'")
assert.ok(originPreflight >= 0 && originPreflight < invitationWrite, 'must validate the link origin before creating a pending invitation')
assert.ok(!inviteActions.includes('Invitation created. Open the application directly and create a replacement link.'), 'missing origin must not leave an unshareable invitation behind')

console.log('Invitation origin preflight checks passed.')




const invitePolicy = readFileSync(new URL('../src/lib/invitation-policy.ts', import.meta.url), 'utf8')
const policyCompiled = ts.transpileModule(invitePolicy, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const policyExports = {}
vm.runInNewContext(policyCompiled, { exports: policyExports })
const canRenewInvitation = policyExports.canRenewInvitation
const now = Date.parse('2026-01-01T00:00:00.000Z')
assert.equal(canRenewInvitation('pending', '2025-12-31T23:59:59.000Z', now), true)
assert.equal(canRenewInvitation('pending', '2026-01-01T00:00:01.000Z', now), false)
assert.equal(canRenewInvitation('cancelled', '2026-01-01T00:00:01.000Z', now), true)
assert.equal(canRenewInvitation('accepted', '2025-12-31T00:00:00.000Z', now), false)
assert.equal(canRenewInvitation('pending', 'invalid', now), false)

const renewalStart = inviteActions.indexOf('export async function renewInvitation')
const renewalEnd = inviteActions.indexOf('export async function changeMember', renewalStart)
const renewalAction = inviteActions.slice(renewalStart, renewalEnd)
assert.ok(renewalStart >= 0 && renewalEnd > renewalStart, 'expired and cancelled invitations need a renewal action')
assert.ok(renewalAction.indexOf("const origin = (await headers()).get('origin')") >= 0 && renewalAction.indexOf("const origin = (await headers()).get('origin')") < renewalAction.indexOf("supabase.rpc('school_context')"), 'renewal must validate origin before reading or writing invitation data')
assert.ok(renewalAction.includes(".eq('id', id).eq('school_id', context.school_id)"), 'renewal must scope the invitation to the current school')
assert.ok(renewalAction.includes('canRenewInvitation(invitation.status, invitation.expires_at)'), 'server action must use the tested expiry/cancellation rules')
assert.ok(renewalAction.includes('p_student_id: invitation.student_id') && renewalAction.includes('p_parent_id: invitation.parent_id'), 'renewal must preserve the invited student or parent record')

const inviteForm = readFileSync(new URL('../src/app/dashboard/staff/invite-form.tsx', import.meta.url), 'utf8')
assert.ok(inviteForm.includes('/dashboard/parents') && inviteForm.includes('For parent invitations'), 'staff invitation form must route parent invites through the Parents workspace')
assert.ok(!inviteForm.includes("'surveillant', 'parent', 'student'"), 'generic staff invitation roles must not duplicate parent invitations')
const studentList = readFileSync(new URL('../src/app/dashboard/students/page.tsx', import.meta.url), 'utf8')
const studentProfile = readFileSync(new URL('../src/app/dashboard/students/[id]/page.tsx', import.meta.url), 'utf8')
const parentsPage = readFileSync(new URL('../src/app/dashboard/parents/page.tsx', import.meta.url), 'utf8')
assert.ok(studentList.includes('/dashboard/parents?studentId=') && studentProfile.includes('/dashboard/parents?studentId='), 'student shortcuts must open the canonical parent workflow with the child selected')
assert.equal((parentsPage.match(/<ParentInvite\b/g) || []).length, 1, 'Parents must expose one canonical invite form')
assert.ok(parentsPage.includes("new URLSearchParams(window.location.search).get('studentId')"), 'the canonical Parents workflow must restore the selected student')

console.log('Invitation renewal and unified parent flow checks passed.')
