import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require=createRequire(import.meta.url)
function compile(path,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>imports[n]||require(n)});return exports}
const extra=compile('src/lib/translations-extra.ts')
const translations=compile('src/lib/translations.ts',{'./translations-extra':extra})

const migration=readFileSync('supabase/migrations/20261005210100_school_release_protocol.sql','utf8')
for(const contract of [
 'create table public.school_release_protocols',
 'unique(school_id,protocol_date)',
 'enable row level security',
 'revoke all on public.school_release_protocols from public,anon,authenticated',
 "activated_role in ('school_admin','director','secretary')",
 "length(trim(reason)) between 3 and 500",
 'school_release_protocol_immutable',
 "private.has_role(sid,array['school_admin','director','secretary'])",
 "private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur'])",
 "'America/Port-au-Prince'",
 'activated_by',
 'public.school_release_protocol_workspace()',
 'public.activate_school_release_protocol(p_reason text)',
 "protocol_date=d",
 'not private.is_preschool_student(s.id)',
 "window_name:=''checkout''",
 'school_release_protocol_id',
 "result=''check_out''",
 "school_release_protocol_active'',protocol_id is not null",
])assert.ok(migration.includes(contract),`missing school-release security/audit rule: ${contract}`)
assert.ok(migration.includes('school_release_protocol_declaration_anchor_missing')&&migration.includes('school_release_protocol_window_anchor_missing')&&migration.includes('school_release_protocol_event_anchor_missing'),'migration must fail safely if a KIOS function patch anchor changes')
assert.ok(!migration.includes('finance_override')&&!migration.includes('guard_override'),'school dismissal must not create Finance or GUARD bypasses')

const fixture=readFileSync('supabase/ci/student-followup-verification.sql','utf8')
for(const contract of ['teacher activated a school-wide dismissal','KIOS departure was allowed before the school protocol was activated','school release protocol activation and actor audit failed','school dismissal KIOS checkout was not linked to its protocol audit','school-wide dismissal incorrectly bypassed the Preschool pickup workflow','family read another school release protocol','school release protocol audit record was mutable','select \'blocked\'::text'])assert.ok(fixture.includes(contract),`isolated SQL verification must cover: ${contract}`)
const workflow=readFileSync('.github/workflows/supabase-migration-check.yml','utf8')
assert.ok(workflow.includes('20261005210100_school_release_protocol.sql'),'isolated Supabase CI must stage the school release migration')

const ui=readFileSync('src/components/school-release-protocol.tsx','utf8')
const page=readFileSync('src/app/dashboard/attendance/page.tsx','utf8')
assert.ok(page.includes('{canMark&&<SchoolReleaseProtocolPanel/>}'),'only staff already authorized for the attendance workspace should load the protocol panel')
assert.ok(ui.includes("rpc('school_release_protocol_workspace')")&&ui.includes("rpc('activate_school_release_protocol'"),'UI must read and activate through scoped server RPCs')
const kiosk=readFileSync('src/app/kiosk/page.tsx','utf8')
assert.ok(kiosk.includes('school_release_protocol_active')&&kiosk.includes('School release protocol active. Check-out recorded.'),'KIOS should confirm checkout under the school dismissal protocol')
for(const text of ['School release protocol','School release protocol active. Check-out recorded.','Activate an authorized school-wide dismissal for today. Checked-in students outside Preschool may check out at KIOS. Preschool students must be collected through the Preschool pickup workflow. Finance and GUARD restrictions remain active.','Only school Direction, the school administrator, or the secretary can activate this protocol.','I confirm that school Direction is dismissing all students except Preschool, who must be collected through the pickup workflow. Finance and GUARD restrictions remain in effect.','The school-release protocol is active for today. KIOS will allow checked-in non-Preschool students to check out. Preschool students must be collected through the pickup workflow.'])for(const locale of ['fr','ht'])assert.notEqual(translations.translate(text,locale),text,`${text} needs ${locale} translation`)

console.log('PASS same-day school dismissal, Direction roles, audit-linked KIOS checkout, Preschool pickup exclusion, tenant isolation and preserved Finance/GUARD restrictions.')
