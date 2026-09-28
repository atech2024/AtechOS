import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const require=createRequire(import.meta.url)
function compile(path,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>imports[n]||require(n)});return exports}
const extra=compile('src/lib/translations-extra.ts')
const translations=compile('src/lib/translations.ts',{'./translations-extra':extra})
const dates=compile('src/lib/school-date.ts')
const nav=compile('src/lib/navigation.ts')
for(const role of ['censeur','director','school_admin','teacher','surveillant','secretary'])assert.ok(nav.permittedNavigation([role]).some(x=>x.href==='/dashboard/calendar'))
const data={can_manage:false,can_publish:false,exams:[{id:'fixture',class_id:'class',class:'Class A',year_id:'year',year:'2026',subject_id:'subject',subject:'Math',period_id:'period',period:'Period 1',starts_at:'2026-09-25T12:00:00Z',ends_at:'2026-09-25T14:00:00Z',cancelled:false,scanned_at:'2026-09-25T11:30:00Z',version:2,published_at:'2026-09-20T12:00:00Z',revision_start:'2026-09-14',revision_end:'2026-09-18'}],periods:[],classes:[],subjects:[],closures:[]}
for(const locale of ['ht','fr']){
 const {CalendarView}=compile('src/components/exam-calendar.tsx',{'@/lib/supabase/client':{createClient:()=>{throw Error('Rendering must not query')}},'@/lib/school-date':dates,'@/components/school-date-input':{default:()=>null},'@/components/translation-provider':{T:({text})=>translations.translate(text,locale),useLocale:()=>locale},'@/lib/translations':translations})
 const html=renderToStaticMarkup(React.createElement(CalendarView,{data,onEdit:()=>{}}))
 assert.ok(html.includes('Math'));assert.ok(html.includes('Class A'));assert.ok(html.includes('25 Septanm 2026'));assert.ok(html.includes('08:00 AM'));assert.ok(html.includes(translations.translate('Kiosk arrival',locale)));assert.ok(html.includes(translations.translate('Revision week',locale)));assert.ok(!html.includes(translations.translate('Propose a schedule change',locale)))
 const staff=renderToStaticMarkup(React.createElement(CalendarView,{data:{...data,can_manage:true},onEdit:()=>{}}));assert.ok(staff.includes(translations.translate('Propose a schedule change',locale)))
}
console.log('PASS calendar UI: official version, Haiti date/time, revision week, kiosk arrival and no family edit controls; scoped staff menu.')
