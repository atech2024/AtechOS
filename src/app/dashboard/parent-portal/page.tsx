'use client'
import Link from 'next/link'
import {T} from '@/components/translation-provider'
import ExamCalendar from '@/components/exam-calendar'
import {schoolDateTime} from '@/lib/school-date'
import {useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {ReportPanel,type ReportStudent} from '@/components/report-card'
import KindergartenPickupFamily from '@/components/kindergarten-pickup-family'
import KindergartenRelocationFamily from '@/components/kindergarten-relocation-family'
import FamilyFinancePanel from '@/components/family-finance-panel'
import FamilyAttendancePanel from '@/components/family-attendance-panel'
import {FamilyHomeArrivalPanel} from '@/components/home-arrival-panel'
import FamilyNotificationFeed from '@/components/family-notification-feed'
import {ParentBadge} from '@/components/badge-history'
type Assignment={assignment_id:string;subject_name:string;title:string;description:string|null;due_at:string|null;attachment_url:string|null}
type ChildActivity={assignments:Assignment[]}
export default function ParentPortalPage(){
 const [children,setChildren]=useState<ReportStudent[]>([]),[childId,setChildId]=useState(''),[activity,setActivity]=useState<ChildActivity>({assignments:[]}),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const assignments=activity.assignments
 useEffect(()=>{let active=true;createClient().rpc('family_bulletin_data').then(({data,error})=>{if(!active)return;if(error)setError('Impossible de charger les enfants.');else{setChildren(data?.students||[]);setChildId(data?.students?.[0]?.id||'')}setLoading(false)});return()=>{active=false}},[])
 useEffect(()=>{let active=true;setActivity({assignments:[]});if(childId)createClient().rpc('family_child_activity',{p_student:childId}).then(({data,error})=>{if(!active)return;if(error)setError('Impossible de charger les devoirs.');else{setError('');setActivity({assignments:data?.assignments||[]})}});return()=>{active=false}},[childId])
 async function openAttachment(path:string){const {data,error}=await createClient().storage.from('assignment-files').createSignedUrl(path,60);if(error)setError(error.message);else if(data?.signedUrl)window.open(data.signedUrl,'_blank','noopener,noreferrer')}
 return <main className="mx-auto max-w-5xl p-6"><header className="print:hidden"><Link href="/dashboard">← Tableau de bord</Link><h1 className="my-3 text-3xl font-bold">Portail parent</h1><p>Consultez les bulletins publiés, les examens et la présence de vos enfants.</p></header>{error&&<p role="alert" className="my-4 text-red-700">{error}</p>}{loading?<p>Chargement…</p>:!children.length?<p>Aucun enfant lié à ce compte.</p>:<><label className="my-5 block print:hidden">Enfant<select value={childId} onChange={e=>setChildId(e.target.value)} className="ml-2 rounded border p-3">{children.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.atechos_id}</option>)}</select></label>{children.filter(c=>c.id===childId).map(c=><section key={c.id} aria-label="Profil de l’élève" className="mb-5 rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">Profil de votre enfant</p><h2 className="mt-1 text-2xl font-bold">{c.first_name} {c.last_name}</h2><p className="mt-1 text-sm text-slate-700">AtechOS ID · {c.atechos_id}</p></section>)}<ParentBadge key={childId+'badge'} studentId={childId}/><FamilyNotificationFeed/><FamilyAttendancePanel studentId={childId}/><FamilyHomeArrivalPanel key={childId+'home-arrival'} studentId={childId}/><a className="inline-block rounded border px-4 py-2 text-blue-700" href="#exam-calendar"><T text="Exams and school calendar"/></a><KindergartenPickupFamily/><KindergartenRelocationFamily/><ExamCalendar key={childId+"calendar"} studentId={childId}/><FamilyFinancePanel key={childId+"finance"} studentId={childId}/><ReportPanel key={childId} studentId={childId}/><section className="mt-6 print:hidden"><h2 className="text-2xl font-bold">Devoirs</h2>{assignments.map(a=><article key={a.assignment_id} className="my-3 rounded border bg-white p-4"><h3 className="font-bold">{a.title}</h3><p>{a.subject_name} · {a.due_at?schoolDateTime(a.due_at):'Sans date limite'}</p><p className="whitespace-pre-wrap">{a.description}</p>{a.attachment_url&&<button className="mt-2 text-blue-700 underline" onClick={()=>openAttachment(a.attachment_url!)}>Ouvrir la pièce jointe</button>}</article>)}{!assignments.length&&<p>Aucun devoir actuel.</p>}</section></>}</main>
}

