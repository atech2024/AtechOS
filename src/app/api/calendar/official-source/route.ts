import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'

export const dynamic='force-dynamic'
const MENFP='https://www.menfp.gouv.ht/'
const FALLBACK='https://menfp.gouv.ht/assets/CALENDRIER_SCOLAIRE_2025_2026.pdf'

export async function GET(){
 const db=await createClient(),{data:{user}}=await db.auth.getUser()
 if(!user)return NextResponse.json({error:'authentication_required'},{status:401})
 const {data:context,error}=await db.rpc('school_context')
 if(error)return NextResponse.json({error:'school_access_unavailable'},{status:503})
 const roles:string[]=context?.roles||[]
 if(!roles.some(role=>['school_admin','director','secretary','surveillant','censeur'].includes(role)))return NextResponse.json({error:'not_authorized'},{status:403})
 try{
  const response=await fetch(MENFP,{cache:'no-store',signal:AbortSignal.timeout(8000)})
  if(!response.ok)throw new Error('MENFP source unavailable')
  const html=await response.text()
  const hrefs=[...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(match=>match[1].replaceAll('&amp;','&'))
  const candidates=hrefs.flatMap(href=>{
   try{const url=new URL(href,MENFP);if(!['menfp.gouv.ht','www.menfp.gouv.ht'].includes(url.hostname)||!/calendrier[^/?#]*\.pdf(?:$|[?#])/i.test(url.pathname+url.search))return[];const match=(url.pathname+url.search).match(/(20\d{2})[_-](20\d{2})/);return[{url:url.toString(),label:match?`MENFP school calendar ${match[1]}–${match[2]}`:'MENFP school calendar',year:match?`${match[1]}/${match[2]}`:null}]}catch{return[]}
  })
  const unique=[...new Map(candidates.map(item=>[item.url,item])).values()].sort((a,b)=>(b.year||'').localeCompare(a.year||''))
  return NextResponse.json({checked_at:new Date().toISOString(),source:'MENFP',latest_calendar:unique[0]||null,fallback_url:FALLBACK,source_url:MENFP})
 }catch{
  return NextResponse.json({checked_at:new Date().toISOString(),source:'MENFP',latest_calendar:null,fallback_url:FALLBACK,source_url:MENFP,warning:'The live MENFP page could not be checked; use the official source links to verify dates.'})
 }
}
