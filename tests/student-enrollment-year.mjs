import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync('src/app/dashboard/students/page.tsx','utf8')
assert.match(page,/useAcademicYear\(\)/,'student enrollment uses the shared school-year selection')
assert.match(page,/select\('id,name,academic_year_id,enabled'\)/,'class data includes its academic year and enabled state')
assert.match(page,/classes\.filter\(c=>c\.enabled&&c\.academic_year_id===academicYear\.yearId\)/,'new enrollment classes are scoped to enabled classes in the selected year')
assert.match(page,/classNamesForYear=\(studentId:string\)=>\{const matches=enrollments\.filter\(enrollment=>enrollment\.student_id===studentId&&classById\.get\(enrollment\.class_id\)\?\.academic_year_id===academicYear\.yearId\);const active=matches\.find\(enrollment=>enrollment\.status==='active'\);const selected=active\?\[active\]:matches/,'the class list is scoped to the selected year and prefers the active class')
assert.match(page,/classNamesForYear\(s\.id\)\.join\(', '\)/,'student rows display selected-year class names')
assert.match(page,/select\('student_id,class_id,status'\)\.in\('status',\['active','transferred'\]\)/,'student class history loads active and transferred enrollments')
assert.match(page,/enrollmentClasses\.map\(c=><option/,'the enrollment form only offers selected-year classes')
assert.match(page,/disabled=\{saving \|\| \(!editing && !enrollmentClasses\.length\)\}/,'new enrollment is disabled if the selected year has no enabled classes')
assert.match(page,/p_data:editing \? \{\.\.\.form,class_id:null\} : form/,'class changes are stripped from existing-student updates')
assert.match(page,/Student ID and class are read-only here\./,'the edit form explains that ID and class cannot be changed here')
assert.match(readFileSync('src/lib/translations-extra.ts','utf8'),/Create a class first for the selected academic year\./,'empty-state copy is translated')
console.log('PASS student creation is scoped to enabled classes in the selected academic year; editing keeps student ID and class read-only.')

const translations=readFileSync('src/lib/translations-extra.ts','utf8')
for(const phrase of ['Student records are separate from badges. A photo can be added later.','AtechOS ID','Unable to load class assignments or school access.','Unable to load students.','Unable to save. Check your connection and try again.'])assert.ok(translations.includes(`'${phrase}':[`),`French and Haitian Creole translations include ${phrase}`)
assert.ok(page.includes('<T text="Student records are separate from badges. A photo can be added later."/>' ),'student description uses translation provider')
assert.ok(page.includes('<T text="AtechOS ID"/>' ),'student ID column heading uses translation provider')
assert.ok(page.includes('<T text="Unassigned"/>' ),'missing class state uses translation provider')
assert.ok(page.includes('<T text="Choose a class"/>' ),'class selector placeholder uses translation provider')
assert.ok(page.includes("<T text={saving?'Saving…':'Save student'}/>") ,'save action is translated')
