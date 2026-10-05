import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseBrhReferenceRate} from '../src/lib/brh-reference-rate-parse.mjs'

const html='<main><h1>Taux du Jour : 04 Octobre 2026</h1><table><tr><td>MARCHE INFORMEL</td><td>130.9000</td><td>135.6000</td></tr><tr><td>MARCHE BANCAIRE</td><td>130.3305</td><td>131.3052</td></tr><tr><td>TAUX DE REFERENCE</td><td>130.5583</td><td>-</td><td>-</td></tr></table></main>'
assert.deepEqual(parseBrhReferenceRate(html),{rate:130.5583,effectiveDate:'2026-10-04',sourceUrl:'https://www.brh.ht/taux-du-jour/'})
assert.equal(parseBrhReferenceRate('<main><h1>Taux du Jour : 7 février 2027</h1><table><tr><td>TAUX DE RÉFÉRENCE</td><td>131,25</td></tr></table></main>').effectiveDate,'2027-02-07')
assert.equal(parseBrhReferenceRate('<main><h1>Taux du Jour : 7 février 2027</h1><table><tr><td>TAUX DE RÉFÉRENCE</td><td>131,25</td></tr></table></main>').rate,131.25)
assert.throws(()=>parseBrhReferenceRate('<main><p>04 Octobre 2026</p><h1>130.5583</h1></main>'),/brh_reference_rate_not_found/)
assert.throws(()=>parseBrhReferenceRate('<main><h1>Taux du Jour</h1><table><tr><td>TAUX DE RÉFÉRENCE</td><td>130.5583</td></tr></table></main>'),/brh_reference_date_not_found/)

const route=readFileSync('src/app/api/finance/brh-rate/route.ts','utf8')
const service=readFileSync('src/lib/brh-reference-rate.ts','utf8')
const migration=readFileSync('supabase/migrations/20261005100000_finance_payment_methods_brh_rates.sql','utf8')
const cron=JSON.parse(readFileSync('vercel.json','utf8')).crons
assert.match(service,/https:\/\/www\.brh\.ht\/taux-du-jour\//)
assert.match(route,/timingSafeEqual/)
assert.match(route,/!origin\|\|origin!==new URL\(request\.url\)\.origin/)
assert.match(route,/setup\?\.can_manage/)
assert.match(migration,/finance_payment_fx_snapshot_immutable/)
assert.match(migration,/grant execute on function public\.record_brh_reference_rate\(date,numeric,text\) to service_role/)
const sourceUrl='https://www.brh.ht/taux-du-jour/'
const sourceMigration=readFileSync('supabase/migrations/20261005121811_update_brh_rate_source_url.sql','utf8')
assert.ok(sourceMigration.includes(sourceUrl))
assert.match(sourceMigration,/https:\/\/www\.brh\.ht\/politique-monetaire\/taux-de-change\//)
assert.match(migration,/brh_rate_unavailable/)
assert.ok(cron.some(item=>item.path==='/api/finance/brh-rate'&&item.schedule==='5 17 * * 1-5'))
console.log('PASS official BRH daily-page reference-rate parsing, Haiti date handling, server-only storage, role check and cron contract.')
