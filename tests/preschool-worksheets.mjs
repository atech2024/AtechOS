import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const exports={}
const brand={};new Function('exports',ts.transpileModule(readFileSync('src/lib/worksheet-brand.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(brand)
new Function('exports','require',ts.transpileModule(readFileSync('src/lib/preschool-worksheets.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,()=>brand)
const {generateWorksheet,worksheetPrintHTML}=exports
const options={schoolName:'École des Étoiles & Découvertes',kind:'count',level:'PS2',theme:'animals',count:6,seed:4,letter:'A',color:true}
for(const kind of ['count','add','subtract','letters','patterns','numbers'])for(const theme of ['fruit','animals','space'])for(const count of [4,6]){
 const sheet=generateWorksheet({...options,kind,theme,count})
 assert.equal(sheet.answers.length,count)
 assert(sheet.svg.includes('data-worksheet-brand="atechos"'));assert(sheet.svg.includes('data:image/png;base64,'));assert(worksheetPrintHTML(sheet,true).includes('aria-label="Logo AtechOS"'))
 assert(sheet.svg.includes('École des Étoiles &amp; Découvertes'))
 assert(!sheet.svg.includes('undefined'))
 const html=worksheetPrintHTML(sheet,true)
 assert(html.includes('break-before:page'))
 assert.equal((html.match(/<li>/g)||[]).length,count)
 if(kind==='count'){
  const groups=sheet.svg.split(/<text x="46"[^>]*>\d+\.<\/text>/).slice(1)
  groups.forEach((row,i)=>assert.equal((row.match(/<g transform="translate/g)||[]).length-(i===count-1?1:0),Number(sheet.answers[i]),'illustrations must match count answer'))
 }
}
assert.equal(generateWorksheet(options).svg,generateWorksheet(options).svg,'same configuration must remain reproducible')
assert.notEqual(generateWorksheet(options).svg,generateWorksheet({...options,seed:5}).svg,'regeneration must change exercise content')
const unsafe=generateWorksheet({...options,schoolName:'<script>alert(1)</script> & "école"'})
assert(!worksheetPrintHTML(unsafe,true).includes('<script>'))
assert(unsafe.svg.includes('&lt;script&gt;'))
assert.equal(generateWorksheet({...options,letter:'<',count:999}).options.letter,'A')
assert.equal(generateWorksheet({...options,count:999}).answers.length,6)
for(const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')assert(!generateWorksheet({...options,kind:'letters',letter}).svg.includes('undefined'))
assert(!generateWorksheet({...options,color:false}).svg.includes('#ef775d'))
const page=readFileSync('src/app/dashboard/preschool/overview/page.tsx','utf8'),hub=readFileSync('src/components/preschool-overview.tsx','utf8')
assert(page.includes("schoolName={context.school_name||''}"),'school branding must come from existing authorized school context')
assert(hub.includes("activeView==='worksheets'?<PreschoolWorksheetGenerator schoolName={schoolName}/>")&&hub.includes("id:'worksheets'"),'generator must be embedded inside KIND')
assert(page.includes("redirect('/dashboard')"),'existing route permissions must be retained')
console.log('PASS worksheets: 36 combinations, image counting, original school branding, deterministic variants, escaped names, 26 dotted letters, monochrome mode and in-place KIND integration.')
