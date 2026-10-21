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
const studentPage=readFileSync('src/app/dashboard/students/page.tsx','utf8')
assert.ok(studentPage.includes("{!editing && <label><T text=\"Class\""),'class choice is available only during initial enrollment')
assert.ok(studentPage.includes('Student ID and class are read-only here.'),'existing record editor explicitly keeps ID and class read-only')
assert.ok(studentPage.includes("editing ? {...form,class_id:null} : form"),'existing record save never submits a class ID')
const classGuard=readFileSync('supabase/migrations/20260927201159_student_class_change_guard.sql','utf8')
assert.ok(classGuard.includes("if cid is not null then raise exception 'use_academic_progression'"),'database rejects class changes through the generic edit RPC')
assert.ok(classGuard.includes("perform public.update_student(p_student_id=>stid"),'existing student edits do not replace the generated AtechOS ID')
const badge=readFileSync('src/components/badge-card.tsx','utf8')
for(const field of ['identity.photo','identity.name','identity.className','identity.code','identity.school'])assert.ok(badge.includes(field),`printable badge includes ${field}`)
assert.ok(badge.includes('h-[85.6mm]')&&badge.includes('w-[53.98mm]'),'badge uses physical portrait CR80 dimensions')
console.log('PASS AtechOS ID/NISU omitted from teacher student/assignment responses and KIOS/staff scan results; name, class and attendance confirmation remain.')
