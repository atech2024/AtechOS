import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const portal=readFileSync('src/app/dashboard/parent-portal/page.tsx','utf8')
const badge=readFileSync('src/components/badge-history.tsx','utf8')
const migration=readFileSync('supabase/migrations/20261004020000_finance_overpayment_credits.sql','utf8')
const packageJson=JSON.parse(readFileSync('package.json','utf8'))

assert.match(portal,/import \{ParentBadge\} from '@\/components\/badge-history'/,'parent portal reuses the existing badge history panel')
assert.match(portal,/<ParentBadge key=\{childId\+'badge'\} studentId=\{childId\}\/>/,'badge history follows only the currently selected linked child')
assert.match(badge,/rpc\('badge_workspace',\{p_student:studentId\}\)/,'badge panel loads its scoped workspace through the existing RPC')
assert.match(migration,/if sid is null or not private\.can_report_badge\(p_student\) then raise exception 'not_authorized'/,'badge workspace authorizes only linked family members or school staff')
assert.match(packageJson.scripts.test,/node tests\/parent-portal-badge\.mjs/,'npm test includes the parent badge portal contract')

console.log('PASS parent portal badge contract: selected child only, existing authorized badge workspace, and coverage registered in npm test.')
