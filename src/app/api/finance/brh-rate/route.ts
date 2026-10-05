import {NextResponse} from 'next/server'
import {timingSafeEqual} from 'node:crypto'
import {createClient} from '@/lib/supabase/server'
import {refreshBrhReferenceRate} from '@/lib/brh-reference-rate'

export const dynamic='force-dynamic'
export const maxDuration=35

export async function POST(request:Request){
 const origin=request.headers.get('origin')
 if(!origin||origin!==new URL(request.url).origin)return NextResponse.json({error:'invalid_origin'},{status:403})
 const db=await createClient(),{data:{user}}=await db.auth.getUser()
 if(!user)return NextResponse.json({error:'authentication_required'},{status:401})
 const {data,error}=await db.rpc('finance_payment_setup')
 if(error)return NextResponse.json({error:'finance_access_unavailable'},{status:503})
 const setup=(Array.isArray(data)?data[0]:data) as {can_manage?:boolean}|null
 if(!setup?.can_manage)return NextResponse.json({error:'not_authorized'},{status:403})
 try{return NextResponse.json(await refreshBrhReferenceRate())}
 catch(error){console.error('BRH rate refresh failed',error instanceof Error?error.message:'unknown error');return NextResponse.json({error:error instanceof Error?error.message:'brh_rate_refresh_failed'},{status:502})}
}

export async function GET(request:Request){
 const secret=process.env.CRON_SECRET||'',provided=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
 const expected=Buffer.from(secret),actual=Buffer.from(provided)
 if(expected.length<32||actual.length!==expected.length||!timingSafeEqual(expected,actual))return NextResponse.json({error:'not_authorized'},{status:401})
 try{return NextResponse.json(await refreshBrhReferenceRate())}
 catch(error){console.error('Scheduled BRH rate refresh failed',error instanceof Error?error.message:'unknown error');return NextResponse.json({error:error instanceof Error?error.message:'brh_rate_refresh_failed'},{status:502})}
}
