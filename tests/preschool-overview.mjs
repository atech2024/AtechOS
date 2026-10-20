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

const navigation=readFileSync('src/lib/navigation.ts','utf8')
assert.match(navigation,/href:'\/dashboard\/preschool\/overview'/,'the Preschool workspace must be reachable in the role-aware menu')
assert.match(navigation,/label:'Preschool competency bulletins',href:'\/dashboard\/preschool'/,'the existing evaluation workflow must remain accessible')
const page=readFileSync('src/app/dashboard/preschool/overview/page.tsx','utf8')
for(const role of ['school_admin','director','secretary','teacher','censeur'])assert.ok(page.includes(`'${role}'`),`${role} should retain the established Preschool route access`)
const component=readFileSync('src/components/preschool-overview.tsx','utf8')
assert.match(component,/preschool_report_workspace/,'the dashboard must reuse the existing tenant-scoped Preschool workspace')
assert.match(component,/Role not configured/,'cleaning staff must remain an honest, unconfigured state until its access model is confirmed')
assert.match(component,/No account or access has been created/,'the dashboard must not imply that unsupported staff access exists')
assert.match(component,/state\.manager&&/,'management shortcuts must stay restricted to existing manager access')
assert.match(component,/lg:hidden/,'class rows must use a compact mobile layout instead of forcing a wide table')
assert.match(component,/lg:block/,'wide screens must retain the accessible class table')
assert.doesNotMatch(component,/setYearId/,'the shared app header remains the only academic-year selector')
assert.match(component,/setActiveView\('reports'\)/,'report actions should open inside the Kindergarten workspace')
assert.match(component,/ClassesPage embedded/,'class management should be embedded in the Kindergarten workspace')
assert.match(component,/AttendancePage embedded/,'attendance actions should stay inside the Kindergarten workspace')
assert.match(component,/KindergartenPickupPage embedded/,'pickup workflow should stay inside the Kindergarten workspace')
assert.doesNotMatch(component,/<Link|href=/,'Kindergarten overview actions should not navigate to another dashboard route')
assert.match(component,/preschool-graffiti-art/,'the visual direction should include the agreed colorful Kindergarten illustration')
assert.match(readFileSync('src/app/globals.css','utf8'),/prefers-reduced-motion:reduce\) \{ \.preschool-graffiti-stroke/,'the authored drawing animation should respect reduced-motion preferences')
console.log('Preschool overview roles, data, in-place module actions, and accessible visual states passed.')
