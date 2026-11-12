import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration=readFileSync('supabase/migrations/20261005210000_home_arrival_and_preschool_relocation_approval.sql','utf8')
const fixture=readFileSync('supabase/ci/student-followup-verification.sql','utf8')
const workflow=readFileSync('.github/workflows/supabase-migration-check.yml','utf8')

assert.match(migration,/status in \(''approved'',''released''\)[\s\S]*?a\.check_in_at is not null and a\.check_out_at is null/,'only an approved or KIOS-released case for a checked-in student can override the normal time window')
assert.match(migration,/window_name:=''checkout''/,'authorized release converts the blocked window to checkout only')
assert.match(migration,/approved_release_kiosk_window_anchor_missing/,'migration fails safely if the schedule patch no longer matches')
assert.match(migration,/approved_release_kiosk_checkout_anchor_missing/,'migration fails safely if the checkout patch no longer matches')
assert.match(migration,/status=''released'',departure_source=''KIOS''[\s\S]*?released_by=null[\s\S]*?expected_return_at=null/,'KIOS scans must record the actual departure without fabricating staff release or expected-return data')
assert.match(fixture,/approved departure scan did not check the student out/,'SQL integration fixture reproduces the blocked-window release scan')
assert.match(fixture,/student_release_kiosk_ci_window/,'SQL fixture deterministically simulates the blocked kiosk window')
assert.ok(fixture.includes("e.source='KIOS' and e.action='check_out'"),'the release scan must preserve student KIOS attribution')
assert.match(workflow,/20261005210000_home_arrival_and_preschool_relocation_approval\.sql/,'isolated Supabase CI must apply this migration')

console.log('PASS: approved same-day student releases check out through KIOS during the blocked window without bypassing other attendance guards.')
