import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source=readFileSync('supabase/functions/student-photo-link/index.ts','utf8').replace(/^import .*\n/,'')
let handler,authorized=null,signed=[],rpcError=null
const context={Request,Response,createClient:()=>({rpc:async()=>({data:authorized,error:rpcError}),storage:{from:bucket=>({createSignedUrl:async(path,ttl)=>{signed.push({bucket,path,ttl});return {data:{signedUrl:'https://files.example.test/authorized'}}}})}}),Deno:{env:{get:()=>''},serve:fn=>handler=fn}}
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context)
const token='ab'.repeat(32)
const call=body=>handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)}))
assert.equal((await handler(new Request('https://test.invalid'))).status,405)
assert.equal((await call({})).status,401)
assert.equal((await call({token})).status,403)
authorized={student:{photo_path:null}}
assert.equal((await call({token,path:'private/other.jpg'})).status,403)
assert.equal(signed.length,0)
authorized={student:{photo_path:'school/student-photo.jpg'}}
const response=await call({token,path:'private/other.jpg'})
assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store')
assert.equal(signed[0].path,'school/student-photo.jpg');assert.equal(signed[0].ttl,60);assert.equal(signed[0].bucket,'student-photos')
rpcError={message:'unavailable'};assert.equal((await call({token})).status,403)
console.log('PASS: 6 student photo authorization checks.')
