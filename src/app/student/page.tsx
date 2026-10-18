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
import Image from 'next/image'
import Link from 'next/link'
import {ArrowRight,BookOpenCheck,CalendarDays,LogOut,ClipboardCheck} from 'lucide-react'
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
 return <main className="student-dashboard min-h-screen px-4 py-5 text-slate-900 sm:px-6 sm:py-8">
  <div className="student-dashboard__content mx-auto max-w-6xl">
  <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-[0_8px_28px_rgba(8,26,53,.06)] print:hidden sm:px-5">
   <Link href="/" aria-label="AtechOS" className="inline-flex min-w-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#056cd3] focus-visible:ring-offset-2"><Image src="/landing/atechos-logo-mark.webp" alt="" width={420} height={372} priority className="h-10 w-11 shrink-0 object-contain mix-blend-multiply"/><Image src="/landing/atechos-logo-wordmark.webp" alt="" width={760} height={157} priority className="ml-1 h-auto w-[94px] object-contain mix-blend-multiply sm:w-[112px]"/></Link>
   <form action={studentLogout}><button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-[#9bbce0] hover:bg-[#f5f9fe] hover:text-[#0757a8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"><LogOut size={17} aria-hidden="true"/><T text="Logout"/></button></form>
  </header>
  <section className="student-dashboard__welcome mb-5 overflow-hidden rounded-[22px] bg-[#081a35] px-5 py-6 text-white sm:px-8 sm:py-7"><div className="student-dashboard__welcome-art" aria-hidden="true"/><div className="relative max-w-3xl"><h1 className="font-serif text-[clamp(27px,4vw,38px)] font-medium leading-tight tracking-[-.025em]"><T text="Student portal"/></h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#d4e0ef] sm:text-base"><T text="Bulletins appear after school leadership publishes them. If none appears, ask the school to publish the period."/></p></div></section>
  <nav aria-label="Raccourcis élève" className="student-dashboard__shortcuts mb-5 grid gap-3 print:hidden sm:grid-cols-3"><a className="student-shortcut group inline-flex min-h-[66px] items-center gap-3 rounded-2xl border border-[#cfe2f8] bg-white px-4 py-3 text-sm font-semibold text-[#123659] transition hover:-translate-y-0.5 hover:border-[#80b5ea] hover:shadow-[0_8px_20px_rgba(5,108,211,.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href="#student-assignments"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9f3ff] text-[#056cd3]"><BookOpenCheck size={20} aria-hidden="true"/></span><span className="min-w-0 flex-1"><T text="Assignments"/></span><ArrowRight className="text-[#6685a5] transition group-hover:translate-x-0.5" size={17} aria-hidden="true"/></a><a className="student-shortcut group inline-flex min-h-[66px] items-center gap-3 rounded-2xl border border-[#cfe2f8] bg-white px-4 py-3 text-sm font-semibold text-[#123659] transition hover:-translate-y-0.5 hover:border-[#80b5ea] hover:shadow-[0_8px_20px_rgba(5,108,211,.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href="#exam-calendar"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fff5df] text-[#9c6200]"><CalendarDays size={20} aria-hidden="true"/></span><span className="min-w-0 flex-1"><T text="Exams and school calendar"/></span><ArrowRight className="text-[#6685a5] transition group-hover:translate-x-0.5" size={17} aria-hidden="true"/></a><a className="student-shortcut group inline-flex min-h-[66px] items-center gap-3 rounded-2xl border border-[#cfe2f8] bg-white px-4 py-3 text-sm font-semibold text-[#123659] transition hover:-translate-y-0.5 hover:border-[#80b5ea] hover:shadow-[0_8px_20px_rgba(5,108,211,.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href="#student-bulletins"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1edff] text-[#6243bd]"><ClipboardCheck size={20} aria-hidden="true"/></span><span className="min-w-0 flex-1"><T text="Published bulletins"/></span><ArrowRight className="text-[#6685a5] transition group-hover:translate-x-0.5" size={17} aria-hidden="true"/></a></nav>
  <StudentOverview qr={data.badge_qr} student={data.student} grades={grades} attendance={data.attendance||[]} periods={data.periods||[]} report={data.report}/>
  <StudentHomeArrival data={homeArrival||null}/>
  <section id="student-assignments" className="my-7 scroll-mt-6 print:hidden" aria-labelledby="student-assignments-heading">
   <div className="mb-4"><h2 id="student-assignments-heading" className="text-xl font-bold tracking-tight text-slate-950"><T text="Assignments"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Keep track of your current assignments and due dates."/></p></div>
   {data.assignments?.map((a:{id:string;title:string;description:string;due_at:string;attachment_url:string|null;subject:string;teacher:string;online_submission:boolean;submission_status:string})=><article key={a.id} className="my-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-base font-bold text-slate-950">{a.title}</h3><p className="mt-1 text-sm text-slate-600"><T text="Subject"/> : {a.subject||'—'} <span aria-hidden="true">·</span> <T text="Teacher"/> : {a.teacher||'—'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${a.submission_status==='received'?'bg-emerald-50 text-emerald-800':a.submission_status==='missing'?'bg-rose-50 text-rose-800':'bg-amber-50 text-amber-900'}`}><T text={a.submission_status==='received'?'Assignment submitted':a.submission_status==='missing'?'Not submitted':'Submission pending'}/></span></div>
    {a.description&&<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{a.description}</p>}
    {a.due_at&&<p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700"><CalendarDays size={16} className="text-[#1766bb]" aria-hidden="true"/><T text="Due date"/> : {schoolDate(a.due_at,locale)}</p>}
    {a.attachment_url&&<a href={`/student/attachment/${a.id}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"><T text="Open attachment ↗"/></a>}
    {a.online_submission&&a.due_at&&new Date(a.due_at).getTime()>=Date.now()&&<div className="mt-4 border-t border-slate-100 pt-4"><SubmissionForm id={a.id}/></div>}
   </article>)}
   {!data.assignments?.length&&<p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600"><T text="No current assignments."/></p>}
  </section>
  <section id="exam-calendar" className="my-7 scroll-mt-6 print:hidden" aria-label="Examens et calendrier scolaire"><h2 className="mb-3 flex items-center gap-2 font-serif text-2xl font-medium tracking-[-.02em] text-[#081a35]"><CalendarDays size={21} className="text-[#1766bb]" aria-hidden="true"/><T text="Exams and school calendar"/></h2>{calendarError&&<p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800"><T text="Unable to load the calendar."/></p>}{calendar&&<CalendarView data={calendar} hideHeading/>}</section>
  <StudentChanges changes={data.changes||[]}/>
  </div>
 </main>
}
