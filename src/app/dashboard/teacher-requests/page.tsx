import { T } from '@/components/translation-provider'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
export default async function TeacherRequestsPage() {
 const db=await createClient(); const {data:context}=await db.rpc('school_context')
 if(!context?.owner && !context?.roles?.some((r:string)=>['school_admin','director'].includes(r))) redirect('/dashboard')
 const {data:requests,error}=await db.rpc('get_teacher_requests')
 const {data:school}=await db.from('schools').select('code').eq('id',context.school_id).single()
 async function review(form:FormData) {'use server';const {error}=await (await createClient()).rpc('review_teacher_request',{p_request:String(form.get('id')),p_approve:form.get('decision')==='approve'});if(error)throw new Error('Could not review request. Refresh and try again.');revalidatePath('/dashboard/teacher-requests')}
 return <main className="mx-auto max-w-4xl p-6"><h1 className="text-3xl font-bold"><T text="Teacher requests"/></h1><p className="my-4"><T text="School code:"/> <strong>{school?.code}</strong></p>{error && <p role="alert">Unable to load requests.</p>}{requests?.map((r:{id:string;name:string;email:string})=>{return <form key={r.id} action={review} className="my-3 flex flex-wrap items-center gap-4 rounded border p-4"><input type="hidden" name="id" value={r.id}/><span>{r.name || r.email || 'Teacher request'}</span><button name="decision" value="approve" className="rounded bg-blue-600 p-3 text-white"><T text="Approve"/></button><button name="decision" value="reject" className="rounded border p-3"><T text="Reject"/></button></form>})}{!requests?.length && <p><T text="No pending requests."/></p>}</main>
}
