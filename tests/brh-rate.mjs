import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseBrhReferenceRate} from '../src/lib/brh-reference-rate-parse.mjs'

const html='<main><p>04 Octobre 2026</p><h1># 130.5583</h1><h6>Taux de Référence</h6><p>Gourdes pour 1 dollar EU</p></main>'
assert.deepEqual(parseBrhReferenceRate(html),{rate:130.5583,effectiveDate:'2026-10-04',sourceUrl:'https://www.brh.ht/politique-monetaire/taux-de-change/'})
assert.equal(parseBrhReferenceRate('<main><p>7 février 2027</p><h1>131,25</h1><h6>Taux de Référence</h6></main>').effectiveDate,'2027-02-07')
assert.throws(()=>parseBrhReferenceRate('<main><p>04 Octobre 2026</p><h1>130.5583</h1></main>'),/brh_reference_rate_not_found/)
assert.throws(()=>parseBrhReferenceRate('<main><h1>130.5583</h1><h6>Taux de Référence</h6></main>'),/brh_reference_date_not_found/)

const route=readFileSync('src/app/api/finance/brh-rate/route.ts','utf8')
const migration=readFileSync('supabase/migrations/20261005100000_finance_payment_methods_brh_rates.sql','utf8')
const cron=JSON.parse(readFileSync('vercel.json','utf8')).crons
assert.match(route,/timingSafeEqual/)
assert.match(route,/!origin\|\|origin!==new URL\(request\.url\)\.origin/)
assert.match(route,/setup\?\.can_manage/)
assert.match(migration,/finance_payment_fx_snapshot_immutable/)
assert.match(migration,/grant execute on function public\.record_brh_reference_rate\(date,numeric,text\) to service_role/)
assert.match(migration,/brh_rate_unavailable/)
assert.ok(cron.some(item=>item.path==='/api/finance/brh-rate'&&item.schedule==='5 17 * * 1-5'))
console.log('PASS BRH reference-rate parsing, Haiti date handling, server-only storage, role check and cron contract.')
