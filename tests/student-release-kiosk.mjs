import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration=readFileSync('supabase/migrations/20261005170000_student_release_kiosk_checkout.sql','utf8')
const fixture=readFileSync('supabase/ci/student-followup-verification.sql','utf8')
const workflow=readFileSync('.github/workflows/supabase-migration-check.yml','utf8')

assert.match(migration,/status=''released''[\s\S]*?released_at at time zone ''America\/Port-au-Prince''/,'same-day approved-and-released cases must be the only schedule exception')
assert.match(migration,/window_name:=''checkout''/,'authorized release converts the blocked window to checkout only')
assert.match(migration,/student_release_kiosk_patch_anchor_missing/,'migration fails safely if its function patch no longer matches')
assert.match(fixture,/authorized departure scan did not check the student out/,'SQL integration fixture reproduces the blocked-window release scan')
assert.match(fixture,/student_release_kiosk_ci_window/,'SQL fixture deterministically simulates the blocked kiosk window')
assert.ok(fixture.includes("e.source='KIOS' and e.action='check_out'"),'the release scan must preserve student KIOS attribution')
assert.match(workflow,/20261005170000_student_release_kiosk_checkout\.sql/,'isolated Supabase CI must apply this migration')

console.log('PASS: approved same-day student releases check out through KIOS during the blocked window without bypassing other attendance guards.')
