import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'

const component=readFileSync('src/components/family-school-calendar.tsx','utf8')
const portal=readFileSync('src/app/dashboard/parent-portal/page.tsx','utf8')
const translations=readFileSync('src/lib/translations-extra.ts','utf8')
const packageJson=JSON.parse(readFileSync('package.json','utf8'))

assert.match(component,/family_child_attendance_history/,'attendance markers must use the linked-family RPC')
assert.match(component,/school_calendar/,'calendar dates must come from the school calendar RPC')
assert.match(component,/family_finance_workspace/,'payment timeline must use the family-scoped finance RPC')
assert.match(component,/badge_workspace/,'badge event timeline must use the family-scoped badge RPC')
assert.match(component,/America\/Port-au-Prince/,'day grouping must follow Haiti time')
for(const mode of ['month','week','day','year']) assert.ok(component.includes(`'${mode}'`),`missing ${mode} calendar view`)
for(const kind of ['attendance','exam','holiday','payment','badge']) assert.ok(component.includes(`'${kind}'`),`missing ${kind} event kind`)
assert.match(portal,/<FamilySchoolCalendar studentId=\{childId\}\/>/,'parent calendar must stay scoped to selected linked child')
for(const key of ['Family calendar','Attendance, exams, school closures and recorded family actions.','Exam period','Holiday','Payment request','Badge action','No events in this period.']) assert.ok(translations.includes(`"${key}"`),`missing French/Kreyòl copy: ${key}`)
assert.ok(packageJson.scripts.test.includes('node tests/family-school-calendar.mjs'),'npm test includes calendar coverage')


const require=createRequire(import.meta.url)
const ts=require('typescript')
const navigationSource=readFileSync('src/lib/family-calendar-navigation.ts','utf8')
const navigationJs=ts.transpileModule(navigationSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const navigationModule={exports:{}}
new Function('exports','require','module',navigationJs)(navigationModule.exports,require,navigationModule)
const shift=navigationModule.exports.shiftFamilyCalendarAnchor
const iso=(date)=>date.toISOString().slice(0,10)
assert.equal(iso(shift(new Date('2026-01-31T12:00:00Z'),'month',1)),'2026-02-01','January month navigation must enter February without overflowing')
assert.equal(iso(shift(new Date('2026-03-31T12:00:00Z'),'month',-1)),'2026-02-01','March month navigation must return to February')
assert.equal(iso(shift(new Date('2026-12-31T12:00:00Z'),'month',1)),'2027-01-01','December month navigation must cross the year boundary')
assert.equal(iso(shift(new Date('2028-02-29T12:00:00Z'),'year',1)),'2029-01-01','year navigation must remain anchored to the start of the year')
assert.equal(iso(shift(new Date('2026-01-31T12:00:00Z'),'week',1)),'2026-02-07','week navigation must preserve normal seven-day movement')

console.log('PASS family calendar contract: linked-child attendance, Haiti-time grouping, school exams/closures, payment and badge actions, four responsive calendar modes.')
