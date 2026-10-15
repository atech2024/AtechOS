import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const require=createRequire(import.meta.url)
const reportCardMock={
 ReportCard:({card})=>React.createElement('p',null,`NUMERIC:${card.period}`),
 PreschoolReportCard:({document})=>React.createElement('p',null,`PRESCHOOL:${document.payload.period}`),
}
function compile(path,imports={}){
 const exports={}
 const compiled=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
 vm.runInNewContext(compiled,{exports,require:name=>imports[name]||require(name),Intl,Date})
 return exports
}
const extra=compile('src/lib/translations-extra.ts')
const translations=compile('src/lib/translations.ts',{'./translations-extra':extra})

const report={cards:[{class_id:'class',period_id:'period',period:'Numeric bulletin',year:'2026/2027'}],preschool_cards:[
 {id:'current',payload:{academic_year:'2026/2027',period_id:'period',period:'Preschool bulletin'}},
 {id:'historic',payload:{academic_year:'2025/2026',period_id:'historic-period',period:'Historic Preschool bulletin'}},
]}
for(const locale of ['fr','ht','en']){
 const modules={
  '@/components/attendance-history':{default:()=>null},
  '@/components/student-identity-card':{default:()=>null},
  '@/components/report-card':reportCardMock,
  '@/lib/school-date':{schoolDate:(value,selected)=>`${selected}:${value}`},
  '@/lib/translations':translations,
  '@/components/translation-provider':{T:({text})=>translations.translate(text,locale),useLocale:()=>locale},
 }
 const overview=compile('src/app/student/overview.tsx',modules)
 const StudentOverview=overview.default
 const selected=overview.studentBulletinsForSelection(report,'2026/2027','period')
 assert.deepEqual(Array.from(selected.numeric,item=>item.period),['Numeric bulletin'])
 assert.deepEqual(Array.from(selected.preschool,item=>item.id),['current'])
 assert.deepEqual(Array.from(overview.studentBulletinsForSelection(report,'2025/2026','').preschool,item=>item.id),['historic'])
 const html=renderToStaticMarkup(React.createElement(StudentOverview,{
  student:{id:'student',first_name:'Test',last_name:'Student',atechos_id:'AOS-TEST',class_name:'PS1',academic_year:'2026/2027',photo_available:false},
  grades:[],attendance:[{date:'2026-10-05',status:'present',check_in_at:null,check_out_at:null,year:'2026/2027'}],periods:[{id:'period',name:'First period',year:'2026/2027',start_date:'2026-09-01',end_date:'2026-12-01',exam_start:'2026-10-20',exam_end:'2026-10-21'}],report,
 }))
 assert.ok(html.includes('PRESCHOOL:Preschool bulletin'),'student portal renders its published Preschool bulletin')
 assert.ok(!html.includes('PRESCHOOL:Historic Preschool bulletin'),'student portal initially shows only the selected year')
 assert.ok(html.includes('2025/2026'),'historic Preschool bulletin year remains selectable')
 assert.ok(html.includes(`${locale}:2026-10-20`),'exam dates use the selected locale formatter')
 assert.ok(html.includes(locale==='fr'?'Présences, retards et absences':locale==='ht'?'Prezans, reta ak absans':'Attendance, lateness and absences'),'attendance summary is translated for the selected locale')
 for(const [label,expected] of Object.entries(locale==='fr'?{Present:'Présent',Late:'En retard',Absent:'Absent'}:locale==='ht'?{Present:'Prezans',Late:'An reta',Absent:'Absan'}:{Present:'Present',Late:'Late',Absent:'Absent'})) assert.ok(html.includes(`aria-label="${expected}"`),`${label} progress accessibility label follows ${locale}`)
}
console.log('PASS student portal renders year-scoped bulletins and localizes attendance and exam dates in French, Haitian Creole, and English.')
