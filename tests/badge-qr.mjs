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
console.log('PASS: portrait CR80 front, school branding/ID/class, no school year, private operational QR, bilingual back and login-only portal QR.')
