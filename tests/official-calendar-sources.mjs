import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const source=readFileSync('src/lib/official-calendar-sources.ts','utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const parser=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const archive=`
 <a href="/article-48357-haiti-flash-calendrier-scolaire-2026-2027-officiel.html">Lire la suite...</a>
 <a href="/article-48085-haiti-flash-calendrier-electoral-2026-2027-derniere-version-officielle.html">Calendrier électoral</a>
 <a href="https://evil.example/article-5-calendrier-scolaire-2028-2029.html">Fake school calendar</a>`
const articles=parser.discoverHaitiLibreCalendarArticles(archive)
assert.equal(articles.length,1,'accept only Haitian school-calendar articles on HaitiLibre hosts')
assert.equal(articles[0].school_year,'2026/2027')
assert.match(articles[0].label,/copie publiée par HaitiLibre/)

const article=`
 <a href="/docs/Calendrier-scolaire-2026-2027.pdf">Calendrier scolaire officiel</a>
 <a href="/docs/Calendrier-scolaire-2025-2026.pdf">Old calendar</a>
 <a href="https://evil.example/docs/Calendrier-scolaire-2026-2027.pdf">Fake copy</a>
 <a href="http://haitilibre.com/docs/Calendrier-scolaire-2026-2027.pdf">Insecure copy</a>`
const pdf=parser.discoverHaitiLibreCalendarPdf(article,articles[0].url,articles[0].school_year)
assert.equal(pdf?.url,'https://www.haitilibre.com/docs/Calendrier-scolaire-2026-2027.pdf')
assert.equal(pdf?.source,'HaitiLibre')
assert.equal(parser.discoverHaitiLibreCalendarPdf('<a href="/docs/Calendrier-scolaire-2026-2027.pdf">Calendar</a>',articles[0].url,'2025/2026'),null,'PDF must match the year of its source article')

const official=parser.discoverOfficialCalendarLinks('<a href="https://communication.gouv.ht/docs/calendrier-scolaire-2026-2027.pdf">MENFP calendar</a><a href="https://evil.example/calendrier-2026-2027.pdf">Not official</a>','https://communication.gouv.ht/ds/circulaire/','Haitian Government')
assert.equal(official.length,1,'official-site parser keeps its exact government host allowlist')
assert.equal(official[0].source,'Haitian Government')
console.log('Official and secondary calendar source parsing checks passed.')
