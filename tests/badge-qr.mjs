import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const require=createRequire(import.meta.url),exports={}
const source=readFileSync('src/app/dashboard/badges/page.tsx','utf8').replace('function BadgeCard(','export function BadgeCard(')
const mockedRequire=n=>n==='@/lib/supabase/client'?{createClient:()=>{throw Error('render must not access database')}}:n==='@/components/translation-provider'?{T:({text})=>text}:n==='qrcode.react'?{QRCodeSVG:({value})=>React.createElement('span',{'data-qr':value})}:n==='next/link'?{default:({children,...props})=>React.createElement('a',props,children)}:require(n)
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:mockedRequire})
const student={id:'fixture',first_name:'Fixture',last_name:'Student',atechos_id:'AOS-PUBLIC',active:true}
const props={student,school:{name:'Fixture school'},badge:null,enrollment:{class_name:'Petite Section',academic_year_name:'2026 / 2027'},photoSrc:'',qr:'AOSQ1.'+'a'.repeat(64)}
const html=renderToStaticMarkup(React.createElement(exports.BadgeCard,props))
assert.ok(html.includes('data-qr="'+props.qr+'"'))
assert.ok(!html.includes('data-qr="AOS-PUBLIC"'))
assert.ok(html.includes('AOS-PUBLIC'))
assert.ok(html.includes('Petite Section'))
assert.ok(html.includes('2026 / 2027'))
assert.ok(!renderToStaticMarkup(React.createElement(exports.BadgeCard,{...props,qr:''})).includes('data-qr'))
console.log('PASS: badge uses the private QR token, keeps printed ID/class/year, and omits unissued QR.')
