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
const workflow=compile('src/lib/grade-workflow.ts')
const nav=compile('src/lib/navigation.ts')
assert.ok(nav.permittedNavigation(['censeur']).some(x=>x.href==='/dashboard/publication'))
assert.ok(!nav.permittedNavigation(['secretary']).some(x=>x.href==='/dashboard/publication'))
assert.ok(!nav.permittedNavigation(['teacher']).some(x=>x.href==='/dashboard/publication'))
for(const locale of ['fr','ht']){
 const {default:Component}=compile('src/components/grade-workflow.tsx',{
  '@/lib/supabase/client':{createClient:()=>{throw Error('Rendering must not mutate data')}},
  '@/lib/grade-workflow':workflow,'@/lib/translations':translations,
  '@/components/translation-provider':{T:({text})=>translations.translate(text,locale),useLocale:()=>locale},
  '@/components/grade-history':{default:()=>null},
 })
 const html=renderToStaticMarkup(React.createElement(Component,{grades:['draft','submitted','returned','reviewed','published'].map((state,i)=>({id:String(i),student:'Fixture '+i,assessment_name:'Period',score:7,max_score:10,workflow_state:state})),onChange:async()=>{}}))
 for(const [i,state] of ['draft','submitted','returned','reviewed','published'].entries()){
  const input=html.match(new RegExp('<input[^>]*aria-label="Fixture '+i+'[^>]*>'))?.[0]
  assert.ok(input)
  assert.equal(input.includes('disabled'),['submitted','reviewed','published'].includes(state))
 }
 assert.ok(!html.includes('Save, verify, then submit.'))
 assert.ok(html.includes(translations.translate('Grade submission',locale)))
}
for(const text of Object.values(workflow.gradeStates).concat(Object.values(workflow.gradeEvents)))for(const locale of ['fr','ht'])assert.notEqual(translations.translate(text,locale),text,text+' translation missing')
console.log('PASS grade UI: teacher submission locks, Censeur access, secretary/teacher publication denied, French/Creole workflow translations.')
