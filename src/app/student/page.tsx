import {CalendarView} from '@/components/exam-calendar'
import StudentChanges from '@/components/student-changes'
import {schoolDate} from '@/lib/school-date'
import SubmissionForm from './submission-form'
import { T } from '@/components/translation-provider'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { studentLogout } from './login/actions'
import StudentOverview from './overview'
import StudentHomeArrival from '@/components/student-home-arrival'
import {localeFrom} from '@/lib/i18n'
export const dynamic='force-dynamic'
export default async function StudentPortal() {
 const cookieStore=await cookies()
 const token=cookieStore.get('atechos_student_session')?.value
 const locale=localeFrom(cookieStore.get('atechos_locale')?.value)
 if(!token)redirect('/student/login')
 const {data,error}=await (await createClient()).rpc('student_portal_overview',{p_token:token})
 if(error || !data?.student)redirect('/student/login')
 const {data:calendar,error:calendarError}=await (await createClient()).rpc('school_calendar',{p_token:token})
 const {data:homeArrival}=await (await createClient()).rpc('student_home_arrival_status',{p_token:token})
 const grades=(data.grades || []).map((g:{[key:string]:unknown})=>({...g,student_id:data.student.id}))
 return <main className="mx-auto min-h-screen max-w-6xl px-4 py-5 text-slate-900 sm:px-6 sm:py-8">
  <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 print:hidden">
   <div className="min-w-0"><p className="text-sm font-extrabold tracking-tight text-blue-700">AtechOS</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"><T text="Student portal"/></h1></div>
   <form action={studentLogout}><button className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-300 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"><T text="Logout"/></button></form>
  </header>
  <p className="max-w-3xl text-sm leading-6 text-slate-600"><T text="Bulletins appear after school leadership publishes them. If none appears, ask the school to publish the period."/></p>
  <nav aria-label="Raccourcis élève" className="my-4 flex flex-wrap gap-2 print:hidden"><a className="inline-flex min-h-10 items-center rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href="#student-assignments"><T text="Assignments"/></a><a className="inline-flex min-h-10 items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href="#exam-calendar"><T text="Exams and school calendar"/></a><a className="inline-flex min-h-10 items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href="#student-bulletins"><T text="Published bulletins"/></a></nav>
  <StudentOverview qr={data.badge_qr} student={data.student} grades={grades} attendance={data.attendance||[]} periods={data.periods||[]} report={data.report}/>
  <StudentHomeArrival data={homeArrival||null}/>
  <section id="student-assignments" className="my-7 scroll-mt-6 print:hidden" aria-labelledby="student-assignments-heading">
   <div className="mb-4"><h2 id="student-assignments-heading" className="text-xl font-bold tracking-tight text-slate-950"><T text="Assignments"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Keep track of your current assignments and due dates."/></p></div>
   {data.assignments?.map((a:{id:string;title:string;description:string;due_at:string;attachment_url:string|null;subject:string;teacher:string;online_submission:boolean;submission_status:string})=><article key={a.id} className="my-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-base font-bold text-slate-950">{a.title}</h3><p className="mt-1 text-sm text-slate-600"><T text="Subject"/> : {a.subject||'—'} <span aria-hidden="true">·</span> <T text="Teacher"/> : {a.teacher||'—'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${a.submission_status==='received'?'bg-emerald-50 text-emerald-800':a.submission_status==='missing'?'bg-rose-50 text-rose-800':'bg-amber-50 text-amber-900'}`}><T text={a.submission_status==='received'?'Assignment submitted':a.submission_status==='missing'?'Not submitted':'Submission pending'}/></span></div>
    {a.description&&<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{a.description}</p>}
    {a.due_at&&<p className="mt-3 text-sm font-medium text-slate-700"><T text="Due date"/> : {schoolDate(a.due_at,locale)}</p>}
    {a.attachment_url&&<a href={`/student/attachment/${a.id}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"><T text="Open attachment ↗"/></a>}
    {a.online_submission&&a.due_at&&new Date(a.due_at).getTime()>=Date.now()&&<div className="mt-4 border-t border-slate-100 pt-4"><SubmissionForm id={a.id}/></div>}
   </article>)}
   {!data.assignments?.length&&<p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600"><T text="No current assignments."/></p>}
  </section>
  <section className="my-7 scroll-mt-6 print:hidden" aria-label="Examens et calendrier scolaire">{calendarError&&<p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800"><T text="Unable to load the calendar."/></p>}{calendar&&<CalendarView data={calendar}/>}</section>
  <StudentChanges changes={data.changes||[]}/>
 </main>
}
