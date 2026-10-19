import {T} from '@/components/translation-provider'
import {cookies} from 'next/headers'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {studentLogout} from './login/actions'
import StudentDashboard from './student-dashboard'
import type {CalendarData} from '@/components/exam-calendar'
import Image from 'next/image'
import Link from 'next/link'
import {ArrowRight,BookOpenCheck,CalendarDays,ClipboardCheck,LogOut} from 'lucide-react'

export const dynamic='force-dynamic'

export default async function StudentPortal(){
 const cookieStore=await cookies()
 const token=cookieStore.get('atechos_student_session')?.value
 if(!token)redirect('/student/login')

 const db=await createClient()
 const {data,error}=await db.rpc('student_portal_overview',{p_token:token})
 if(error||!data?.student)redirect('/student/login')
 const [calendarResult,arrivalResult]=await Promise.all([
  db.rpc('school_calendar',{p_token:token}),
  db.rpc('student_home_arrival_status',{p_token:token}),
 ])
 const grades=(data.grades||[]).map((grade:{[key:string]:unknown})=>({...grade,student_id:data.student.id}))

 return <main className="student-dashboard min-h-screen px-4 py-5 text-slate-900 sm:px-6 sm:py-8">
  <div className="student-dashboard__content mx-auto max-w-6xl">
   <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-[0_8px_28px_rgba(8,26,53,.06)] print:hidden sm:px-5">
    <Link href="/" aria-label="AtechOS" className="inline-flex min-w-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#056cd3] focus-visible:ring-offset-2"><Image src="/landing/atechos-logo-mark.webp" alt="" width={420} height={372} priority className="h-10 w-11 shrink-0 object-contain mix-blend-multiply"/><Image src="/landing/atechos-logo-wordmark.webp" alt="" width={760} height={157} priority className="ml-1 h-auto w-[94px] object-contain mix-blend-multiply sm:w-[112px]"/></Link>
    <form action={studentLogout}><button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-[#9bbce0] hover:bg-[#f5f9fe] hover:text-[#0757a8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"><LogOut size={17} aria-hidden="true"/><T text="Logout"/></button></form>
   </header>
   <section className="student-dashboard__welcome mb-5 overflow-hidden rounded-[22px] bg-[#081a35] px-5 py-6 text-white sm:px-8 sm:py-7"><div className="student-dashboard__welcome-art" aria-hidden="true"/><div className="relative max-w-3xl"><h1 className="font-serif text-[clamp(27px,4vw,38px)] font-medium leading-tight tracking-[-.025em]"><T text="Student portal"/></h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#d4e0ef] sm:text-base"><T text="Bulletins appear after school leadership publishes them. If none appears, ask the school to publish the period."/></p></div></section>
   <nav aria-label="Raccourcis élève" className="student-dashboard__shortcuts mb-5 grid gap-3 print:hidden sm:grid-cols-3">
    <a className="student-shortcut group inline-flex min-h-[66px] items-center gap-3 rounded-2xl border border-[#cfe2f8] bg-white px-4 py-3 text-sm font-semibold text-[#123659] transition hover:-translate-y-0.5 hover:border-[#80b5ea] hover:shadow-[0_8px_20px_rgba(5,108,211,.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href="#student-assignments"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9f3ff] text-[#056cd3]"><BookOpenCheck size={20} aria-hidden="true"/></span><span className="min-w-0 flex-1"><T text="Assignments"/></span><ArrowRight className="text-[#6685a5] transition group-hover:translate-x-0.5" size={17} aria-hidden="true"/></a>
    <a className="student-shortcut group inline-flex min-h-[66px] items-center gap-3 rounded-2xl border border-[#cfe2f8] bg-white px-4 py-3 text-sm font-semibold text-[#123659] transition hover:-translate-y-0.5 hover:border-[#80b5ea] hover:shadow-[0_8px_20px_rgba(5,108,211,.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href="#exam-calendar"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fff5df] text-[#9c6200]"><CalendarDays size={20} aria-hidden="true"/></span><span className="min-w-0 flex-1"><T text="Exams and school calendar"/></span><ArrowRight className="text-[#6685a5] transition group-hover:translate-x-0.5" size={17} aria-hidden="true"/></a>
    <a className="student-shortcut group inline-flex min-h-[66px] items-center gap-3 rounded-2xl border border-[#cfe2f8] bg-white px-4 py-3 text-sm font-semibold text-[#123659] transition hover:-translate-y-0.5 hover:border-[#80b5ea] hover:shadow-[0_8px_20px_rgba(5,108,211,.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href="#student-bulletins"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1edff] text-[#6243bd]"><ClipboardCheck size={20} aria-hidden="true"/></span><span className="min-w-0 flex-1"><T text="Published bulletins"/></span><ArrowRight className="text-[#6685a5] transition group-hover:translate-x-0.5" size={17} aria-hidden="true"/></a>
   </nav>
   <StudentDashboard student={data.student} grades={grades} attendance={data.attendance||[]} periods={data.periods||[]} report={data.report} qr={data.badge_qr} calendar={calendarResult.error?null:calendarResult.data as CalendarData} calendarError={Boolean(calendarResult.error)} homeArrival={arrivalResult.error?null:arrivalResult.data||null} changes={data.changes||[]} assignments={data.assignments||[]}/>
  </div>
 </main>
}
