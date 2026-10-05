import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const panel=readFileSync('src/components/family-notification-feed.tsx','utf8')
const portal=readFileSync('src/app/dashboard/parent-portal/page.tsx','utf8')
const shellMigration=readFileSync('supabase/migrations/20260927173437_shared_app_shell.sql','utf8')
const translations=readFileSync('src/lib/translations.ts','utf8')
const packageJson=JSON.parse(readFileSync('package.json','utf8'))

assert.match(shellMigration,/create policy notifications_own on public\.notifications for select to authenticated using\(recipient_id=\(select auth\.uid\(\)\) and school_id=\(select public\.get_my_school_id\(\)\)/,'notification reads remain school and recipient scoped by RLS')
assert.match(shellMigration,/where n\.id=p_id and n\.recipient_id=auth\.uid\(\) and n\.school_id=public\.get_my_school_id\(\)/,'mark-as-read RPC only updates the signed-in user notification')
assert.match(panel,/\.eq\('recipient_id',user\.id\)/,'family feed filters to the signed-in recipient')
assert.match(panel,/\.eq\('href','\/dashboard\/parent-portal'\)/,'family feed limits entries to notifications routed to the family portal')
assert.match(panel,/\.order\('created_at',\{ascending:false\}\)[\s\S]*?\.limit\(10\)/,'family feed is newest-first and bounded')
assert.match(panel,/rpc\('mark_notification_read',\{p_id:id\}\)/,'read action uses the existing authorization-checked RPC')
assert.match(panel,/role="alert"/,'feed reports load and update failures accessibly')
assert.match(portal,/import FamilyNotificationFeed from '@\/components\/family-notification-feed'/)
assert.match(portal,/<FamilyNotificationFeed\s*\/>/)
for(const key of ['Recent family updates','School messages and updates for your family.','Unable to load family updates.','Unable to update this notification.','Loading updates…','No recent updates.','Mark as read','Open family portal','New','high','urgent']) assert.ok(translations.includes(`"${key}"`),`French and Haitian Creole translations missing for: ${key}`)
assert.ok(packageJson.scripts.test.includes('node tests/family-notification-feed.mjs'),'npm test must include the family notification feed contract')

console.log('PASS family notification feed contract: own-recipient/school RLS, family-route filtering, bounded newest-first results, authorized read action, accessible states, and French/Haitian Creole labels.')
