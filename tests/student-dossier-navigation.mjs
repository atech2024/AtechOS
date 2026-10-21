import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/student-dossier-navigation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const exports = {}
runInNewContext(compiled, { exports })

assert.equal(exports.resolveStudentDossierId('student-a', ['student-a', 'student-b']), 'student-a')
assert.equal(exports.resolveStudentDossierId('student-outside-school', ['student-a']), '')
assert.equal(exports.resolveStudentDossierId(null, ['student-a']), '')
assert.equal(exports.buildStudentFamilyHref('student-a'), '/dashboard/parents?studentId=student-a#family-relationships')
assert.equal(exports.buildStudentFamilyHref('student / 1'), '/dashboard/parents?studentId=student%20%2F%201#family-relationships')
assert.equal(exports.buildStudentFamilyHref(''), '/dashboard/parents#family-relationships')

const parentsPage = readFileSync(new URL('../src/app/dashboard/parents/page.tsx', import.meta.url), 'utf8')
const studentPage = readFileSync(new URL('../src/app/dashboard/students/[id]/page.tsx', import.meta.url), 'utf8')
assert.ok(parentsPage.includes('resolveStudentDossierId(requestedStudentId, students.map(student => student.id))'))
assert.ok(parentsPage.includes('setInviteStudentId(selectedStudentId)') && parentsPage.includes('setLinkStudentId(selectedStudentId)'))
assert.ok(studentPage.includes('buildStudentFamilyHref(id)') && studentPage.includes('Manage family record'))

console.log('Student dossier family navigation checks passed.')
