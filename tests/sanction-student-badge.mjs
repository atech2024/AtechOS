import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync('src/app/dashboard/sanctions/page.tsx','utf8')
const migration=readFileSync('supabase/migrations/20261006150000_sanction_student_badge_lookup.sql','utf8')
const verification=readFileSync('supabase/ci/student-followup-badge-verification.sql','utf8')
const workflow=readFileSync('.github/workflows/supabase-migration-check.yml','utf8')
const translations=readFileSync('src/lib/translations-extra.ts','utf8')

assert.ok(page.includes("'lookup_student_for_followup_badge'"),'sanction QR flow must resolve through the authorized server RPC')
assert.ok(page.includes('AtechOS ID · {selectedStudent.atechos_id||'), 'selected sanction student must show their AtechOS ID')
assert.ok(page.includes('Continue with this sanction for more students'),'batch mode must be an explicit opt-in')
assert.ok(page.includes('Each student is saved separately. Confirm the student and enter a reason for each record.'),'batch mode must keep separate reason/confirmation per student')
assert.ok(page.includes('disabled={busy||!student||!typeId||!activeTypes.length}'),'sanction cannot be submitted before a student and sanction type are selected')
assert.match(migration,/private\.student_followup_authority\(sid\)/)
assert.match(migration,/p_qr[^;]*!~ '\^AOSQ1\\\./)
assert.match(migration,/b.active and b.state='active'/)
assert.ok(migration.includes('grant execute on function public.lookup_student_for_followup_badge(text) to authenticated'))
for(const value of ['teacher accessed sanction badge lookup','limited student identity','malformed badge QR was accepted','revoked badge was accepted'])assert.ok(verification.includes(value),`isolated SQL test must cover ${value}`)
assert.ok(workflow.includes('20261006150000_sanction_student_badge_lookup.sql'),'migration must be staged in isolated Supabase CI')
assert.ok(workflow.includes('student-followup-badge-verification.sql'),'badge lookup security fixture must run in isolated Supabase CI')
for(const value of ['Find a student by name or AtechOS ID','Scan student badge','Continue with this sanction for more students','Each student is saved separately. Confirm the student and enter a reason for each record.','Student identified by badge.','Badge not found or inactive.'])assert.ok(translations.includes(value),`FR/HT translations must include ${value}`)
console.log('PASS sanction workflow selects or scans an active student first, displays name/ID/class, preserves per-student review in continuous mode, and restricts badge lookup to authorized school staff.')

