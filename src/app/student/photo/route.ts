import {cookies} from 'next/headers'
import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
export async function GET(){
 const token=(await cookies()).get('atechos_student_session')?.value
 if(!token)return new Response('Unauthorized',{status:401})
 const {data,error}=await (await createClient()).functions.invoke('student-photo-link',{body:{token}})
 if(error||!data?.url)return new Response('Photo unavailable',{status:404,headers:{'Cache-Control':'private, no-store'}})
 const response=NextResponse.redirect(data.url);response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');return response
}
