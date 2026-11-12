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
assert.equal(exports.buildStudentModuleHref('student-a', 'attendance'), '/dashboard/attendance?studentId=student-a')
assert.equal(exports.buildStudentModuleHref('student / 1', 'grades'), '/dashboard/grades?studentId=student%20%2F%201')
assert.equal(exports.buildStudentModuleHref('', 'sanctions'), '/dashboard/sanctions')

const parentsPage = readFileSync(new URL('../src/app/dashboard/parents/page.tsx', import.meta.url), 'utf8')
const studentPage = readFileSync(new URL('../src/app/dashboard/students/[id]/page.tsx', import.meta.url), 'utf8')
assert.ok(parentsPage.includes('resolveStudentDossierId(requestedStudentId, students.map(student => student.id))'))
assert.ok(parentsPage.includes('setInviteStudentId(selectedStudentId)') && parentsPage.includes('setLinkStudentId(selectedStudentId)'))
assert.ok(studentPage.includes('buildStudentFamilyHref(id)') && studentPage.includes('Manage family record'))
assert.ok(studentPage.includes("buildStudentModuleHref(id,'attendance')") && studentPage.includes("buildStudentModuleHref(id,'grades')") && studentPage.includes("buildStudentModuleHref(id,'sanctions')"))
const attendance = readFileSync(new URL('../src/components/attendance-workspace.tsx', import.meta.url), 'utf8')
const grades = readFileSync(new URL('../src/app/dashboard/grades/page.tsx', import.meta.url), 'utf8')
const sanctions = readFileSync(new URL('../src/app/dashboard/sanctions/page.tsx', import.meta.url), 'utf8')
assert.ok(attendance.includes("eq('student_id',requestedDossierStudentId)") && attendance.includes('student.id!==dossierStudentId') && attendance.includes('resolveStudentDossierId(requestedDossierStudentId,(data||[]).map(row=>row.student_id))'), 'attendance must validate a requested dossier through active enrollments before filtering')
assert.ok(grades.includes("eq('student_id',requestedDossierStudentId)") && grades.includes('visibleGrades=') && grades.includes('entryStudents='), 'grades must validate context and restrict entry/history to the selected student')
assert.ok(sanctions.includes('resolveStudentDossierId(requestedDossierStudentId,activeStudents.map(student=>student.id))') && sanctions.includes('data.sanctions.filter(item=>item.student_id===dossierStudentId)') && sanctions.includes('students={contextStudents}'), 'sanctions context must resolve against authorized workspace students and scope follow-up actions')

console.log('Student dossier navigation and follow-up checks passed.')
