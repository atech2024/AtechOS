import SubmissionForm from './submission-form'
import { T } from '@/components/translation-provider'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { studentLogout } from './login/actions'
import FamilyBulletins from '@/app/dashboard/family-bulletins/viewer'
export const dynamic='force-dynamic'
export default async function StudentPortal() {
 const token=(await cookies()).get('atechos_student_session')?.value
 if(!token)redirect('/student/login')
 const {data,error}=await (await createClient()).rpc('student_device_data',{p_token:token})
 if(error || !data?.student)redirect('/student/login')
 const grades=(data.grades || []).map((g:{[key:string]:unknown})=>({...g,student_id:data.student.id}))
 return <main className="mx-auto max-w-5xl p-6"><header className="flex justify-between print:hidden"><h1 className="text-2xl font-bold"><T text="Student portal"/></h1><form action={studentLogout}><button className="rounded border p-3"><T text="Logout"/></button></form></header><p className="my-4">Les bulletins apparaissent après publication par la direction. Si aucun bulletin ne s’affiche, demandez à la direction de publier la période.</p><FamilyBulletins studentMode data={{students:[data.student],grades}} /><section className="print:hidden"><h2 className="text-2xl font-bold"><T text="Assignments"/></h2>{data.assignments?.map((a:{id:string;title:string;description:string;due_at:string;attachment_url:string|null;subject:string;teacher:string;online_submission:boolean;submission_status:string},i:number)=><article key={i} className="my-3 rounded border p-4"><h3 className="font-semibold">{a.title}</h3><p><T text="Subject"/>: {a.subject||"—"} · <T text="Teacher"/>: {a.teacher||"—"}</p><p className="whitespace-pre-wrap">{a.description}</p><p>{a.due_at?new Date(a.due_at).toLocaleDateString():''}</p>{a.attachment_url && <a href={`/student/attachment/${a.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline"><T text="Open attachment ↗"/></a>}<p>{a.submission_status==='received'?'Devoir remis':a.submission_status==='missing'?'Non remis':'En attente'}</p>{a.online_submission&&a.due_at&&new Date(a.due_at).getTime()>=Date.now()&&<SubmissionForm id={a.id}/>}</article>)}{!data.assignments?.length && <p><T text="No current assignments."/></p>}</section></main>
}
