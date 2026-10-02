import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync('src/app/dashboard/subjects/page.tsx','utf8')
assert.match(page,/useAcademicYear\(\)/,'subject setup consumes the shared academic year')
assert.match(page,/select\('id,name,academic_year_id,enabled'\)/,'class setup loads year and enabled metadata')
assert.match(page,/classes\.filter\(c => c\.academic_year_id === academicYear\.yearId\)/,'class assignments are limited to selected-year classes')
assert.match(page,/yearClasses\.filter\(c => c\.enabled\)/,'new subject assignments only target enabled classes')
assert.match(page,/assignableClasses\.map\(c => \(\{value:c\.id,label:c\.name\}\)\)/,'assignment form offers only enabled classes from the selected year')
assert.match(page,/assignments\.filter\(a => yearClassIds\.has\(a\.class_id\)\)/,'existing class-subject links are listed only for the selected year')
assert.match(page,/disabled=\{saving \|\| !assignableClasses\.length\}/,'assignment creation is disabled when this year has no enabled classes')
const translations=readFileSync('src/lib/translations-extra.ts','utf8')
for(const label of ['No class subject assignments for this academic year.','No enabled classes are configured for this academic year.'])assert.ok(translations.includes(`'${label}':[`),`${label} needs French and Haitian Creole translations`)
console.log('PASS subject and teacher assignment workflows follow the selected academic year.')
