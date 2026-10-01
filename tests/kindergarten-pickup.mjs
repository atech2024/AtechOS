import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function compile(path,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>imports[n]||require(n)});return exports}
const extra=compile('src/lib/translations-extra.ts')
const translations=compile('src/lib/translations.ts',{'./translations-extra':extra})
const nav=compile('src/lib/navigation.ts')
for(const role of ['school_admin','director','secretary','surveillant','censeur'])assert.ok(nav.permittedNavigation([role]).some(item=>item.href==='/dashboard/attendance/kindergarten-pickup'),`${role} needs pickup access`)
assert.ok(!nav.permittedNavigation(['teacher']).some(item=>item.href==='/dashboard/attendance/kindergarten-pickup'))
assert.ok(!nav.permittedNavigation(['parent']).some(item=>item.href==='/dashboard/attendance/kindergarten-pickup'))
const migration=readFileSync('supabase/migrations/20260930232834_kindergarten_pickup_workflow.sql','utf8')
for(const contract of ["private.is_preschool_student(s.id)","private.can_operate_kindergarten_pickup(sid)","'PICKUP','pickup_complete'","unique(student_id,pickup_date)","pickup_history_immutable","'already_picked_up'","check_out_at=checkout","'STAFF',auth.uid(),coalesce(actor_name,'Staff')"]){assert.ok(migration.includes(contract),`missing secure pickup rule: ${contract}`)}
const fixture=readFileSync('supabase/kindergarten-pickup-verification.sql','utf8')
assert.ok(fixture.includes("source='STAFF' and action='kindergarten_pickup_check_out'"));assert.ok(fixture.includes("source='PICKUP' and result='pickup_complete'"));assert.ok(fixture.includes("sqlerrm='already_picked_up'"));assert.ok(fixture.includes('rolled back'))
for(const text of ['Kindergarten pickup','Scan student badge','Confirm pickup','On the way','Running late','Picked up by','Adult full name','Relationship to student','Pickup recorded.'])for(const locale of ['fr','ht'])assert.notEqual(translations.translate(text,locale),text,`${text} needs ${locale} translation`)
console.log('PASS pickup role visibility, QR-only server contract, preschool scope, immutable one-per-day pickup, attributed attendance checkout and FR/HT UI translations.')
