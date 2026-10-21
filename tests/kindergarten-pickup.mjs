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
const kioskFollowup=readFileSync('supabase/migrations/20261005210000_home_arrival_and_preschool_relocation_approval.sql','utf8')
assert.ok(kioskFollowup.includes("'already_picked_up_by_parent'"),'the next KIOS scan must identify a completed preschool pickup before normal time-window messaging')
assert.ok(readFileSync('src/app/kiosk/page.tsx','utf8').includes('already_picked_up_by_parent'),'the KIOS success state must explain that a parent or authorized adult already collected the child')
for(const contract of ["private.is_preschool_student(s.id)","private.can_operate_kindergarten_pickup(sid)","'PICKUP','pickup_complete'","unique(student_id,pickup_date)","pickup_history_immutable","'already_picked_up'","check_out_at=checkout","'STAFF',auth.uid(),coalesce(actor_name,'Staff')"]){assert.ok(migration.includes(contract),`missing secure pickup rule: ${contract}`)}
const updateMigration=readFileSync('supabase/migrations/20261003000000_limit_duplicate_preschool_pickup_updates.sql','utf8')
for(const contract of ["u.parent_user_id=auth.uid() and u.status=p_status","created_at at time zone 'America/Port-au-Prince'","for update","raise exception 'pickup_update_already_sent'","'kindergarten-pickup-parent:'||update_id::text"]){assert.ok(updateMigration.includes(contract),`missing pickup update protection: ${contract}`)}
const familyUi=readFileSync('src/components/kindergarten-pickup-family.tsx','utf8')
assert.match(familyUi,/pickup_update_already_sent[\s\S]*You have already sent this pickup update today\./,'duplicate update error is shown clearly to the parent')
const fixture=readFileSync('supabase/kindergarten-pickup-verification.sql','utf8')
assert.ok(fixture.includes("source='STAFF' and action='kindergarten_pickup_check_out'"));assert.ok(fixture.includes("source='PICKUP' and result='pickup_complete'"));assert.ok(fixture.includes("sqlerrm='already_picked_up'"));assert.ok(fixture.includes('rolled back'))
for(const text of ['Kindergarten pickup','Scan student badge','Confirm pickup','On the way','Running late','Picked up by','Adult full name','Relationship to student','Pickup recorded.','You have already sent this pickup update today.','This student has already been collected by a parent or authorized adult today.'])for(const locale of ['fr','ht'])assert.notEqual(translations.translate(text,locale),text,`${text} needs ${locale} translation`)
console.log('PASS pickup role visibility, QR-only server contract, preschool scope, immutable one-per-day pickup, attributed attendance checkout and FR/HT UI translations.')
