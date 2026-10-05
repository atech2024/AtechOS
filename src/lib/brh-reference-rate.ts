const BRH_URL='https://www.brh.ht/politique-monetaire/taux-de-change/'
import {parseBrhReferenceRate} from './brh-reference-rate-parse.mjs'
export {parseBrhReferenceRate}

export async function refreshBrhReferenceRate(){
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
 const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY
 if(!supabaseUrl||!serviceRoleKey)throw new Error('brh_rate_storage_not_configured')
 const source=await fetch(BRH_URL,{cache:'no-store',signal:AbortSignal.timeout(20000),headers:{'user-agent':'AtechOS school finance rate verifier'}})
 if(!source.ok)throw new Error('brh_source_unavailable')
 const parsed=parseBrhReferenceRate(await source.text())
 // Derive the business date in Haiti without depending on the function host's UTC date.
 const haitiDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince'}).format(new Date())
 const insert=await fetch(new URL('/rest/v1/rpc/record_brh_reference_rate',supabaseUrl),{method:'POST',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/json',apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`},body:JSON.stringify({p_effective_date:parsed.effectiveDate,p_rate:parsed.rate,p_source_url:parsed.sourceUrl})})
 if(!insert.ok)throw new Error(`brh_rate_storage_failed_${insert.status}`)
 return {effective_date:parsed.effectiveDate,rate:parsed.rate,source_url:parsed.sourceUrl,stored:true,as_of_haiti_date:haitiDate}
}
