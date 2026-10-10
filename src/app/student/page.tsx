import { T } from '@/components/translation-provider'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { studentLogout } from './login/actions'
import StudentDashboard from './student-dashboard'
import type { CalendarData } from '@/components/exam-calendar'
export const dynamic = 'force-dynamic'
export default async function StudentPortal() {
 const token=(await cookies()).get('atechos_student_session')?.value
 if(!token)redirect('/student/login')
 const db=await createClient()
 const {data,error}=await db.rpc('student_portal_overview',{p_token:token})
 if(error||!data?.student)redirect('/student/login')
 const [calendarResult,arrivalResult]=await Promise.all([
  db.rpc('school_calendar',{p_token:token}),
  db.rpc('student_home_arrival_status',{p_token:token}),
 ])
 const grades=(data.grades||[]).map((g:{[key:string]:unknown})=>({...g,student_id:data.student.id}))
 return <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
  <header className="flex flex-wrap items-center justify-between gap-4 print:hidden"><div><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">AtechOS</p><h1 className="text-3xl font-bold tracking-tight"><T text="Student portal"/></h1><p className="mt-1 max-w-2xl text-sm text-slate-600">Les bulletins apparaissent après publication par la direction. Si aucun bulletin ne s’affiche, demandez à la direction de publier la période.</p></div><form action={studentLogout}><button className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-semibold shadow-sm"><T text="Logout"/></button></form></header>
  <StudentDashboard student={data.student} grades={grades} attendance={data.attendance||[]} periods={data.periods||[]} report={data.report} qr={data.badge_qr} calendar={calendarResult.error?null:calendarResult.data as CalendarData} calendarError={Boolean(calendarResult.error)} homeArrival={arrivalResult.error?null:arrivalResult.data||null} changes={data.changes||[]} assignments={data.assignments||[]}/>
 </main>
}
