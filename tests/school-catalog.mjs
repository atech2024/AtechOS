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

const dictionary=readFileSync('src/lib/translations-extra.ts','utf8')
for(const label of ['Petite, Moyenne, Grande Section','Petite Section','Moyenne Section','Grande Section'])assert.match(dictionary,new RegExp(`"${label}":\\[`),`${label} needs French and Haitian Creole translations`)
const page=readFileSync('src/app/dashboard/classes/page.tsx','utf8')
assert.match(page,/gradeDisplayName\(g\.code, g\.short_name\)/)
assert.match(page,/gradeDisplayName\(g\.code,g\.short_name\)/)
assert.match(page,/gradeDisplayName\(grade\.code,grade\.name\)/)
console.log('PASS Haitian preschool sections use Petite/Moyenne/Grande Section labels while preserving PS codes and translations.')
