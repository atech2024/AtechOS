'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
export async function studentLogin(form:FormData) {
 const {data,error}=await (await createClient()).rpc('student_device_login',{p_code:String(form.get('code')||''),p_name:String(form.get('name')||''),p_secret:String(form.get('secret')||''),p_new_pin:String(form.get('pin')||'') || null})
 if(error || !data?.token) return {error:'Unable to sign in. Verify your name, code and PIN or activation code. After repeated attempts, wait 15 minutes.'}
 ;(await cookies()).set('atechos_student_session',data.token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/student',maxAge:14*86400})
 redirect('/student')
}
export async function studentLogout() {
 const jar=await cookies();const token=jar.get('atechos_student_session')?.value
 if(token) await (await createClient()).rpc('student_device_logout',{p_token:token})
 jar.set('atechos_student_session','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/student',maxAge:0})
 redirect('/student/login')
}
