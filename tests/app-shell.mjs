import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const require=createRequire(import.meta.url)
function compile(path,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,URLSearchParams,require:n=>imports[n]||require(n)});return exports}
const nav=compile('src/lib/navigation.ts')
assert.ok(nav.navigation.every(item=>item.group),'Every destination must belong to a product domain group.')
for(const item of nav.navigation)assert.ok(existsSync('src/app'+item.href+'/page.tsx'),item.href+' must resolve to a real page')
const teacher=nav.permittedNavigation(['teacher']).map(x=>x.href)
assert.ok(teacher.includes('/dashboard/grades'));assert.ok(!teacher.includes('/dashboard/staff'));assert.ok(!teacher.includes('/dashboard/badges'));assert.ok(!teacher.includes('/dashboard/publication'))
const parent=nav.permittedNavigation(['parent']).map(x=>x.href)
assert.ok(parent.includes('/dashboard/parent-portal'));assert.ok(!parent.includes('/dashboard/students'));assert.ok(!parent.includes('/dashboard/grades'))
assert.ok(nav.permittedNavigation(['director']).some(x=>x.href==='/dashboard/publication'))
assert.ok(nav.permittedNavigation(['school_admin']).some(x=>x.href==='/dashboard/settings'))
assert.ok(nav.permittedNavigation(['director']).some(x=>x.href==='/dashboard/settings'))
for(const role of ['school_admin','director','secretary','accountant'])assert.ok(nav.permittedNavigation([role]).some(x=>x.href==='/dashboard/finance'),`${role} must see Finance.`)
for(const role of ['teacher','parent','surveillant','censeur','student'])assert.ok(!nav.permittedNavigation([role]).some(x=>x.href==='/dashboard/finance'),`${role} must not see Finance.`)
for(const role of ['school_admin','director','secretary','accountant','censeur'])assert.ok(nav.permittedNavigation([role]).some(x=>x.href==='/dashboard/settings'),`${role} must be able to configure their personal signature.`)
assert.ok(!nav.navigation.some(x=>x.href==='/dashboard/grading-settings'),'Grading rules belong under the settings center navigation.')
const settingsPage=readFileSync('src/app/dashboard/settings/page.tsx','utf8')
assert.ok(settingsPage.includes("['school_admin', 'director']"),'Only school admins and directors can manage grading rules.')
assert.ok(settingsPage.includes("['school_admin', 'director', 'censeur', 'secretary', 'accountant']"),'Signature profile access must include each authorized school reviewer.')
assert.ok(settingsPage.includes('href="/dashboard/grading-settings"'),'Settings center must link to the existing grading rules page.')
let academicYearContext={years:[],year:null,yearId:'',canSelect:false,setYearId:()=>{}}
const {default:AppShell}=compile('src/components/app-shell.tsx',{'next/link':{default:({children,...props})=>React.createElement('a',props,children)},'next/navigation':{usePathname:()=>'/dashboard/grades'},'@/lib/navigation':nav,'@/lib/school-date':{schoolDateTime:()=>''},'@/lib/translations':{translate:text=>text},'@/components/translation-provider':{T:({text})=>text,useLocale:()=> 'fr'},'@/components/language-selector':{default:()=>null},'@/components/academic-year-context':{useAcademicYear:()=>academicYearContext},'@/lib/supabase/client':{createClient:()=>{throw Error('render must not query')}}})
const html=renderToStaticMarkup(React.createElement(AppShell,{name:'Actual Fixture Teacher',school:'Fixture School',avatar:null,roles:['teacher'],owner:false,academicYear:'2025–2026'},'Fixture content'))
assert.ok(html.includes('Actual Fixture Teacher'));assert.ok(html.includes('Fixture School'));assert.ok(html.includes('aria-current="page"'));assert.ok(html.includes('Fixture content'));assert.ok(html.includes('Logout'));assert.ok(!html.includes('Jean Admin'));assert.ok(!html.includes('href="/dashboard/staff"'))
assert.ok(html.includes('Students &amp; families'));assert.ok(html.includes('Teaching'));assert.ok(html.includes('aria-label="Breadcrumb"'));assert.ok(html.includes('Academic year'))
console.log('PASS app shell: real page targets, teacher/parent/director menus, active route, actual identity, logout and content.')
academicYearContext={years:[{id:'year-1',name:'2025–2026',is_current:true}],year:{id:'year-1',name:'2025–2026',is_current:true},yearId:'year-1',canSelect:true,setYearId:()=>{}}
const yearHtml=renderToStaticMarkup(React.createElement(AppShell,{name:'Actual Fixture Teacher',school:'Fixture School',avatar:null,roles:['teacher'],owner:false,academicYear:'2025–2026'},'Fixture content'))
assert.ok(yearHtml.includes('aria-label="Academic year"'),'Authorized users must get the global academic-year selector.')
assert.ok(yearHtml.includes('href="/dashboard/grades?year=year-1"'),'Dashboard links must preserve the selected academic year.')
console.log('PASS global year selector appears for authorized users and navigation preserves the selected year.')
const dashboardLayout=readFileSync('src/app/dashboard/layout.tsx','utf8')
const selectorRoleList=dashboardLayout.match(/roles\.some\(role=>\[(.*?)\]\.includes\(role\)\)/)?.[1]||''
for(const role of ['school_admin','director','secretary','teacher','surveillant','censeur','parent'])assert.ok(selectorRoleList.includes(`'${role}'`),'Academic-year selection must be available to '+role)
console.log('PASS academic-year selector role coverage matches school administrators, teaching staff and parents.')

for(const role of ['censeur','director','school_admin'])assert.ok(nav.permittedNavigation([role]).some(x=>x.href==='/dashboard/approvals'))
for(const role of ['teacher','parent','secretary','student'])assert.ok(!nav.permittedNavigation([role]).some(x=>x.href==='/dashboard/approvals'))
const censeur=nav.permittedNavigation(['censeur']).map(x=>x.href)
for(const item of nav.permittedNavigation(['surveillant']))assert.ok(censeur.includes(item.href),'Censeur must inherit '+item.href)
for(const route of ['/dashboard/staff','/dashboard/progression','/dashboard/grading-settings'])assert.ok(!censeur.includes(route),'Censeur must not gain administration '+route)
console.log('PASS Censeur supervision menus without administrator access.')

const dashboard=readFileSync('src/app/dashboard/page.tsx','utf8')
assert.ok(!dashboard.includes('Your modules'),'Dashboard should not repeat the entire navigation as a link-card catalog.')
console.log('PASS dashboard avoids duplicate module catalog.')
