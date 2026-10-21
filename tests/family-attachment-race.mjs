import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

// Execute the actual component handlers with deferred storage responses.
const source=readFileSync('src/app/dashboard/parent-portal/page.tsx','utf8')
const helperSource=readFileSync('src/lib/assignment-attachments.ts','utf8')
const helperCode=ts.transpileModule(helperSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const helperModule={exports:{}}
new Function('module','exports',helperCode)(helperModule,helperModule.exports)
const {privateAssignmentAttachmentError}=helperModule.exports
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const handlers=[]
function visit(node){
 if(ts.isFunctionDeclaration(node)&&['openAttachment','selectChild'].includes(node.name?.text)) handlers.push(node.getText(ast))
 ts.forEachChild(node,visit)
}
visit(ast)
const code=ts.transpileModule(handlers.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor
async function harness(){
 const state={link:null,loading:'',error:'',child:'first'}
 const requests=[]
 const tracker={current:0}
 const createClient=()=>({storage:{from:bucket=>({createSignedUrl:(path,expires)=>{
  assert.equal(bucket,'assignment-files')
  assert.equal(expires,60)
  return new Promise((resolve,reject)=>requests.push({path,resolve,reject}))
 }})}})
 const api=await new AsyncFunction('createClient','attachmentRequest','setAttachmentLink','setAttachmentLoadingId','setError','setChildId','privateAssignmentAttachmentError',`${code}\nreturn {openAttachment,selectChild};`)(
  createClient,tracker,value=>{state.link=value},value=>{state.loading=value},value=>{state.error=value},value=>{state.child=value},privateAssignmentAttachmentError)
 return {...api,state,requests}
}

// A slow first response must not replace a newer successful attachment.
{
 const h=await harness(),first=h.openAttachment('a','a.pdf'),second=h.openAttachment('b','b.pdf')
 h.requests[1].resolve({data:{signedUrl:'signed-b'},error:null});await second
 h.requests[0].resolve({data:{signedUrl:'signed-a'},error:null});await first
 assert.deepEqual(h.state.link,{assignmentId:'b',url:'signed-b'})
}
// A stale rejection must not clear the newer request's loading state or show an error.
{
 const h=await harness(),first=h.openAttachment('a','a.pdf'),second=h.openAttachment('b','b.pdf')
 h.requests[0].reject(new Error('old failure'));await first
 assert.equal(h.state.loading,'b');assert.equal(h.state.error,'')
 h.requests[1].resolve({data:{signedUrl:'signed-b'},error:null});await second
 assert.equal(h.state.loading,'')
}
// Switching children invalidates successful and failed in-flight responses.
for(const outcome of ['success','error','rejection']){
 const h=await harness(),pending=h.openAttachment('a','a.pdf')
 h.selectChild('second')
 if(outcome==='rejection')h.requests[0].reject(new Error('old failure'))
 else h.requests[0].resolve(outcome==='success'?{data:{signedUrl:'signed-a'},error:null}:{data:null,error:{message:'denied'}})
 await pending
 assert.deepEqual(h.state,{link:null,loading:'',error:'',child:'second'})
}
// The latest request still reports failures and can recover on retry.
{
 const h=await harness(),failed=h.openAttachment('a','a.pdf')
 h.requests[0].resolve({data:null,error:{message:'denied'}});await failed
 assert.equal(h.state.error,'Unable to prepare the private assignment link. Please try again or contact the school.')
 const retry=h.openAttachment('a','a.pdf')
 h.requests[1].resolve({data:{signedUrl:'signed-retry'},error:null});await retry
 assert.equal(h.state.error,'');assert.equal(h.state.link.url,'signed-retry')
}
console.log('PASS family attachment races: latest request wins, child switch invalidates old responses, failures recover.')
