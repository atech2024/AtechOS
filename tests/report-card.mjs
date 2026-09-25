import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const require=createRequire(import.meta.url),exports={}
const dateExports={}
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/school-date.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:dateExports,Intl,Date})
const source=readFileSync('src/components/report-card.tsx','utf8')
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>n==='@/components/attendance-history'?{default:()=>null}:n==='@/lib/school-date'?dateExports:n==='@/lib/supabase/client'?{createClient:()=>{throw Error('render must not call database')}}:require(n)})
const card={class_id:'c',class_name:'NS1',year:'2026 / 2027',period_id:'p',period:'Premier contrôle',subjects:[{id:'s',name:'Mathématiques',ready:true,note:8,earned:240,possible:300,assessments:[{assessment:'Contrôle 1',score:240,max_score:300,weight:100}]}],complete:true,average:8,earned:240,possible:300,position:1,class_size:20,rank_ready:true,status:'passed',exam_start:'2026-10-01',exam_end:'2026-10-05'}
const report={passing_average:6,student:{first_name:'Test',last_name:'Élève',atechos_id:'AOS-TEST'},school:{name:'École test'}}
const render=c=>renderToStaticMarkup(React.createElement(exports.ReportCard,{report,card:c}))
let html=render(card);assert.ok(html.includes('Note / 10'));assert.ok(html.includes('Moyenne générale'));assert.ok(html.includes('240.00 / 300.00'));assert.ok(html.includes('1 Oktòb 2026'));assert.ok(html.includes('1 / 20'));assert.ok(html.includes('Admis'))
html=render({...card,complete:false,average:null,earned:null,possible:null,position:null,rank_ready:false,status:'incomplete'});assert.ok(html.includes('Incomplet'));assert.ok(html.includes('En attente'));assert.ok(!html.includes('1 / 20'))
html=render({...card,status:'parent_meeting',average:3});assert.ok(html.includes('rencontre avec les parents'));assert.ok(html.includes('Aucune exclusion automatique'))
console.log('PASS: report-card rendering, points, rank, dates, incomplete and parent-meeting states.')
