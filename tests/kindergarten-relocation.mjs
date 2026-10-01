import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require=createRequire(import.meta.url)
function compile(path,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>imports[n]||require(n)});return exports}

const migration=readFileSync('supabase/migrations/20261001001600_kindergarten_private_relocation.sql','utf8')
for(const fragment of [
 'create table public.kindergarten_relocation_cases',
 'create table public.kindergarten_relocation_events',
 'enable row level security',
 'revoke all on public.kindergarten_relocation_cases,public.kindergarten_relocation_events from public,anon,authenticated',
 'private.can_operate_kindergarten_pickup(sid)',
 "public.grade_section(coalesce(c.grade_level,gl.code))='preschool'",
 "a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date",
 "a.status in ('present','late')",
 "a.check_out_at is null",
 "where pa.user_id=actor",
 'pa.school_id=s.school_id',
 'e.school_id=s.school_id',
 "p.school_id=s.school_id",
 "event_type in ('relocated_to_office','parent_contact_attempt','returned_to_class','picked_up')",
 "p_reason is null or p_reason not in ('needs_support','safety','other')",
 "p_outcome is null or p_outcome not in ('reached','no_answer','message_left')",
 'kindergarten_relocation_close_on_pickup',
 'after update of check_out_at on public.attendance',
 'p.pickup_date=new.attendance_date',
 'old.check_out_at is not null',
 "set status='picked_up'",
 'relocation_history_immutable',
 'grant execute on function public.kindergarten_relocation_workspace()'
])assert.ok(migration.includes(fragment),`migration must enforce: ${fragment}`)
assert.ok(!migration.includes('insert into public.notifications'),'relocation must not leave a persistent family notification after pickup')
assert.ok(migration.includes("'message','Please contact the school regarding your child.'"),'family API should expose only a generic message')
const familyApi=migration.split('create or replace function public.kindergarten_parent_relocation_status()')[1]
assert.ok(familyApi&&!familyApi.includes('private_note')&&!familyApi.includes('reason_category')&&!familyApi.includes('kindergarten_relocation_events'),'family response must not expose private notes, reasons, or event history')
assert.ok(!familyApi.includes('opened_at'),'family response must not expose relocation timing')

const staff=readFileSync('src/components/kindergarten-relocation-staff.tsx','utf8')
const family=readFileSync('src/components/kindergarten-relocation-family.tsx','utf8')
const fixture=readFileSync('supabase/kindergarten-relocation-verification.sql','utf8')
assert.ok(staff.includes("rpc('kindergarten_relocation_workspace')"))
assert.ok(staff.includes("rpc('start_kindergarten_relocation'"))
assert.ok(staff.includes("rpc('record_kindergarten_parent_contact'"))
assert.ok(staff.includes("rpc('return_kindergarten_student_to_class'"))
assert.ok(family.includes("rpc('kindergarten_parent_relocation_status')"))
assert.ok(!family.includes('private_note')&&!family.includes('reason_category')&&!family.includes('events'))
for(const scenario of ['PRIVATE-STAFF-ONLY-FIXTURE','PRIVATE-CONTACT-FIXTURE','unrelated parent saw another family relocation','family notice remained after pickup','relocation fixtures passed','all fixtures rolled back'])assert.ok(fixture.includes(scenario),`rollback fixture must verify: ${scenario}`)

const extra=compile('src/lib/translations-extra.ts')
const translations=compile('src/lib/translations.ts',{'./translations-extra':extra})
for(const text of ['Kindergarten private relocation','Needs support','Safety concern','Other','Private staff note','Move student to office','At school office since','Return student to class','No Preschool students are currently on campus.','Contact result','Reached','No answer','Message left','Private contact note','Record contact attempt','Please contact the school regarding your child.'])for(const locale of ['fr','ht'])assert.notEqual(translations.translate(text,locale),text,`${text} needs ${locale} translation`)

console.log('PASS private relocation access, own-child/school family scope, Preschool and on-campus filtering, no persistent family notification, immutable staff audit history, UI RPC wiring, and FR/HT translations.')
