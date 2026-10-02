import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {checkOfficialCalendarSources} from '@/lib/official-calendar-edge'

export const dynamic='force-dynamic'

export async function GET(){
 const db=await createClient(),{data:{user}}=await db.auth.getUser()
 if(!user)return NextResponse.json({error:'authentication_required'},{status:401})
 const {data:context,error}=await db.rpc('school_context')
 if(error)return NextResponse.json({error:'school_access_unavailable'},{status:503})
 const roles:string[]=context?.roles||[]
 if(!roles.some(role=>['school_admin','director','secretary','surveillant','censeur'].includes(role)))return NextResponse.json({error:'not_authorized'},{status:403})
 try{
  return NextResponse.json(await checkOfficialCalendarSources(false))
 }catch(error){
  console.error('Calendar source refresh failed',error instanceof Error?error.message:'unknown error')
  return NextResponse.json({checked_at:new Date().toISOString(),latest_calendar:null,warning:'Online calendar sources could not be checked right now. Existing dates remain unchanged; staff must verify any document before approving closures.'})
 }
}
