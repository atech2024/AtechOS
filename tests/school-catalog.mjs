import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const exports={}
const source=readFileSync('src/lib/school-catalog.ts','utf8')
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports})
assert.deepEqual(JSON.parse(JSON.stringify(exports.schoolSections.find(x=>x.code==='preschool'))),{code:'preschool',name:'Préscolaire',grades:'Petite, Moyenne, Grande Section'})
assert.equal(exports.gradeDisplayName('PS1','PS1'),'Petite Section')
assert.equal(exports.gradeDisplayName('ps2','PS2'),'Moyenne Section')
assert.equal(exports.gradeDisplayName('PS3','PS3'),'Grande Section')
assert.equal(exports.gradeDisplayName('AF1','1re AF'),'1re AF')
assert.equal(exports.gradeSection('PS1'),'preschool')
assert.equal(exports.gradeSection('PS3'),'preschool')
assert.equal(exports.gradeSection('AF1'),'primary')
assert.equal(exports.gradeSection('AF6'),'primary')
assert.equal(exports.gradeSection('AF7'),'fundamental')
assert.equal(exports.gradeSection('AF9'),'fundamental')
assert.equal(exports.gradeSection('NS4'),'secondary')
assert.equal(exports.schoolSections.find(x=>x.code==='primary').grades,'1re – 6e AF')
assert.equal(exports.schoolSections.find(x=>x.code==='fundamental').grades,'7e – 9e AF')

const dictionary=readFileSync('src/lib/translations-extra.ts','utf8')
for(const label of ['Petite, Moyenne, Grande Section','Petite Section','Moyenne Section','Grande Section'])assert.match(dictionary,new RegExp(`"${label}":\\[`),`${label} needs French and Haitian Creole translations`)
const page=readFileSync('src/app/dashboard/classes/page.tsx','utf8')
assert.match(page,/\['primary', 'Primaire — AF1 à AF6'\]/,'the school structure presents AF1–AF6 as Primaire')
assert.match(page,/\['fundamental', 'Fondamental — AF7 à AF9'\]/,'the school structure presents AF7–AF9 as Fondamental')
assert.match(page,/availableGrades = grades\.filter\(g => enabledSections\.has\(gradeSection\(g\.code\)\)\)/,'class creation only offers grade levels in enabled sections for the selected year')
assert.match(page,/disabled=\{saving \|\| !availableGrades\.length\}/,'class creation is disabled until a section is activated')
assert.match(page,/gradeDisplayName\(g\.code, g\.short_name\)/)
assert.match(page,/gradeDisplayName\(g\.code,g\.short_name\)/)
assert.match(page,/gradeDisplayName\(grade\.code,grade\.name\)/)
assert.match(page,/visible\.length===0 \? <p role="status"[^>]*><T text="No classes are configured for this academic year\."\/>/,'class list has an announced empty state for the selected year')
assert.match(dictionary,/No classes are configured for this academic year\./,'the selected-year class empty state is translated')
console.log('PASS Haitian preschool sections use Petite/Moyenne/Grande Section labels while preserving PS codes and translations.')
