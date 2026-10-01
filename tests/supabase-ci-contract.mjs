import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/supabase-migration-check.yml', 'utf8');
const config = readFileSync('supabase/ci/supabase/config.toml', 'utf8');
const baseline = readFileSync('supabase/ci/supabase/migrations/20260901000000_atechos_ci_baseline.sql', 'utf8');
const verification = readFileSync('supabase/ci/verification.sql', 'utf8');
const guardVerification = readFileSync('supabase/ci/guard-verification.sql', 'utf8');

assert.match(workflow, /supabase\/setup-cli@v1/);
assert.match(workflow, /push:\s+branches:\s+- feature\/kindergarten-relocation/);
assert.match(workflow, /supabase start/);
assert.match(workflow, /supabase db reset --local --no-seed/);
assert.match(workflow, /docker exec -i .* psql .*ON_ERROR_STOP=1/);
assert.match(workflow, /supabase stop --no-backup/);
assert.match(workflow, /20261001001600_kindergarten_private_relocation\.sql/);
assert.match(workflow, /20261001010212_student_kiosk_hide_student_id\.sql/);
for (const migration of ['20260930120000_guard_cases_workflow','20260930121500_guard_deadline_processor','20260930123000_weekly_lateness_guard','20260930194459_guard_school_day_deadlines_notifications','20260930210000_guard_meeting_access_lock','20260930220000_guard_school_day_absence']) assert.ok(workflow.includes(migration+'.sql'), `workflow must apply ${migration}`);
assert.match(workflow, /< guard-verification\.sql/);
assert.doesNotMatch(workflow, /SUPABASE_ACCESS_TOKEN|supabase link|db push|--linked/);
assert.match(config, /project_id = "atechos-migration-check"/);
assert.match(baseline, /create extension if not exists pg_cron/i, 'synthetic Supabase baseline must provide cron.schedule for GUARD jobs');

for (const table of ['schools', 'users', 'students', 'attendance', 'attendance_events', 'classes', 'grade_levels', 'academic_years', 'school_closures', 'notifications', 'enrollments', 'parents', 'student_parents', 'school_members', 'kindergarten_pickups']) {
  assert.match(baseline, new RegExp(`create table public\\.${table}\\b`, 'i'), `missing synthetic ${table} table`);
}
assert.match(baseline, /function private\.record_student_kiosk\(p_student uuid\)/i);
assert.match(baseline, /function public\.scan_student_code\(p_code text,p_school uuid\)/i);

assert.match(verification.trim(), /^begin;/i);
assert.match(verification, /rollback;\s*$/i);
assert.match(verification, /linked parent scope failed/);
assert.match(verification, /unrelated parent saw relocation/);
assert.match(verification, /private relocation detail leaked/);
assert.match(verification, /pickup did not close relocation with actor/);
assert.match(verification, /relocation event history was mutable/);
assert.match(verification, /kiosk result contract failed/);
assert.match(verification, /staff scan result contract failed/);
assert.match(verification, /has_table_privilege\('authenticated'/);
assert.doesNotMatch(verification, /https:\/\/[^\s]*supabase\.co/);
assert.match(guardVerification.trim(), /^begin;/i);
assert.match(guardVerification, /rollback;\s*$/i);
for (const assertion of ['GUARD deadline did not skip closure/weekend','unrelated parent submitted a reason','three weekly lates did not create one case','open-school-day absence was not created at 09:00','missed meeting did not suspend student portal','KIOS did not enforce GUARD suspension','student portal login did not enforce GUARD suspension','confirmed meeting did not restore student portal','unrelated family saw GUARD history']) assert.ok(guardVerification.includes(assertion), `GUARD database fixture must check: ${assertion}`);
assert.doesNotMatch(guardVerification, /https:\/\/[^\s]*supabase\.co/);

console.log('PASS free, isolated Supabase CI contract: synthetic baseline, only targeted migrations, rollback-only data checks, no production credentials or remote database commands.');
