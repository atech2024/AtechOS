import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

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

console.log('PASS family calendar contract: linked-child attendance, Haiti-time grouping, school exams/closures, payment and badge actions, four responsive calendar modes.')
