import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source=readFileSync('supabase/functions/student-assignment-link/index.ts','utf8').replace(/^import .*\n/,'')
let handler,authorized=null,signed=[],rpcError=null
const context={Request,Response,createClient:()=>({rpc:async()=>({data:authorized,error:rpcError}),storage:{from:bucket=>({createSignedUrl:async(path,ttl)=>{signed.push({bucket,path,ttl});return {data:{signedUrl:'https://files.example.test/authorized'}}}})}}),Deno:{env:{get:()=>''},serve:fn=>handler=fn}}
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context)
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',token='ab'.repeat(32)
const call=body=>handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)}))
assert.equal((await handler(new Request('https://test.invalid'))).status,405)
assert.equal((await call({assignment_id:id})).status,401)
assert.equal((await call({token,assignment_id:id})).status,403)
authorized={student:{id:'student'},assignments:[{id,attachment_url:'school/assignment/file.pdf'}]}
assert.equal((await call({token,assignment_id:other,path:'private/other.pdf'})).status,403)
assert.equal(signed.length,0)
const response=await call({token,assignment_id:id,path:'private/other.pdf'})
assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store')
assert.equal(signed[0].path,'school/assignment/file.pdf');assert.equal(signed[0].ttl,60)
rpcError={message:'unavailable'};assert.equal((await call({token,assignment_id:id})).status,403)
console.log('PASS: 6 student attachment authorization checks.')
