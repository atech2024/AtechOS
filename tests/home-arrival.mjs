import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require=createRequire(import.meta.url)
function compile(path,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>imports[n]||require(n)});return exports}

const migration=readFileSync('supabase/migrations/20261005210000_home_arrival_and_preschool_relocation_approval.sql','utf8')
for(const fragment of [
 'create table public.school_home_arrival_settings',
 'create table public.student_home_arrival_confirmations',
 'alter table public.school_home_arrival_settings enable row level security',
 'revoke all on public.school_home_arrival_settings,public.student_home_arrival_confirmations from public,anon,authenticated',
 "private.has_role(sid,array['director'])",
 'public.family_home_arrival_status(p_student uuid)',
 'public.confirm_family_home_arrival(p_student uuid)',
 'public.student_home_arrival_status(p_token text)',
 'public.confirm_student_home_arrival(p_token text)',
 "encode(extensions.digest(p_token,'sha256'),'hex')",
 "se.expires_at>now() and s.portal_enabled and s.active",
 'create trigger student_home_arrival_immutable',
 'unique(attendance_id)',
 "'KIOS'",
])assert.ok(migration.includes(fragment),`migration must enforce: ${fragment}`)
assert.ok(!migration.includes("released_by=auth.uid(),released_role='student'"),'KIOS exit should not claim a staff member performed it')
assert.ok(!migration.includes('finance_override')&&!migration.includes('guard_override'),'the approved checkout must not waive Finance or GUARD restrictions')
assert.ok(migration.includes("old_columns:='insert into public.kindergarten_relocation_cases(school_id,student_id,attendance_id,reason_category,private_note,opened_by,opened_name,opened_role)';"),'relocation request patch must anchor the production INSERT column list')
assert.ok(migration.includes("old_values:='values(sid,p_student,att,p_reason,nullif(trim(p_note),''''),actor,coalesce(actor_name,''Staff''),coalesce(actor_role,''staff'')) returning id into case_id;';"),'relocation request patch must anchor the production INSERT values independently of SQL line breaks')
assert.ok(migration.includes("opened_role,status)')")&&migration.includes("''pending_direction'') returning id into case_id;"),'staff relocation requests must persist pending_direction status before any move')
assert.ok(migration.includes('pending_direction_insert_columns_anchor_missing')&&migration.includes('pending_direction_insert_values_anchor_missing'),'migration must fail safely when the production function shape differs')

const staff=readFileSync('src/components/home-arrival-panel.tsx','utf8')
const student=readFileSync('src/components/student-home-arrival.tsx','utf8')
const action=readFileSync('src/app/student/arrival-actions.ts','utf8')
const attendance=readFileSync('src/app/dashboard/attendance/page.tsx','utf8')
const parent=readFileSync('src/app/dashboard/parent-portal/page.tsx','utf8')
const portal=readFileSync('src/app/student/page.tsx','utf8')
assert.ok(staff.includes("rpc('set_home_arrival_enabled'"),'staff page should expose the Director setting')
assert.ok(staff.includes("rpc('confirm_family_home_arrival'"),'linked parents should be able to confirm arrival')
assert.ok(student.includes('confirmStudentHomeArrival'),'student portal should offer arrival confirmation')
assert.ok(action.includes("get('atechos_student_session')")&&action.includes("rpc('confirm_student_home_arrival'"),'student confirmation must validate the server-side student session token')
assert.ok(attendance.includes('HomeArrivalStaffPanel'),'attendance workspace should show the staff panel')
assert.ok(parent.includes('FamilyHomeArrivalPanel'),'parent portal should show the linked child confirmation')
assert.ok(portal.includes('student_home_arrival_status'),'student portal should load only its own arrival state')

const extra=compile('src/lib/translations-extra.ts')
const translations=compile('src/lib/translations.ts',{'./translations-extra':extra})
for(const text of ['Home-arrival confirmation','Only the Director can activate this feature.','Has the student arrived home safely?','Have you arrived home safely?','Confirm arrival at home','Relocation request sent to Direction. Do not move the student until it is approved.','Waiting for Direction; do not move the student','Please collect your child urgently. The school is reviewing a temporary relocation; contact the school.'])for(const locale of ['fr','ht'])assert.notEqual(translations.translate(text,locale),text,`${text} needs ${locale} translation`)

console.log('PASS Director-only activation, linked-parent and student token isolation, immutable arrival confirmation, home-arrival UI wiring, and French/Haitian Creole strings.')
