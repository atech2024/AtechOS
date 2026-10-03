import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const require=createRequire(import.meta.url)
const exports={}
const reportCardMock={
 ReportCard:({card})=>React.createElement('p',null,`NUMERIC:${card.period}`),
 PreschoolReportCard:({document})=>React.createElement('p',null,`PRESCHOOL:${document.payload.period}`),
}
const imports={
 '@/components/attendance-history':{default:()=>null},
 '@/components/student-identity-card':{default:()=>null},
 '@/components/report-card':reportCardMock,
 '@/lib/school-date':{schoolDate:value=>value},
}
const compiled=ts.transpileModule(readFileSync('src/app/student/overview.tsx','utf8'),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},
}).outputText
vm.runInNewContext(compiled,{exports,require:name=>imports[name]||require(name),Intl,Date})

const report={cards:[{class_id:'class',period_id:'period',period:'Numeric bulletin',year:'2026/2027'}],preschool_cards:[
 {id:'current',payload:{academic_year:'2026/2027',period_id:'period',period:'Preschool bulletin'}},
 {id:'historic',payload:{academic_year:'2025/2026',period_id:'historic-period',period:'Historic Preschool bulletin'}},
]}
const selected=exports.studentBulletinsForSelection(report,'2026/2027','period')
assert.deepEqual(Array.from(selected.numeric,item=>item.period),['Numeric bulletin'])
assert.deepEqual(Array.from(selected.preschool,item=>item.id),['current'])
assert.deepEqual(Array.from(exports.studentBulletinsForSelection(report,'2025/2026','').preschool,item=>item.id),['historic'])

const html=renderToStaticMarkup(React.createElement(exports.default,{
 student:{id:'student',first_name:'Test',last_name:'Student',atechos_id:'AOS-TEST',class_name:'PS1',academic_year:'2026/2027',photo_available:false},
 grades:[],attendance:[],periods:[{id:'period',name:'First period',year:'2026/2027',start_date:'2026-09-01',end_date:'2026-12-01',exam_start:null,exam_end:null}],report,
}))
assert.ok(html.includes('PRESCHOOL:Preschool bulletin'),'student portal renders its published Preschool bulletin')
assert.ok(!html.includes('PRESCHOOL:Historic Preschool bulletin'),'student portal initially shows only the selected year')
assert.ok(html.includes('2025/2026'),'historic Preschool bulletin year remains selectable')
console.log('PASS student portal renders published Preschool bulletins scoped to selected year and period.')
