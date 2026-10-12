import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function compile(path,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>imports[n]||require(n)});return exports}
const {hydratePeriodDates}=compile('src/lib/grading-period-editor.ts')
assert.deepEqual(JSON.parse(JSON.stringify(hydratePeriodDates({sections:['preschool','primary'],start_date:'2026-10-12',end_date:'2026-10-16',section_dates:{preschool:{start_date:'2026-10-12',end_date:'2026-10-16'},primary:{start_date:'2026-10-12',end_date:'2026-10-16'}}}))),{sectionDates:{preschool:{start_date:'2026-10-12',end_date:'2026-10-16'},primary:{start_date:'2026-10-12',end_date:'2026-10-16'}},sameDates:true,start_date:'2026-10-12',end_date:'2026-10-16'})
const distinct=hydratePeriodDates({sections:['preschool','primary','secondary'],start_date:'2026-10-12',end_date:'2026-10-16',section_dates:{preschool:{start_date:'2026-10-12',end_date:'2026-10-16'},primary:{start_date:'2026-10-19',end_date:'2026-10-23'}}})
assert.equal(distinct.sameDates,false)
assert.deepEqual(JSON.parse(JSON.stringify(distinct.sectionDates)),{preschool:{start_date:'2026-10-12',end_date:'2026-10-16'},primary:{start_date:'2026-10-19',end_date:'2026-10-23'},secondary:{start_date:'2026-10-12',end_date:'2026-10-16'}})
const legacy=hydratePeriodDates({sections:['primary','fundamental'],start_date:'2026-11-02',end_date:'2026-11-06'})
assert.equal(legacy.sameDates,true);assert.equal(legacy.sectionDates.fundamental.start_date,'2026-11-02')
const page=readFileSync('src/app/dashboard/grading-periods/page.tsx','utf8')
assert.ok(page.includes('onClick={()=>editPeriod(p)}')&&page.includes('setSectionDates(editor.sectionDates)'),'saved period edit action hydrates every section date')
assert.ok(page.includes('p_section_dates:dates'),'save continues using the validated section-date RPC')
console.log('PASS grading period editor: shared dates, distinct section dates, partial/legacy fallback and edit hydration')
