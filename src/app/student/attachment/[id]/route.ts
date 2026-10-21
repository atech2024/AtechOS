import {cookies} from 'next/headers'
import {createClient} from '@/lib/supabase/server'
import {NextResponse} from 'next/server'
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const token=(await cookies()).get('atechos_student_session')?.value
 if(!token)return new Response('Unauthorized',{status:401})
 const {id}=await params
 const {data,error}=await (await createClient()).functions.invoke('student-assignment-link',{body:{token,assignment_id:id}})
 if(error||!data?.url)return new Response('Attachment unavailable',{status:403,headers:{'Cache-Control':'private, no-store'}})
 const response=NextResponse.redirect(data.url)
 response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer')
 return response
}
