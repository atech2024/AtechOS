import {NextResponse} from 'next/server'
import {createClient as createSupabaseClient} from '@supabase/supabase-js'
import {timingSafeEqual} from 'node:crypto'

export const dynamic='force-dynamic'
export const maxDuration=25

const SOURCES=[
 {name:'MENFP' as const,url:'https://www.menfp.gouv.ht/'},
 {name:'Haitian Government' as const,url:'https://communication.gouv.ht/institution/education/'}
]
const allowedHosts=new Set(['menfp.gouv.ht','www.menfp.gouv.ht','communication.gouv.ht'])

function authorized(request:Request){
 const secret=process.env.CRON_SECRET||''
 const supplied=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
 const expected=Buffer.from(secret),provided=Buffer.from(supplied)
 if(expected.length<32||provided.length!==expected.length)return false
 return timingSafeEqual(expected,provided)
}

function discover(html:string,base:string,source:'MENFP'|'Haitian Government'){
 const found=new Map<string,{url:string;source:'MENFP'|'Haitian Government';label:string;school_year:string|null}>()
 for(const match of html.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)){
  const href=match[2].replaceAll('&amp;','&'),anchor=match[3].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
  try{
   const url=new URL(href,base);url.hash=''
   if(url.protocol!=='https:'||!allowedHosts.has(url.hostname))continue
   const haystack=`${url.pathname} ${url.search} ${anchor}`
   if(!/(?:calendrier|calendar|calandriye)/i.test(haystack)||!/(?:20\d{2}[_\-/ ]?20\d{2}|\.pdf(?:$|\?)|scolaire)/i.test(haystack))continue
   const year=haystack.match(/(20\d{2})\s*[_\-/ –—]\s*(20\d{2})/)
   const label=anchor&&/(?:calendrier|calendar|calandriye)/i.test(anchor)?anchor:`${source} school calendar${year?` ${year[1]}–${year[2]}`:''}`
   found.set(url.toString(),{url:url.toString(),source,label:label.slice(0,240),school_year:year?`${year[1]}/${year[2]}`:null})
  }catch{}
 }
 return [...found.values()]
}

export async function GET(request:Request){
 if(!authorized(request))return NextResponse.json({error:'not_authorized'},{status:401})
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY
 if(!supabaseUrl||!serviceKey)return NextResponse.json({error:'calendar_sync_not_configured'},{status:503})
 try{
  const pages=await Promise.all(SOURCES.map(async source=>{
   const response=await fetch(source.url,{cache:'no-store',signal:AbortSignal.timeout(9000),headers:{'user-agent':'AtechOS official school-calendar checker'}})
   if(!response.ok)throw new Error(`Official source returned ${response.status}`)
   return discover(await response.text(),source.url,source.name)
  }))
  const calendars=pages.flat()
  if(calendars.length){
   const db=createSupabaseClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
   const {error}=await db.from('official_calendar_sources').upsert(calendars.map(item=>({...item,last_seen_at:new Date().toISOString()})),{onConflict:'url',ignoreDuplicates:false})
   if(error)throw error
  }
  return NextResponse.json({checked_at:new Date().toISOString(),sources_checked:SOURCES.length,documents_found:calendars.length})
 }catch(error){
  console.error('Official calendar source check failed',error instanceof Error?error.message:'unknown error')
  return NextResponse.json({error:'official_source_check_failed'},{status:502})
 }
}
