import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {discoverOfficialCalendarLinks,OFFICIAL_CALENDAR_PAGES} from '@/lib/official-calendar-sources'

export const dynamic='force-dynamic'
const FALLBACK='https://menfp.gouv.ht/assets/CALENDRIER_SCOLAIRE_2025_2026.pdf'

export async function GET(){
 const db=await createClient(),{data:{user}}=await db.auth.getUser()
 if(!user)return NextResponse.json({error:'authentication_required'},{status:401})
 const {data:context,error}=await db.rpc('school_context')
 if(error)return NextResponse.json({error:'school_access_unavailable'},{status:503})
 const roles:string[]=context?.roles||[]
 if(!roles.some(role=>['school_admin','director','secretary','surveillant','censeur'].includes(role)))return NextResponse.json({error:'not_authorized'},{status:403})
 try{
  const results=await Promise.all(OFFICIAL_CALENDAR_PAGES.map(async source=>{
   try{
    const response=await fetch(source.url,{cache:'no-store',signal:AbortSignal.timeout(8000),headers:{'user-agent':'AtechOS official school-calendar checker'}})
    if(!response.ok)throw new Error(`Official source returned ${response.status}`)
    return {links:discoverOfficialCalendarLinks(await response.text(),source.url,source.source),reachable:true}
   }catch(error){
    console.warn(`Official calendar page unavailable: ${source.url}`,error instanceof Error?error.message:'unknown error')
    return {links:[],reachable:false}
   }
  }))
  const reachable=results.filter(result=>result.reachable).length
  if(!reachable)throw new Error('No official calendar pages could be reached')
  const candidates=[...new Map(results.flatMap(result=>result.links).map(item=>[item.url,{url:item.url,label:item.label,year:item.school_year,source:item.source}])).values()]
  const unique=[...new Map(candidates.map(item=>[item.url,item])).values()].sort((a,b)=>(b.year||'').localeCompare(a.year||''))
  return NextResponse.json({checked_at:new Date().toISOString(),sources_checked:OFFICIAL_CALENDAR_PAGES.length,sources_reachable:reachable,source:unique[0]?.source||'MENFP',latest_calendar:unique[0]||null,fallback_url:FALLBACK,source_url:OFFICIAL_CALENDAR_PAGES[0].url})
 }catch{
  return NextResponse.json({checked_at:new Date().toISOString(),source:'MENFP',latest_calendar:null,fallback_url:FALLBACK,source_url:OFFICIAL_CALENDAR_PAGES[0].url,warning:'The official MENFP page could not be checked right now. The current statutory suggestions remain available for staff review.'})
 }
}
