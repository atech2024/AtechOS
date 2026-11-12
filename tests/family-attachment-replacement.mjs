import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const helperSource=readFileSync('src/lib/assignment-attachments.ts','utf8')
const component=readFileSync('src/components/assignment-attachment-replacement.tsx','utf8')
const assignmentPage=readFileSync('src/app/dashboard/assignments/page.tsx','utf8')
const packageJson=JSON.parse(readFileSync('package.json','utf8'))
const compiled=ts.transpileModule(helperSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const loaded={exports:{}}
new Function('module','exports',compiled)(loaded,loaded.exports)
const {replaceAssignmentAttachment,privateAssignmentAttachmentError}=loaded.exports
assert.equal(privateAssignmentAttachmentError('NoSuchKey: Object not found'),'Assignment attachment is no longer available. Ask the teacher to upload it again.')
assert.equal(privateAssignmentAttachmentError('network timeout'),'Unable to prepare the private assignment link. Please try again or contact the school.')

const originalNow=Date.now
Date.now=()=>1792158000000
try{
 const calls=[]
 const db={
  storage:{from(bucket){calls.push(['bucket',bucket]);return{async upload(path,file,options){calls.push(['upload',path,file,options]);return{data:{path},error:null}}}}},
  async rpc(name,args){calls.push(['rpc',name,args]);return{error:null}},
 }
 const file={name:'cours scanné.pdf',size:2048,type:'application/pdf'}
 const path=await replaceAssignmentAttachment(db,'school-1','assignment-7',file)
 assert.equal(path,'school-1/assignment-7/1792158000000-cours_scann_.pdf')
 assert.deepEqual(calls.map(call=>call[0]),['bucket','upload','rpc'],'upload completes before the existing attachment pointer changes')
 assert.equal(calls[1][3].upsert,false,'replacement uses a unique object and does not overwrite existing storage data')
 assert.deepEqual(calls[2],['rpc','update_assignment_attachment',{p_assignment_id:'assignment-7',p_attachment_url:path}],'only the selected assignment is updated through the existing authorization-checked RPC')

 let rpcCalled=false
 await assert.rejects(()=>replaceAssignmentAttachment({
  storage:{from:()=>({upload:async()=>({data:null,error:new Error('storage failed')})})},
  rpc:async()=>{rpcCalled=true;return{error:null}},
 },'school-1','assignment-7',file),/storage failed/)
 assert.equal(rpcCalled,false,'a failed upload leaves the existing assignment attachment unchanged')

 let uploadCalled=false
 await assert.rejects(()=>replaceAssignmentAttachment({
  storage:{from:()=>({upload:async()=>{uploadCalled=true;return{data:{path:'ignored'},error:null}}})},
  rpc:async()=>({error:null}),
 },'school-1','assignment-7',{...file,size:50*1024*1024+1}),/50 MB or smaller/)
 assert.equal(uploadCalled,false,'oversized files are rejected before upload')
}finally{Date.now=originalNow}

assert.match(component,/replaceAssignmentAttachment\(createClient\(\),schoolId,assignmentId,file\)/,'teacher replacement uses the same school-scoped upload and authorization-checked RPC')
assert.match(component,/type="file" disabled=\{busy\}/,'replacement input is disabled while uploading')
assert.match(component,/file\.size>50\*1024\*1024/,'oversized replacement files get an actionable translated size error before upload')
assert.match(assignmentPage,/AssignmentAttachmentReplacement schoolId=\{schoolId\} assignmentId=\{r\.id\}/,'replacement is offered on the existing assignment instead of creating a duplicate')
assert.ok(packageJson.scripts.test.includes('node tests/family-attachment-replacement.mjs'),'npm test includes the attachment replacement regression')

const extraSource=readFileSync('src/lib/translations-extra.ts','utf8')
const translationSource=readFileSync('src/lib/translations.ts','utf8')
const extraCompiled=ts.transpileModule(extraSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const extraModule={exports:{}}
new Function('module','exports',extraCompiled)(extraModule,extraModule.exports)
const translationCompiled=ts.transpileModule(translationSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const translationModule={exports:{}}
new Function('module','exports','require',translationCompiled)(translationModule,translationModule.exports,name=>name==='./translations-extra'?extraModule.exports:require(name))
const {translate}=translationModule.exports
assert.equal(translate('Publish work, exams and learning documents for your assigned classes and subjects.','fr'),'Publiez des devoirs, examens et ressources pédagogiques pour les classes et matières qui vous sont attribuées.')
assert.equal(translate('PDF, Word, PowerPoint, images or text · max 50 MB','fr'),'PDF, Word, PowerPoint, images ou texte · 50 Mo maximum')
assert.equal(translate('Homework / Exam / Project','fr'),'Devoir / Examen / Projet')
assert.equal(translate('Due','fr'),'À remettre le')
assert.equal(translate('No due date','fr'),'Aucune date limite')
assert.equal(translate('Due','ht'),'Pou remèt anvan')
assert.equal(translate('Due','en'),'Due')

console.log('PASS family attachment recovery: validated upload precedes assignment update, failed/oversized uploads preserve the current attachment, and the existing assignment is reused.')
