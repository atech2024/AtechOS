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
 const {CalendarView}=compile('src/components/exam-calendar.tsx',{'@/lib/supabase/client':{createClient:()=>{throw Error('Rendering must not query')}},'@/lib/school-date':dates,'@/components/school-date-input':{default:()=>null},'@/components/translation-provider':{T:({text})=>translations.translate(text,locale),useLocale:()=>locale},'@/components/academic-year-context':{useAcademicYear:()=>({years:[],year:null,yearId:'',canSelect:false,setYearId:()=>{}})},'@/lib/translations':translations})
 const html=renderToStaticMarkup(React.createElement(CalendarView,{data,onEdit:()=>{}}))
 assert.ok(html.includes('Math'));assert.ok(html.includes('Class A'));assert.ok(html.includes(locale==='fr'?'25 septembre 2026':'25 Septanm 2026'));assert.ok(html.includes('08:00 AM'));assert.ok(html.includes(translations.translate('Kiosk arrival',locale)));assert.ok(html.includes(translations.translate('Revision week',locale)));assert.ok(!html.includes(translations.translate('Propose a schedule change',locale)))
 const staff=renderToStaticMarkup(React.createElement(CalendarView,{data:{...data,can_manage:true},onEdit:()=>{}}));assert.ok(staff.includes(translations.translate('Propose a schedule change',locale)))
}
const secondExam={...data.exams[0],id:'fixture-other-year',year_id:'year-2',year:'2027',class:'Class B'}
const {CalendarView}=compile('src/components/exam-calendar.tsx',{'@/lib/supabase/client':{createClient:()=>{throw Error('Rendering must not query')}},'@/lib/school-date':dates,'@/components/school-date-input':{default:()=>null},'@/components/translation-provider':{T:({text})=>text,useLocale:()=> 'fr'},'@/components/academic-year-context':{useAcademicYear:()=>({years:[],year:null,yearId:'',canSelect:false,setYearId:()=>{}})},'@/lib/translations':translations})
const selectedYearHtml=renderToStaticMarkup(React.createElement(CalendarView,{data:{...data,exams:[...data.exams,secondExam]},academicYearId:'year'}))
assert.ok(selectedYearHtml.includes('Class A'));assert.ok(!selectedYearHtml.includes('Class B'),'The shared academic year must scope the published exam list.')
const publication=readFileSync('src/app/dashboard/publication/page.tsx','utf8')
assert.ok(publication.includes('const yearRows=rows.filter(r=>!academicYearId||r.year_id===academicYearId)'),'Publication review must limit batch actions to the selected academic year.')
console.log('PASS calendar UI: official version, Haiti date/time, revision week, kiosk arrival and no family edit controls; scoped staff menu.')
