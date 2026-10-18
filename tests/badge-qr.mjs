import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const require=createRequire(import.meta.url),exports={}
const source=readFileSync('src/components/badge-card.tsx','utf8')
const mockedRequire=n=>n==='@/lib/supabase/client'?{createClient:()=>{throw Error('render must not access database')}}:n==='@/components/translation-provider'?{T:({text})=>text}:n==='qrcode.react'?{QRCodeSVG:({value})=>React.createElement('span',{'data-qr':value})}:n==='next/link'?{default:({children,...props})=>React.createElement('a',props,children)}:require(n)
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:mockedRequire})
const identity={name:'Fixture Student',code:'AOS-PUBLIC',className:'Petite Section',photo:'',school:'Fixture school',logo:null}
const props={identity,qr:'AOSQ1.'+'a'.repeat(64)}
const html=renderToStaticMarkup(React.createElement(exports.BadgeFront,props))
assert.ok(html.includes('data-qr="'+props.qr+'"'))
assert.ok(!html.includes('data-qr="AOS-PUBLIC"'))
assert.ok(html.includes('AOS-PUBLIC'));assert.ok(html.includes('Petite Section'))
assert.ok(!html.includes('Année'));assert.ok(!html.includes('2026'));assert.ok(html.includes('h-[85.6mm]'));assert.ok(html.includes('w-[53.98mm]'))
assert.ok(!renderToStaticMarkup(React.createElement(exports.BadgeFront,{...props,qr:''})).includes('data-qr'))
const back=renderToStaticMarkup(React.createElement(exports.BadgeBack,{origin:'https://school.example'}))
assert.ok(back.includes('https://school.example/student/login'));assert.ok(back.includes('https://school.example/login'));assert.ok(!back.includes('AOSQ1.'));assert.ok(!back.includes('token='))
assert.ok(back.includes('Ne le prêtez pas'));assert.ok(back.includes('Pa prete li'))

const dateExports={}
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/school-date.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:dateExports,Intl,Date})
const studentExports={}
const studentMock=n=>n==='@/lib/school-date'?dateExports:n==='@/components/translation-provider'?{T:({text})=>text}:n==='qrcode.react'?{QRCodeSVG:({value})=>React.createElement('span',{'data-qr':value})}:require(n)
vm.runInNewContext(ts.transpileModule(readFileSync('src/components/student-identity-card.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:studentExports,require:studentMock})
const studentHtml=renderToStaticMarkup(React.createElement(studentExports.default,{student:{first_name:'Fixture',last_name:'Student',atechos_id:'AOS-123',class_name:'PS1',academic_year:'2026–2027',photo_available:true},qr:props.qr,attendance:{check_in_at:'2026-10-02T12:45:00.000Z',check_out_at:'2026-10-02T20:15:00.000Z'}}))
for(const value of ['Fixture Student','PS1','2026–2027','AOS-123','08:45 AM','04:15 PM','/student/photo'])assert.ok(studentHtml.includes(value),`student identity panel must show ${value}`)
assert.ok(studentHtml.includes('data-qr="'+props.qr+'"'),'student portal must present the active operational badge QR')
const studentPageSource=readFileSync('src/app/student/page.tsx','utf8'),studentDashboardSource=readFileSync('src/app/student/student-dashboard.tsx','utf8')
assert.ok(studentPageSource.includes('<StudentDashboard')&&studentPageSource.includes('qr={data.badge_qr}'),'portal workspace must pass the server-returned badge QR into the student dashboard')
assert.ok(studentDashboardSource.includes('<StudentOverview qr={qr}'),'student dashboard must preserve the server-returned badge QR in the student overview')
assert.ok(readFileSync('src/app/student/overview.tsx','utf8').includes('<StudentIdentityCard qr={qr}'),'student overview must render the badge QR in the identity panel')
assert.ok(readFileSync('supabase/migrations/20260928004221_badge_lifecycle_history.sql','utf8').includes("b.active and b.state=''active''"),'student portal QR must only be returned for an active, non-revoked badge')
console.log('PASS: portrait CR80 front, school branding/ID/class, no school year, private operational QR, bilingual back and login-only portal QR; student portal identity, class, year, daily Haiti-time attendance and private badge QR.')
