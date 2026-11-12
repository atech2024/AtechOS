import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const panel=readFileSync('src/components/family-notification-feed.tsx','utf8')
const portal=readFileSync('src/app/dashboard/parent-portal/page.tsx','utf8')
const guardPage=readFileSync('src/app/dashboard/guard/page.tsx','utf8')
const shellMigration=readFileSync('supabase/migrations/20260927173437_shared_app_shell.sql','utf8')
const translations=readFileSync('src/lib/translations.ts','utf8')
const packageJson=JSON.parse(readFileSync('package.json','utf8'))

assert.match(shellMigration,/create policy notifications_own on public\.notifications for select to authenticated using\(recipient_id=\(select auth\.uid\(\)\) and school_id=\(select public\.get_my_school_id\(\)\)/,'notification reads remain school and recipient scoped by RLS')
assert.match(shellMigration,/where n\.id=p_id and n\.recipient_id=auth\.uid\(\) and n\.school_id=public\.get_my_school_id\(\)/,'mark-as-read RPC only updates the signed-in user notification')
assert.match(panel,/\.eq\('recipient_id',user\.id\)/,'family feed filters to the signed-in recipient')
assert.match(panel,/\.eq\('href','\/dashboard\/parent-portal'\)/,'family feed limits entries to notifications routed to the family portal')
assert.match(panel,/\.order\('created_at',\{ascending:false\}\)[\s\S]*?\.limit\(10\)/,'family feed is newest-first and bounded')
assert.match(panel,/rpc\('mark_notification_read',\{p_id:id\}\)/,'read action uses the existing authorization-checked RPC')
assert.match(panel,/familyNotificationDestination\(item\.type,item\.href,item\.event_key\)/,'GUARD notifications link to their actionable case')
assert.match(guardPage,/id=\{`guard-case-\$\{c\.id\}`\}/,'GUARD cases expose a focus target for the notification link')
assert.match(guardPage,/cases\.some\(item=>item\.id===target\)/,'GUARD only focuses a case returned by the authorized workspace')
assert.match(panel,/role="alert"/,'feed reports load and update failures accessibly')
assert.match(portal,/import FamilyNotificationFeed from '@\/components\/family-notification-feed'/)
assert.match(portal,/<FamilyNotificationFeed\s*\/>/)
for(const key of ['Recent family updates','School messages and updates for your family.','Unable to load family updates.','Unable to update this notification.','Loading updates…','No recent updates.','Mark as read','Open family portal','New','high','urgent']) assert.ok(translations.includes(`"${key}"`),`French and Haitian Creole translations missing for: ${key}`)
assert.ok(packageJson.scripts.test.includes('node tests/family-notification-feed.mjs'),'npm test must include the family notification feed contract')

function loadTypeScript(path,dependencies={}){
 const source=readFileSync(path,'utf8')
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const loadedModule={exports:{}}
 new Function('require','module','exports',output)((name)=>{
  if(!(name in dependencies))throw Error(`Unexpected dependency: ${name}`)
  return dependencies[name]
 },loadedModule,loadedModule.exports)
 return loadedModule.exports
}
const schoolDate=loadTypeScript('src/lib/school-date.ts')
const display=loadTypeScript('src/lib/family-notification-display.ts',{'./school-date':schoolDate})
assert.equal(display.familyNotificationTitle('guard','GUARD · deadline_passed','fr'),'GUARD · Délai dépassé')
assert.equal(display.familyNotificationTitle('guard','GUARD · needs_family_reason','ht'),'GUARD · N ap tann rezon fanmi an')
assert.equal(display.familyNotificationTitle('guard','GUARD · meeting_required','en'),'GUARD · Family meeting required')
assert.equal(display.familyNotificationDescription('guard','Élève Test · absence · 2026-10-13','fr'),'Élève Test · absence · 13 octobre 2026')
assert.equal(display.familyNotificationDescription('guard','Élève Test · lateness · 2026-10-13','ht'),'Élève Test · reta · 13 Oktòb 2026')
assert.equal(display.familyNotificationTitle('other','GUARD · deadline_passed','fr'),'GUARD · deadline_passed','unrelated titles stay intact')
assert.equal(display.familyNotificationDescription('guard','Un message personnalisé','fr'),'Un message personnalisé','unrecognized messages stay intact')
const caseId='11111111-2222-4333-8444-555555555555'
assert.equal(display.familyNotificationDestination('guard','/dashboard/parent-portal',`guard:${caseId}:awaiting_reason`),`/dashboard/guard?case=${caseId}`)
assert.equal(display.familyNotificationDestination('guard','/dashboard/parent-portal','unknown'),'/dashboard/guard','older GUARD messages still reach the actionable page')
assert.equal(display.familyNotificationDestination('other','/dashboard/parent-portal',null),'/dashboard/parent-portal','unrelated destinations stay intact')

console.log('PASS family notification feed contract: own-recipient/school RLS, family-route filtering, bounded newest-first results, authorized read action, accessible states, and French/Haitian Creole labels.')
