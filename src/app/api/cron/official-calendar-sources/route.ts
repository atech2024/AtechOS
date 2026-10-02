import {NextResponse} from 'next/server'
import {createClient as createSupabaseClient} from '@supabase/supabase-js'
import {timingSafeEqual} from 'node:crypto'
import {discoverOfficialCalendarLinks,OFFICIAL_CALENDAR_PAGES} from '@/lib/official-calendar-sources'

export const dynamic='force-dynamic'
export const maxDuration=25

function authorized(request:Request){
 const secret=process.env.CRON_SECRET||''
 const supplied=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
 const expected=Buffer.from(secret),provided=Buffer.from(supplied)
 if(expected.length<32||provided.length!==expected.length)return false
 return timingSafeEqual(expected,provided)
}

export async function GET(request:Request){
 if(!authorized(request))return NextResponse.json({error:'not_authorized'},{status:401})
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY
 if(!supabaseUrl||!serviceKey)return NextResponse.json({error:'calendar_sync_not_configured'},{status:503})
 try{
  const pages=await Promise.all(OFFICIAL_CALENDAR_PAGES.map(async source=>{
   try{
    const response=await fetch(source.url,{cache:'no-store',signal:AbortSignal.timeout(9000),headers:{'user-agent':'AtechOS official school-calendar checker'}})
    if(!response.ok)throw new Error(`Official source returned ${response.status}`)
    return {links:discoverOfficialCalendarLinks(await response.text(),source.url,source.source),reachable:true}
   }catch(error){
    console.warn(`Official calendar page unavailable: ${source.url}`,error instanceof Error?error.message:'unknown error')
    return {links:[],reachable:false}
   }
  }))
  const reachable=pages.filter(page=>page.reachable).length
  if(!reachable)throw new Error('No official calendar pages could be reached')
  const calendars=[...new Map(pages.flatMap(page=>page.links).map(item=>[item.url,item])).values()]
  if(calendars.length){
   const db=createSupabaseClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
   const {error}=await db.from('official_calendar_sources').upsert(calendars.map(item=>({...item,last_seen_at:new Date().toISOString()})),{onConflict:'url',ignoreDuplicates:false})
   if(error)throw error
  }
  return NextResponse.json({checked_at:new Date().toISOString(),sources_checked:OFFICIAL_CALENDAR_PAGES.length,sources_reachable:reachable,documents_found:calendars.length})
 }catch(error){
  console.error('Official calendar source check failed',error instanceof Error?error.message:'unknown error')
  return NextResponse.json({error:'official_source_check_failed'},{status:502})
 }
}
