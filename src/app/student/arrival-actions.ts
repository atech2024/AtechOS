'use server'
import {cookies} from 'next/headers'
import {revalidatePath} from 'next/cache'
import {createClient} from '@/lib/supabase/server'

export type HomeArrivalActionState={error:string;success:string}
export async function confirmStudentHomeArrival(_previous:HomeArrivalActionState,_formData:FormData):Promise<HomeArrivalActionState>{
 void _previous;void _formData;
 const token=(await cookies()).get('atechos_student_session')?.value
 if(!token)return {error:'Your student session has expired. Sign in again.',success:''}
 const {error}=await (await createClient()).rpc('confirm_student_home_arrival',{p_token:token})
 if(error)return {error:error.message==='student_not_checked_out'?'Check out through KIOS before confirming arrival.':'Unable to save the confirmation.',success:''}
 revalidatePath('/student')
 return {error:'',success:'Arrival at home confirmed.'}
}
