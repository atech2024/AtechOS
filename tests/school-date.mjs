import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const exports={}
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/school-date.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,Intl,Date})
assert.equal(exports.schoolDate('2026-09-25'),'25 Septanm 2026')
assert.equal(exports.schoolDate('2026-09-25T02:00:00Z'),'24 Septanm 2026')
assert.equal(exports.schoolTime('2026-09-25T13:00:00Z'),'09:00 AM')
assert.equal(exports.schoolTime('2026-12-25T18:00:00Z'),'01:00 PM')
assert.equal(exports.parseDateInput('25/09/2026'),'2026-09-25')
assert.equal(exports.parseDateInput('31/02/2026'),'')
assert.equal(exports.parseDateInput('09/25/2026'),'')
assert.equal(exports.schoolDateTimeToISO('2026-09-25T09:00'),'2026-09-25T13:00:00.000Z')
assert.equal(exports.schoolDateTimeToISO('2026-12-25T09:00'),'2026-12-25T14:00:00.000Z')
console.log('PASS: 9 Haiti date/time, DD/MM/YYYY and daylight-saving checks.')
