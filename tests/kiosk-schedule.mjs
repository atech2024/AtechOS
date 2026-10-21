import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require=createRequire(import.meta.url)
function compile(path,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>imports[n]||require(n)});return exports}
const extra=compile('src/lib/translations-extra.ts')
const translations=compile('src/lib/translations.ts',{'./translations-extra':extra})
const migration=readFileSync('supabase/migrations/20261020113000_kiosk_school_and_preschool_schedules.sql','utf8')
for(const contract of [
 'create table public.school_kiosk_schedules',
 'enable row level security',
 'revoke all on public.school_kiosk_schedules from public,anon,authenticated',
 "array['school_admin','director','secretary','surveillant','censeur']",
 'public.save_school_kiosk_schedule(',
 "raise exception 'invalid_kiosk_schedule'",
 'preschool_entry_opens_at',
 'preschool_checkout_starts_at',
 'confirmed_official_exam_dates',
 "d.category='exam_period'",
 "if p_check_in_at is null then return 'present'",
 "return 'checkout'",
 'private.kiosk_late_minutes',
 'release_at time not null default time',
 "time >= (select p.release_at",
 'kiosk_schedule_attendance_anchor_missing',
 'kiosk_schedule_protocol_event_anchor_missing',
 'kiosk_schedule_protocol_notice_anchor_missing',
])assert.ok(migration.includes(contract),`missing KIOS schedule policy: ${contract}`)
assert.ok(!migration.includes('finance_override')&&!migration.includes('sanction_override')&&!migration.includes('guard_override'),'KIOS schedules must not bypass existing finance, sanction, or GUARD controls')
const settings=readFileSync('src/components/kiosk-schedule-settings.tsx','utf8')
const route=readFileSync('src/app/dashboard/kiosk-settings/page.tsx','utf8')
const navigation=readFileSync('src/lib/navigation.ts','utf8')
assert.ok(route.includes("'surveillant','censeur'"),'KIOS operators need access to schedule configuration')
assert.ok(navigation.includes("href:'/dashboard/kiosk-settings'"),'the KIOS schedule page must be discoverable in the app menu')
assert.ok(settings.includes("rpc('school_kiosk_schedule_workspace')")&&settings.includes("rpc('save_school_kiosk_schedule'"),'UI must read and save schedules through tenant-scoped RPCs')
assert.ok(settings.includes('Preschool / Kind hours')&&settings.includes('SchoolReleaseProtocolPanel'),'UI must expose separate Kind hours and Direction’s same-day release control')
const release=readFileSync('src/components/school-release-protocol.tsx','utf8')
assert.ok(release.includes('p_release_at:releaseAt')&&release.includes('type="time"'),'Direction needs to set a time for today’s release')
const page=readFileSync('src/app/kiosk/page.tsx','utf8')
assert.ok(!page.includes('Check-out opens at 13:00')&&!page.includes('Check-out 13:00–23:59'),'KIOS public copy must not state a hard-coded checkout time')
for(const text of [
 'KIOS schedules','School-wide KIOS hours','Preschool / Kind hours','Entry opens','On-time entry until','Late entry until','Checkout starts','Checkout closes',
 'Set the school entry and departure periods. KIOS uses Haiti local time and applies the appropriate schedule to each student’s section.',
 'Release time for today','KIOS uses the entry and checkout hours configured by the school, in Haiti local time.',
])for(const locale of ['fr','ht'])assert.notEqual(translations.translate(text,locale),text,`${text} needs ${locale} translation`)

console.log('PASS tenant-scoped school and Kind KIOS schedules, Haiti-local time rules, exam flexibility, Direction release time, permissions and localization.')
