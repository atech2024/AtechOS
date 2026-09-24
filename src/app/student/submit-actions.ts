'use server'
import {cookies} from 'next/headers'
import {revalidatePath} from 'next/cache'
import {createClient} from '@/lib/supabase/server'
export async function submitAssignment(id:string,response:string){
 const token=(await cookies()).get('atechos_student_session')?.value
 if(!token)return {error:'Reconnectez-vous au portail élève.'}
 const {data,error}=await (await createClient()).rpc('submit_student_assignment',{p_token:token,p_assignment:id,p_response:response})
 if(error||data?.error)return {error:data?.error==='deadline_passed'?'La date limite est passée.':'Remise impossible. Vérifiez votre session et la date limite.'}
 revalidatePath('/student');return {success:true}
}
