import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const require=createRequire(import.meta.url)
function compile(path,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>imports[n]||require(n)});return exports}
const nav=compile('src/lib/navigation.ts')
for(const item of nav.navigation)assert.ok(existsSync('src/app'+item.href+'/page.tsx'),item.href+' must resolve to a real page')
const teacher=nav.permittedNavigation(['teacher']).map(x=>x.href)
assert.ok(teacher.includes('/dashboard/grades'));assert.ok(!teacher.includes('/dashboard/staff'));assert.ok(!teacher.includes('/dashboard/badges'));assert.ok(!teacher.includes('/dashboard/publication'))
const parent=nav.permittedNavigation(['parent']).map(x=>x.href)
assert.ok(parent.includes('/dashboard/parent-portal'));assert.ok(!parent.includes('/dashboard/students'));assert.ok(!parent.includes('/dashboard/grades'))
assert.ok(nav.permittedNavigation(['director']).some(x=>x.href==='/dashboard/publication'))
const {default:AppShell}=compile('src/components/app-shell.tsx',{'next/link':{default:({children,...props})=>React.createElement('a',props,children)},'next/navigation':{usePathname:()=>'/dashboard/grades'},'@/lib/navigation':nav,'@/lib/school-date':{schoolDateTime:()=>''},'@/components/translation-provider':{T:({text})=>text,useLocale:()=> 'fr'},'@/components/language-selector':{default:()=>null},'@/lib/supabase/client':{createClient:()=>{throw Error('render must not query')}}})
const html=renderToStaticMarkup(React.createElement(AppShell,{name:'Actual Fixture Teacher',school:'Fixture School',avatar:null,roles:['teacher'],owner:false},'Fixture content'))
assert.ok(html.includes('Actual Fixture Teacher'));assert.ok(html.includes('Fixture School'));assert.ok(html.includes('aria-current="page"'));assert.ok(html.includes('Fixture content'));assert.ok(html.includes('Logout'));assert.ok(!html.includes('Jean Admin'));assert.ok(!html.includes('href="/dashboard/staff"'))
console.log('PASS app shell: real page targets, teacher/parent/director menus, active route, actual identity, logout and content.')

for(const role of ['censeur','director','school_admin'])assert.ok(nav.permittedNavigation([role]).some(x=>x.href==='/dashboard/approvals'))
for(const role of ['teacher','parent','secretary','student'])assert.ok(!nav.permittedNavigation([role]).some(x=>x.href==='/dashboard/approvals'))
