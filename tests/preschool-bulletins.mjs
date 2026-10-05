import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const migration=readFileSync('supabase/migrations/20261001144429_preschool_competency_bulletins.sql','utf8')
const activeRoleMigration=readFileSync('supabase/migrations/20261002200218_preschool_active_staff_role_scope.sql','utf8')
const secretaryPublishMigration=readFileSync('supabase/migrations/20261002210335_allow_secretary_to_publish_preschool_bulletins.sql','utf8')
const workspace=readFileSync('src/components/preschool-workspace.tsx','utf8')
for(const text of [
 'create table public.preschool_competencies','create table public.preschool_class_staff','create table public.preschool_evaluations','create table public.preschool_evaluation_events','create table public.preschool_bulletin_versions',
 'alter table public.preschool_bulletin_versions enable row level security','preschool_bulletin_immutable','not_observed','optional_english','optional_religion',
 'public.preschool_report_workspace','public.save_preschool_evaluation','public.save_preschool_class_staff','public.save_preschool_settings','public.publish_preschool_bulletins','public.family_preschool_bulletins',
 'private.can_access_preschool_class','private.can_edit_preschool_class',"'exam_month'","'coordinator'","'attendance'"
])assert.ok(migration.includes(text),`missing preschool capability: ${text}`)
for(const role of ["m.enabled and m.role='teacher'","m.enabled and m.role in ('teacher','school_admin','director','secretary')"])assert.ok(activeRoleMigration.includes(role),`stale Preschool access must require active eligible membership: ${role}`)
assert.ok(secretaryPublishMigration.includes("'director'',''censeur'',''secretary'"),'Preschool publication permission must include the secretary who sees the publish control')
assert.match(activeRoleMigration,/create or replace function private\.can_edit_preschool_class\(p_class uuid\)[\s\S]*?select private\.can_access_preschool_class\(p_class\)/)
assert.match(migration,/revoke all on public\.preschool_program_settings,[\s\S]*?from public,anon,authenticated/i)
assert.match(migration,/private\.family_student\(s\.id\)/,'parent bulletin RPC must remain linked-child scoped')
assert.match(migration,/create or replace function private\.student_report_cards\(p_student uuid\)/)
assert.match(migration,/private\.calculated_student_report_cards\(p_student\)/)
assert.match(migration,/private\.bulletin_card\(v\)/)
assert.match(migration,/'preschool_cards'/)
assert.match(migration,/'students',[\s\S]*?jsonb_build_object\('id',s\.id,'name',s\.first_name\|\|' '\|\|s\.last_name,'photo_url',s\.photo_url\)/,'Preschool teacher roster must not return student codes or national identifiers')
assert.doesNotMatch(workspace,/atechos_id|nisu/i,'Preschool teacher roster must not display AtechOS IDs or NISU')
assert.ok(existsSync('src/app/dashboard/preschool/page.tsx'))
assert.match(readFileSync('src/components/preschool-workspace.tsx','utf8'),/months\.map\(\(m,i\)=>\s*<option[^>]*>\{t\(m\)\}<\/option>\)/,'examination months must follow the selected UI locale')

const navExports={}
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/navigation.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:navExports})
for(const role of ['school_admin','director','secretary','teacher','censeur'])assert.ok(navExports.permittedNavigation([role]).some(item=>item.href==='/dashboard/preschool'),`${role} must see the preschool workflow`)
for(const item of navExports.navigation)assert.ok(existsSync('src/app'+item.href+'/page.tsx'),`${item.href} must resolve to a page`)

const require=createRequire(import.meta.url),componentExports={},translations={}
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/school-date.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:{...componentExports},Intl,Date})
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/translations-extra.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:translations})
const dates={};vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/school-date.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:dates,Intl,Date})
vm.runInNewContext(ts.transpileModule(readFileSync('src/components/report-card.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:componentExports,require:n=>n==='@/components/translation-provider'?{T:({text})=>translations.extraTranslations?.[text]?.[0]||text,useLocale:()=> 'fr'}:n==='@/components/attendance-history'?{default:()=>null}:n==='@/lib/school-date'?dates:n==='@/lib/supabase/client'?{createClient:()=>{throw Error('render must not query')}}:require(n)})
assert.match(workspace,/<h4[^>]*>\\{t\\(domain\\.label\\)\\}<\\/h4>/,'preschool domain headings must follow the selected UI locale')
assert.match(workspace,/Object\\.entries\\(domainLabels\\)[\\s\\S]*?\\{t\\(n\\)\\}<\\/option>/,'preschool domain choices must follow the selected UI locale')
const bulletin={id:'ps-v1',version:2,published_at:'2026-10-01T12:00:00Z',publisher:'Direction',payload:{school:{name:'École test',address:null,phone:null},student:{name:'Test Student',atechos_id:'AOS-PS-1',photo_url:null},class:{name:'Petite Section'},academic_year:'2026-2027',period:'1er Trimestre',period_id:'period-1',exam_month:6,staff:[{role:'titulaire',name:'Mme Titulaire'},{role:'aide_educatrice',name:'Mme Aide'}],coordinator:'Mme Coordination',direction_signature:true,competencies:[{domain:'language',competency:'Écoute une consigne courte',rating:'developing',comment:'Progresse avec accompagnement.'}],remark:'Continue à participer.',attendance:{present:20,late:1,absent:2}}}
const html=renderToStaticMarkup(React.createElement(componentExports.PreschoolReportCard,{document:bulletin}))
for(const value of ['École test','2026-2027','1er Trimestre','Juin','Test Student','AOS-PS-1','Petite Section','Mme Titulaire','Mme Aide','Mme Coordination','Écoute une consigne courte','En développement','Progresse avec accompagnement.','Continue à participer.','20','1','2','Direction','Version officielle 2'])assert.ok(html.includes(value),`preschool bulletin must show ${value}`)
console.log('PASS preschool domains, class-staff security surface, three-level observable evaluations, official snapshots, parent isolation contract, period/month, history and bulletin rendering.')
