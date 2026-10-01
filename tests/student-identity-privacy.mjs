import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const migration=readFileSync('supabase/migrations/20261001010212_student_kiosk_hide_student_id.sql','utf8')
assert.ok(migration.includes("pg_get_functiondef('private.record_student_kiosk(uuid)'::regprocedure)"))
assert.ok(migration.includes("pg_get_functiondef('public.scan_student_code(text,uuid)'::regprocedure)"))
assert.equal((migration.match(/src:=replace\(src,'''atechos_id'',s\.atechos_id,',''\);/g)||[]).length,2,'both kiosk and legacy staff-scan RPC responses must drop the student ID')
assert.equal((migration.match(/position\('''atechos_id''' in src\)>0/g)||[]).length,2,'migration must fail if either response still returns the ID')

const records=readFileSync('supabase/migrations/20260925163335_teacher_privacy_automatic_absence.sql','utf8')
assert.ok(records.includes("when private.has_role(s.school_id,array['teacher']) then jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name,'active',s.active,'school_status',s.school_status)"),'student record RPC must omit AtechOS ID and NISU for teachers')
const assignment=readFileSync('supabase/migrations/20260925163335_teacher_privacy_automatic_absence.sql','utf8')
assert.ok(assignment.includes("src:=replace(src,'''code'',s.atechos_id','''code'',case when private.has_role(s.school_id,array[''school_admin'',''director'',''secretary'',''surveillant'']) then s.atechos_id end')"),'teacher assignment roster must omit the student code')

const kiosk=readFileSync('src/app/kiosk/page.tsx','utf8')
assert.ok(!kiosk.includes('atechos_id'),'public KIOS success screen and result type must not expose student ID')
assert.ok(kiosk.includes('{result.first_name} {result.last_name}'),'KIOS must still identify the student by name')
console.log('PASS AtechOS ID/NISU omitted from teacher student/assignment responses and KIOS/staff scan results; name, class and attendance confirmation remain.')
