import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const portal=readFileSync('src/app/dashboard/parent-portal/page.tsx','utf8')
const badge=readFileSync('src/components/badge-history.tsx','utf8')
const migration=readFileSync('supabase/migrations/20261004020000_finance_overpayment_credits.sql','utf8')
const packageJson=JSON.parse(readFileSync('package.json','utf8'))

assert.match(portal,/import \{ParentBadge\} from '@\/components\/badge-history'/,'parent portal reuses the existing badge history panel')
assert.match(portal,/<ParentBadge key=\{childId\+'badge'\} studentId=\{childId\} student=\{selectedChild\} photoUrl=\{photoUrl\}/,'badge history follows the selected linked child and receives its identity/photo')
assert.match(portal,/<nav aria-label="Accès rapide aux services du portail"/,'family portal exposes accessible quick navigation')
assert.match(portal,/from\('students'\)\.select\('photo_url'\)\.eq\('id',childId\)/,'parent photo lookup is scoped to the selected child row under RLS')
assert.match(portal,/from\('student-photos'\)\.createSignedUrl\(path,3600\)/,'private student photos are displayed using a short-lived signed URL')
assert.match(portal,/<T text="Student profile"\/>/,'family profile heading is translated')
assert.match(portal,/student=\{selectedChild\} photoUrl=\{photoUrl\}/,'badge receives the selected child identity and photo')
for(const section of ['family-attendance','exam-calendar','family-finance','family-reports','family-assignments']){
 assert.match(portal,new RegExp(`href="#${section}"`),`quick navigation links to ${section}`)
 assert.match(portal,new RegExp(`id="${section}"`),`${section} has a matching destination`)
}
assert.match(badge,/rpc\('badge_workspace',\{p_student:studentId\}\)/,'badge panel loads its scoped workspace through the existing RPC')
assert.match(badge,/alt=\{fullName\} referrerPolicy="no-referrer"/,'badge preview header includes the child portrait without sending referrer data')
assert.match(badge,/AtechOS ID · \{student\.atechos_id\}/,'badge summary identifies the student without exposing NISU')
assert.match(migration,/if sid is null or not private\.can_report_badge\(p_student\) then raise exception 'not_authorized'/,'badge workspace authorizes only linked family members or school staff')
assert.match(packageJson.scripts.test,/node tests\/parent-portal-badge\.mjs/,'npm test includes the parent badge portal contract')

console.log('PASS parent portal contract: quick links reach attendance, exams/calendar, finance, bulletins, and assignments; badge data stays on the selected child.')
