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
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'parent' }]))), ['parents'])
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'student' }]))), ['students'])
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'unknown' }]))), [])
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'director' }, { role: 'teacher' }]))), ['staff', 'teachers'])
assert.deepEqual(JSON.parse(JSON.stringify(getDirectorySections([{ role: 'parent' }, { role: 'student' }]))), ['parents', 'students'])

console.log('Staff directory section checks passed.')


