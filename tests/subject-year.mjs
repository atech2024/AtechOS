import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

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

const assignmentPage=readFileSync('src/app/dashboard/assignments/page.tsx','utf8')
const syntax=ts.createSourceFile('assignments-page.tsx',assignmentPage,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const fetchNode=syntax.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='fetchYearAssignments')
assert.ok(fetchNode,'assignment page exposes its year-scoped database query for verification')
const compiled=ts.transpileModule(`${fetchNode.getText(syntax)}\nexports.fetchYearAssignments=fetchYearAssignments`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const evaluated={}
vm.runInNewContext(compiled,{exports:evaluated})
const fetchYearAssignments=evaluated.fetchYearAssignments
const allAssignments=[
 {id:'historic',class_id:'old-class',created_at:'2025-09-01'},
 ...Array.from({length:51},(_,index)=>({id:`recent-${index}`,class_id:'new-class',created_at:`2026-09-${String(index%28+1).padStart(2,'0')}`}))
]
let queries=0
const db={from(table){
 assert.equal(table,'assignments')
 queries++
 let rows=[...allAssignments]
 return {
  select(){return this},
  in(column,ids){assert.equal(column,'class_id');rows=rows.filter(row=>ids.includes(row.class_id));return this},
  order(column,{ascending}){assert.equal(column,'created_at');rows.sort((a,b)=>ascending?a.created_at.localeCompare(b.created_at):b.created_at.localeCompare(a.created_at));return this},
  limit(count){return Promise.resolve({data:rows.slice(0,count),error:null})}
 }
}}
const historic=await fetchYearAssignments(db,['old-class'])
assert.deepEqual(Array.from(historic.data,row=>row.id),['historic'],'older selected-year homework remains visible after 50 newer assignments')
const noYear=await fetchYearAssignments(db,[])
assert.equal(noYear.data.length,0,'an unavailable or empty academic year shows no assignments')
assert.equal(queries,1,'an empty year does not query assignments across every year')
assert.match(assignmentPage,/loadedClasses\.filter\(row=>row\.academic_year_id===academicYearId\)\.map\(row=>row\.id\)/,'assignment query uses classes from the selected year')
assert.match(assignmentPage,/fetchYearAssignments\(db,selectedClassIds\)/,'the page uses the scoped query')
assert.match(assignmentPage,/useCallback\(async\(\)=>[\s\S]*\},\[academicYearId\]\)/,'changing the academic year starts a new load')
assert.match(assignmentPage,/if\(version!==loadVersion\.current\)return/,'an older response cannot replace the newly selected year')
console.log('PASS assignment loading scopes before the 50-item limit and ignores an empty year.')
