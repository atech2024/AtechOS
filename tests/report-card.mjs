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
const translations={}
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/translations-extra.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:translations})
let localeIndex=0
const source=readFileSync('src/components/report-card.tsx','utf8')
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>n==='@/components/translation-provider'?{T:({text})=>translations.extraTranslations?.[text]?.[localeIndex]||text}:n==='@/components/attendance-history'?{default:()=>null}:n==='@/lib/school-date'?dateExports:n==='@/lib/supabase/client'?{createClient:()=>{throw Error('render must not call database')}}:require(n)})
const card={class_id:'c',class_name:'NS1',year:'2026 / 2027',period_id:'p',period:'Premier contrôle',subjects:[{id:'s',name:'Mathématiques',ready:true,note:8,earned:240,possible:300,assessments:[{assessment:'Contrôle 1',score:240,max_score:300,weight:100}]}],complete:true,average:8,earned:240,possible:300,position:1,class_size:20,rank_ready:true,status:'passed',exam_start:'2026-10-01',exam_end:'2026-10-05'}
const report={passing_average:6,student:{first_name:'Test',last_name:'Élève',atechos_id:'AOS-TEST'},school:{name:'École test'}}
const render=c=>renderToStaticMarkup(React.createElement(exports.ReportCard,{report,card:c}))
let html=render(card);assert.ok(html.includes('Note / 10'));assert.ok(html.includes('Moyenne générale'));assert.ok(html.includes('240.00 / 300.00'));assert.ok(html.includes('1 Oktòb 2026'));assert.ok(html.includes('1 / 20'));assert.ok(html.includes('Admis'))
html=render({...card,complete:false,average:null,earned:null,possible:null,position:null,rank_ready:false,status:'incomplete'});assert.ok(html.includes('Incomplet'));assert.ok(html.includes('En attente'));assert.ok(!html.includes('1 / 20'))
html=render({...card,status:'parent_meeting',average:3});assert.ok(html.includes('rencontre avec les parents'));assert.ok(html.includes('Aucune exclusion automatique'))
console.log('PASS: report-card rendering, points, rank, dates, incomplete and parent-meeting states.')
const doc={id:'version-fixture',version:1,published_at:'2026-09-28T14:00:00Z',publisher:'Actual Director',publisher_role:'director',approved_by:null,approver:null,approved_at:null,reason:'Initial publication'}
html=render({...card,document:doc,identity:{first_name:'Frozen',last_name:'Identity',atechos_id:'AOS-FROZEN'},school_identity:{name:'Frozen School'},passing_average:7})
assert.ok(html.includes('Frozen Identity'));assert.ok(html.includes('Frozen School'));assert.ok(!html.includes('Test Élève'));assert.ok(html.includes('Version officielle 1'));assert.ok(html.includes('Actual Director'));assert.ok(html.includes('aucune signature du Censeur'));assert.ok(!html.includes('Approbation du Censeur :'));assert.ok(html.includes('7/10'))
html=render({...card,document:{...doc,version:2,approved_by:'reviewer',approver:'Actual Censeur',approved_at:'2026-09-28T15:00:00Z'}})
assert.ok(html.includes('Approbation du Censeur : Actual Censeur'));assert.ok(html.includes('Version officielle 2'));assert.ok(!html.includes('aucune signature du Censeur'))
console.log('PASS immutable document identity, school, threshold, version, publisher and actual-only Censeur approval.')
localeIndex=1
html=render({...card,document:doc});assert.ok(html.includes('Vèsyon ofisyèl'));assert.ok(html.includes('Pibliye pa'));assert.ok(html.includes('pa gen siyati Sansè'))
console.log('PASS Haitian Creole document metadata.')
