import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const source=readFileSync('src/lib/preschool-overview.ts','utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const exports={};new Function('exports',compiled)(exports)
const classes=[
 {id:'class-1',name:'PS1-A',grade:'PS1',year_id:'year-1',year:'2026-2027',student_count:20,staff:[{id:'teacher-1',name:'Mme Test',role:'titulaire'},{id:'aide-1',name:'Mme Aide',role:'aide_educatrice'}]},
 {id:'class-2',name:'PS1-B',grade:'ps1',year_id:'year-1',year:'2026-2027',student_count:14,staff:[{id:'teacher-1',name:'Mme Test',role:'titulaire'}]},
 {id:'class-3',name:'PS3-A',grade:'PS3',year_id:'year-1',year:'2026-2027',student_count:18,staff:[]},
]
const levels=exports.summarizePreschoolLevels(classes)
assert.deepEqual(levels.map(({code,classCount,studentCount,teacherCount,assistantCount})=>({code,classCount,studentCount,teacherCount,assistantCount})),[
 {code:'PS1',classCount:2,studentCount:34,teacherCount:1,assistantCount:1},
 {code:'PS2',classCount:0,studentCount:0,teacherCount:0,assistantCount:0},
 {code:'PS3',classCount:1,studentCount:18,teacherCount:0,assistantCount:0},
])
assert.deepEqual(exports.uniquePreschoolStaff(classes).map(person=>person.id),['aide-1','teacher-1'])
assert.deepEqual(exports.uniquePreschoolClassStaff([{id:'teacher-1',name:'Mme Test',role:'aide_educatrice'},{id:'teacher-1',name:'Mme Test',role:'titulaire'},{id:'aide-1',name:'Mme Aide',role:'aide_educatrice'}]).map(person=>[person.id,person.role]),[['aide-1','aide_educatrice'],['teacher-1','titulaire']])
assert.deepEqual(exports.summarizePreschoolLevels([]).map(level=>level.classCount),[0,0,0])
assert.equal(exports.preschoolAttendanceState('late'),'present','late students count as present')
assert.equal(exports.preschoolAttendanceState('checkout'),'present','checked-out students remain present for attendance totals')
assert.equal(exports.preschoolAttendanceState('absent'),'absent')
assert.equal(exports.preschoolAttendanceState(null),'unrecorded')
assert.deepEqual(exports.summarizePreschoolAttendance([{status:'present'},{status:'late'},{status:'checkout'},{status:'absent'},{status:null}]),{present:3,absent:1,unrecorded:1})
const attendanceClasses=[
 {id:'ps-code',grade_level:'PS1',grade_level_id:null},
 {id:'ps-id',grade_level:null,grade_level_id:'grade-ps3'},
 {id:'primary',grade_level:'AF1',grade_level_id:null},
 {id:'secondary',grade_level:null,grade_level_id:'grade-ns1'},
]
assert.deepEqual(exports.filterPreschoolAttendanceClasses(attendanceClasses,[{id:'grade-ps3',code:'PS3'},{id:'grade-ns1',code:'NS1'}]).map(item=>item.id),['ps-code','ps-id'],'Kindergarten attendance must only include PS1–PS3 classes, including classes resolved by grade-level ID')

const navigation=readFileSync('src/lib/navigation.ts','utf8')
assert.match(navigation,/href:'\/dashboard\/preschool\/overview'/,'the Preschool workspace must be reachable in the role-aware menu')
assert.match(navigation,/label:'Preschool competency bulletins',href:'\/dashboard\/preschool'/,'the existing evaluation workflow must remain accessible')
const page=readFileSync('src/app/dashboard/preschool/overview/page.tsx','utf8')
for(const role of ['school_admin','director','secretary','teacher','censeur'])assert.ok(page.includes(`'${role}'`),`${role} should retain the established Preschool route access`)
const component=readFileSync('src/components/preschool-overview.tsx','utf8')
const attendance=readFileSync('src/components/attendance-workspace.tsx','utf8')
assert.match(component,/preschool_report_workspace/,'the dashboard must reuse the existing tenant-scoped Preschool workspace')
assert.match(component,/Role not configured/,'cleaning staff must remain an honest, unconfigured state until its access model is confirmed')
assert.match(component,/No account or access has been created/,'the dashboard must not imply that unsupported staff access exists')
assert.match(component,/state\.manager&&/,'management shortcuts must stay restricted to existing manager access')
assert.match(component,/lg:hidden/,'class rows must use a compact mobile layout instead of forcing a wide table')
assert.match(component,/lg:block/,'wide screens must retain the accessible class table')
assert.doesNotMatch(component,/setYearId/,'the shared app header remains the only academic-year selector')
assert.match(component,/setActiveView\('reports'\)/,'report actions should open inside the Kindergarten workspace')
assert.match(component,/PreschoolSettingsWorkspace/,'the coordinator should manage classes and staff inside Kind settings')
assert.match(component,/state\.manager&&/,'Kindergarten settings should stay permission-gated')
assert.doesNotMatch(component,/ClassesPage/,'Kind class activation and deactivation should remain in school administration')
assert.match(component,/AttendancePage embedded/,'attendance actions should stay inside the Kindergarten workspace')
assert.match(attendance,/preschool_attendance_workspace/,'embedded attendance should use the narrowly scoped Kindergarten roster RPC')
assert.match(attendance,/applyEmbeddedRows/,'attendance overview should group the returned full roster by class')
assert.match(attendance,/summarizePreschoolAttendance\(students/,'attendance totals should include students across all visible preschool classes')
assert.match(attendance,/!embedded&&<AttendanceCalendar/,'Kind attendance must not expose school-wide closure settings')
assert.match(attendance,/classesLoading\|\|loading\?/,'the empty preschool attendance state must wait for both class and roster loading to finish')
assert.match(attendance,/!embedded&&canMark&&<SchoolReleaseProtocolPanel\/>/,'Kindergarten attendance must not expose the school-wide dismissal controls')
assert.match(attendance,/!embedded&&<HomeArrivalStaffPanel\/>/,'Kindergarten attendance must not duplicate the staff home-arrival controls')
assert.match(component,/KindergartenPickupPage embedded/,'pickup workflow should stay inside the Kindergarten workspace')
assert.doesNotMatch(component,/<Link|href=/,'Kindergarten overview actions should not navigate to another dashboard route')
assert.match(component,/preschool-graffiti-art/,'the visual direction should include the agreed colorful Kindergarten illustration')
assert.match(readFileSync('src/app/globals.css','utf8'),/prefers-reduced-motion:reduce\) \{ \.preschool-graffiti-stroke/,'the authored drawing animation should respect reduced-motion preferences')
const migration=readFileSync('supabase/migrations/20261020090533_preschool_kind_workspace_and_team.sql','utf8')
assert.match(migration,/preschool_management_access/,'Kind menu access must come from scoped server authorization')
assert.match(migration,/jsonb_array_length\(p_assignments\)<2 or jsonb_array_length\(p_assignments\)>4/,'a saved classroom team must contain two to four active staff members')
assert.match(migration,/preschool_attendance_workspace/,'the attendance RPC must keep coordinator access limited to preschool roster data')
assert.match(migration,/assignment_role not in \('titulaire','aide_educatrice'\)/,'class staff roles must use the supported teacher and aide roles')
assert.match(migration,/private\.can_access_preschool_class\(c\.id\)/,'non-manager teachers must retain only their assigned-class attendance scope')
console.log('Preschool overview roles, data, in-place module actions, and accessible visual states passed.')
