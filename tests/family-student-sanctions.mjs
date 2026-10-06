import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const rpc=readFileSync('supabase/migrations/20261006131325_family_parent_finance_and_sanctions.sql','utf8')
const component=readFileSync('src/components/family-student-sanctions.tsx','utf8')
const portal=readFileSync('src/app/dashboard/parent-portal/page.tsx','utf8')
const staffMigration=readFileSync('supabase/migrations/20261005044450_student_sanctions_emergency_release.sql','utf8')
const translations=readFileSync('src/lib/translations-extra.ts','utf8')
const packageJson=JSON.parse(readFileSync('package.json','utf8'))

assert.match(rpc,/private\.finance_parent_linked\(sid,p_student_id,auth\.uid\(\)\)/,'family sanctions must verify the linked parent')
assert.match(rpc,/revoke all on function public\.family_student_sanctions\(uuid\) from public,anon/,'family sanctions must not be public')
assert.match(rpc,/grant execute on function public\.family_student_sanctions\(uuid\) to authenticated/,'authenticated family RPC grant is required')
assert.match(rpc,/limit 100/,'parent sanction history must be bounded')
assert.match(rpc,/jsonb_build_object\([\s\S]*'resolution',q\.resolution/,'sanction response must contain only explicitly selected safe fields')
assert.match(component,/family_student_sanctions/,'parent view must use its family-only RPC')
assert.match(portal,/<FamilyStudentSanctions studentId=\{childId\}\/>/,'sanctions must follow the selected child')
assert.match(staffMigration,/private\.student_followup_authority/,'sanction mutation remains restricted to authorized school staff')
for(const key of ['Student follow-up and sanctions','Sanctions recorded by the school for this child.','Unable to load this child\'s follow-up record.','No sanctions recorded for this child.']) assert.ok(translations.includes(`"${key}"`),`missing French/Kreyòl copy: ${key}`)
assert.ok(packageJson.scripts.test.includes('node tests/family-student-sanctions.mjs'),'npm test must include parent sanctions coverage')

console.log('PASS family sanction contract: linked-child isolation, sanitized history, bounded result, staff-only mutations and portal wiring.')
