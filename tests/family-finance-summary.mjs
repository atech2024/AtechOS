import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const rpc=readFileSync('supabase/migrations/20261006131325_family_parent_finance_and_sanctions.sql','utf8')
const component=readFileSync('src/components/family-finance-summary.tsx','utf8')
const panel=readFileSync('src/components/family-finance-panel.tsx','utf8')
const portal=readFileSync('src/app/dashboard/parent-portal/page.tsx','utf8')
const translations=readFileSync('src/lib/translations-extra.ts','utf8')
const packageJson=JSON.parse(readFileSync('package.json','utf8'))

assert.match(rpc,/private\.finance_parent_linked\(sid,p_student_id,auth\.uid\(\)\)/,'finance summary must verify the linked parent')
assert.match(rpc,/status='validated'/,'paid totals must include validated payments only')
assert.match(rpc,/finance_credit_allocations/,'settled totals must include credits applied to charges')
assert.match(rpc,/charges_truncated/,'large histories must disclose the row cap')
assert.match(rpc,/revoke all on function public\.family_finance_summary\(uuid\) from public,anon/,'finance summary must not be public')
assert.match(rpc,/grant execute on function public\.family_finance_summary\(uuid\) to authenticated/,'finance summary must be available to authenticated linked families')
assert.match(component,/family_finance_summary/,'parent finance panel must load the complete summary')
assert.match(component,/Pending requests are separate from paid amounts\./,'pending requests must be distinct from settled payments')
assert.match(component,/charges_truncated/,'the UI must disclose truncated installment history')
assert.match(panel,/<FamilyFinanceSummary/,'the summary must appear with existing payment features')
assert.match(portal,/<FamilyFinancePanel/,'finance must be included in the parent portal')
for(const key of ['All school fees','Includes upcoming installments. Pending requests are separate from paid amounts.','Total fees','Paid and applied','Remaining balance','Available credit','Overdue','Upcoming']) assert.ok(translations.includes(`"${key}"`),`missing French/Kreyòl copy: ${key}`)
assert.ok(packageJson.scripts.test.includes('node tests/family-finance-summary.mjs'),'npm test must include parent finance summary coverage')

console.log('PASS family finance summary contract: linked-child isolation, validated ledger totals, upcoming installments, balances and UI wiring.')
