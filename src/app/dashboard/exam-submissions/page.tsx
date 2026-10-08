import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {T} from '@/components/translation-provider'
import TeacherExamSubmissions from '@/components/teacher-exam-submissions'
export const dynamic='force-dynamic'
export default async function ExamSubmissionsPage(){
 const db=await createClient()
 const [{data:userResult},{data:context,error}]=await Promise.all([db.auth.getUser(),db.rpc('school_context')])
 if(!userResult.user)redirect('/login')
 if(error)throw new Error('Unable to verify school access.')
 const roles:string[]=context?.roles||[]
 if(!roles.some(role=>['school_admin','director','secretary','censeur','teacher'].includes(role)))redirect('/dashboard')
 return <><div className="sr-only"><T text="Exam submissions"/></div><TeacherExamSubmissions/></>
}
