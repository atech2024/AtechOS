import {NextResponse} from 'next/server'
import {timingSafeEqual} from 'node:crypto'
import {checkOfficialCalendarSources} from '@/lib/official-calendar-edge'

export const dynamic='force-dynamic'
export const maxDuration=40

function authorized(request:Request){
 const secret=process.env.CRON_SECRET||''
 const supplied=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
 const expected=Buffer.from(secret),provided=Buffer.from(supplied)
 if(expected.length<32||provided.length!==expected.length)return false
 return timingSafeEqual(expected,provided)
}

export async function GET(request:Request){
 if(!authorized(request))return NextResponse.json({error:'not_authorized'},{status:401})
 try{
  return NextResponse.json(await checkOfficialCalendarSources(true))
 }catch(error){
  console.error('Official calendar source check failed',error instanceof Error?error.message:'unknown error')
  return NextResponse.json({error:'official_source_check_failed'},{status:502})
 }
}
