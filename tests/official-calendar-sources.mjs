import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source=readFileSync('src/lib/official-calendar-sources.ts','utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const parser=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const proposalSource=readFileSync('supabase/functions/official-calendar-sources/exam-date-proposals.ts','utf8')
const proposalCompiled=ts.transpileModule(proposalSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const proposals=await import(`data:text/javascript;base64,${Buffer.from(proposalCompiled).toString('base64')}`)

const archive=`
 <a href="/article-48357-haiti-flash-calendrier-scolaire-2026-2027-officiel.html">Lire la suite...</a>
 <a href="/article-48085-haiti-flash-calendrier-electoral-2026-2027-derniere-version-officielle.html">Calendrier électoral</a>
 <a href="https://evil.example/article-5-calendrier-scolaire-2028-2029.html">Fake school calendar</a>`
const articles=parser.discoverHaitiLibreCalendarArticles(archive)
assert.equal(articles.length,1,'accept only Haitian school-calendar articles on HaitiLibre hosts')
assert.equal(articles[0].school_year,'2026/2027')
assert.match(articles[0].label,/copie publiée par HaitiLibre/)
const examArticles=parser.discoverHaitiLibreCalendarArticles('<a href="/article-50000-calendrier-examens-2026-2027.html">Périodes d\'examens officiels</a>')
assert.equal(examArticles[0]?.kind,'exam_calendar','official exam schedule references are categorized separately')
assert.match(examArticles[0]?.label||'',/Examens et périodes/)
const examNotice=parser.discoverHaitiLibreCalendarArticles('<a href="/article-47860-haiti-education-examens-officiels-2026.html">Examens officiels 2026</a>')
assert.equal(examNotice[0]?.school_year,null,'do not guess the academic year from a single exam year')
assert.equal(examNotice[0]?.kind,'exam_calendar')
const recentFirst=parser.discoverHaitiLibreCalendarArticles('<a href="/article-48357-calendrier-scolaire-2026-2027.html">Calendrier scolaire</a><a href="/article-50000-examens-officiels-2027.html">Examens officiels</a>')
assert.equal(recentFirst[0]?.url.endsWith('article-50000-examens-officiels-2027.html'),true,'new exam notices are not hidden behind school-year PDFs')

const article=`
 <a href="/docs/Calendrier-scolaire-2026-2027.pdf">Calendrier scolaire officiel</a>
 <a href="/docs/Calendrier-scolaire-2025-2026.pdf">Old calendar</a>
 <a href="https://evil.example/docs/Calendrier-scolaire-2026-2027.pdf">Fake copy</a>
 <a href="http://haitilibre.com/docs/Calendrier-scolaire-2026-2027.pdf">Insecure copy</a>`
const pdf=parser.discoverHaitiLibreCalendarPdf(article,articles[0].url,articles[0].school_year)
assert.equal(pdf?.url,'https://www.haitilibre.com/docs/Calendrier-scolaire-2026-2027.pdf')
assert.equal(pdf?.source,'HaitiLibre')
assert.equal(pdf?.kind,'school_calendar')
assert.equal(parser.discoverHaitiLibreCalendarPdf('<a href="/docs/Calendrier-scolaire-2026-2027.pdf">Calendar</a>',articles[0].url,'2025/2026'),null,'PDF must match the year of its source article')

const official=parser.discoverOfficialCalendarLinks('<a href="https://communication.gouv.ht/docs/calendrier-scolaire-2026-2027.pdf">MENFP calendar</a><a href="https://evil.example/calendrier-2026-2027.pdf">Not official</a>','https://communication.gouv.ht/ds/circulaire/','Haitian Government')
assert.equal(official.length,1,'official-site parser keeps its exact government host allowlist')
assert.equal(official[0].source,'Haitian Government')
const extracted=proposals.extractExamDateProposals('<p>Les examens officiels se dérouleront du 31 mai au 1er juillet. Les contrôles auront lieu du 9 au 13 novembre 2026.</p>','2026/2027')
assert.equal(extracted.length,2,'extract both official exam and school control date ranges from article text')
assert.equal(extracted[0].category,'official_exam')
assert.equal(extracted[0].start_date,'2027-05-31','map May to the second year in a known academic year')
assert.equal(extracted[0].end_date,'2027-07-01','map cross-month range with the academic year')
assert.equal(extracted[0].status,'needs_review','all scraped exam dates remain unapproved proposals')
assert.equal(extracted[1].category,'exam_period')
assert.equal(extracted[1].start_date,'2026-11-09','map autumn exam dates to the first school-year year')
const sameMonth=proposals.extractExamDateProposals('<p>Contrôle en mathématiques du 9 au 13 novembre.</p>','2026/2027')
assert.equal(sameMonth[0]?.start_date,'2026-11-09','extract ranges with a shared month')
assert.equal(sameMonth[0]?.end_date,'2026-11-13')
const uncertainYear=proposals.extractExamDateProposals('<p>Examens du 9 au 13 novembre.</p>',null)
assert.equal(uncertainYear[0]?.start_date,null,'leave concrete dates unresolved when a source has no academic year')
const officialSchedule=proposals.extractExamDateProposals('<p>EXAMENS OFFICIELS : 14 au 17 juin 2027 : 9e AF.</p><p>28 juin au 1er juillet 2027 : NS4 et Bac permanent.</p>','2026/2027')
assert.equal(officialSchedule.length,2,'capture official exam ranges where the first date has no repeated month')
assert.equal(officialSchedule[0].category,'official_exam')
assert.equal(officialSchedule[0].start_date,'2027-06-14')
assert.equal(officialSchedule[0].end_date,'2027-06-17')
assert.equal(officialSchedule[1].start_date,'2027-06-28')
assert.equal(officialSchedule[1].end_date,'2027-07-01')

const edgeSource=readFileSync('supabase/functions/official-calendar-sources/index.ts','utf8')
const edgeCompiled=ts.transpileModule(edgeSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const articleUrl='https://www.haitilibre.com/article-50000-calendrier-examens-2026-2027.html'
const pdfUrl='https://www.haitilibre.com/docs/Calendrier-examens-2026-2027.pdf'
const archiveHtml=`<a href="${articleUrl}">Calendrier examens 2026-2027</a>`
const articleHtml='<p>Les examens officiels auront lieu du 9 au 13 novembre.</p><a href="/docs/Calendrier-examens-2026-2027.pdf">Calendrier examens PDF</a>'

async function discoverWithPdf(pdfResult){
 let handler
 const fetch=async url=>{
  if(url===pdfUrl){
   if(pdfResult==='unavailable')throw new Error('PDF unavailable')
   if(pdfResult==='http-error')return new Response('missing',{status:404})
   if(pdfResult==='wrong-type')return new Response('<html>not a PDF</html>',{headers:{'content-type':'text/html'}})
   return new Response(pdfResult==='valid'?'%PDF-1.7 fixture':'not a PDF document',{headers:{'content-type':'application/pdf'}})
  }
  if(url===articleUrl)return new Response(articleHtml)
  if(url==='https://www.haitilibre.com/cat-5-education-1.html')return new Response(archiveHtml)
  return new Response('')
 }
 vm.runInNewContext(edgeCompiled,{
  exports:{},require:id=>id==='https://esm.sh/@supabase/supabase-js@2'?{createClient:()=>{throw new Error('Unexpected persistence')}}:id==='./exam-date-proposals.ts'?proposals:null,
  Deno:{env:{get:key=>key==='SUPABASE_SERVICE_ROLE_KEY'?'fixture-secret':null},serve:callback=>{handler=callback}},
  fetch,URL,AbortSignal,Uint8Array,Response,console:{warn:()=>{},error:()=>{}},
 })
 const response=await handler(new Request('https://example.invalid/functions/v1/official-calendar-sources',{method:'POST',headers:{authorization:'Bearer fixture-secret'},body:JSON.stringify({persist:false})}))
 assert.equal(response.status,200)
 return response.json()
}

for(const pdfResult of ['http-error','wrong-type','bad-signature','unavailable','valid']){
 const discovered=await discoverWithPdf(pdfResult)
 const article=discovered.candidates.find(item=>item.url===articleUrl)
 assert.equal(article?.source,'HaitiLibre',`keep source attribution when the linked PDF is ${pdfResult}`)
 assert.equal(article?.kind,'exam_calendar')
 assert.equal(article?.suggested_dates?.length,1,`keep article exam proposals when the linked PDF is ${pdfResult}`)
 assert.equal(article.suggested_dates[0].start_date,'2026-11-09')
 assert.equal(article.suggested_dates[0].status,'needs_review')
 assert.equal(discovered.candidates.some(item=>item.url===pdfUrl),pdfResult==='valid',`only include a verified PDF when it is ${pdfResult}`)
}
console.log('Official and secondary calendar source parsing checks passed.')
