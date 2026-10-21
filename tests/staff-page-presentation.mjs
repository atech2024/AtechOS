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

