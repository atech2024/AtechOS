import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const migrationPath='supabase/migrations/20261005153000_family_attendance_history_pagination.sql'
const migration=readFileSync(migrationPath,'utf8')
const fixture=readFileSync('supabase/ci-parent/attendance-verification.sql','utf8')
const workflow=readFileSync('.github/workflows/supabase-migration-check.yml','utf8')
const panel=readFileSync('src/components/family-attendance-panel.tsx','utf8')
const portal=readFileSync('src/app/dashboard/parent-portal/page.tsx','utf8')
const packageJson=JSON.parse(readFileSync('package.json','utf8'))
const translations=readFileSync('src/lib/translations.ts','utf8')

assert.match(migration,/create or replace function public\.family_child_attendance_history\(\s*p_student uuid,\s*p_from date,\s*p_to date,\s*p_limit integer default 30,\s*p_offset integer default 0\s*\)/i)
assert.match(migration,/security definer set search_path=''/i)
assert.match(migration,/p\.user_id=auth\.uid\(\) and m\.role='parent' and m\.enabled/i)
assert.match(migration,/a\.attendance_date between p_from and p_to/i)
assert.match(migration,/order by a\.attendance_date desc,a\.id desc\s+limit p_limit offset p_offset/i)
assert.match(migration,/revoke all on function public\.family_child_attendance_history\(uuid,date,date,integer,integer\) from public,anon/i)
assert.match(migration,/grant execute on function public\.family_child_attendance_history\(uuid,date,date,integer,integer\) to authenticated/i)
for(const assertion of ['first page count failed','pages overlap','date filter failed','unrelated parent read another student attendance','disabled parent membership read attendance','unauthenticated caller read attendance','oversized attendance page was accepted','attendance date range over one year was accepted']) assert.ok(fixture.includes(assertion),`SQL fixture must check: ${assertion}`)
assert.match(workflow,/family-attendance-history:/)
assert.match(workflow,/cp \.\.\/migrations\/20261005153000_family_attendance_history_pagination\.sql supabase\/migrations\//)
assert.match(workflow,/attendance-verification\.sql/)
assert.match(panel,/family_child_attendance_history/)
assert.match(panel,/p_from:range\.from,p_to:range\.to,p_limit:PAGE_SIZE,p_offset:offset/)
assert.match(portal,/import FamilyAttendancePanel from '@\/components\/family-attendance-panel'/)
assert.match(portal,/<FamilyAttendancePanel key=\{childId\}[^>]* studentId=\{childId\}\s*\/>/,'attendance history remounts when the selected child changes')
assert.doesNotMatch(portal,/activity\.attendance/)
for(const key of ['Attendance history','Review daily attendance, late arrivals, absences and check-in/check-out times.','Most recent day','Date from','Date to','Apply dates','No attendance in this date range.','Present','Late','Absent','Check-in','Check-out','Showing']) assert.ok(translations.includes(`"${key}"`),`French and Haitian Creole translations missing for: ${key}`)
assert.ok(packageJson.scripts.test.includes('node tests/family-attendance-history.mjs'),'npm test must include the family attendance history contract')

console.log('PASS family attendance history contract: linked-parent scope, date filtering, bounded pagination, localized parent UI and isolated SQL integration coverage.')
