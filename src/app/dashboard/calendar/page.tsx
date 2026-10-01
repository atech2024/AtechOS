import ExamCalendar from '@/components/exam-calendar'
import HaitiHolidaySuggestions from '@/components/haiti-holiday-suggestions'
import AttendanceCalendar from '@/components/attendance-calendar'
import AcademicYearCalendar from '@/components/academic-year-calendar'
import {createClient} from '@/lib/supabase/server'
import {T} from '@/components/translation-provider'
export const dynamic='force-dynamic'
export default async function CalendarPage(){
 const db=await createClient(),{data:context,error}=await db.rpc('school_context')
 if(error)throw new Error('Unable to verify school access.')
 const roles:string[]=context?.roles||[]
 const canManageClosures=roles.some(role=>['school_admin','director','secretary','surveillant','censeur'].includes(role))
 const canManageYears=roles.some(role=>['school_admin','director'].includes(role))
 return <main className="mx-auto max-w-6xl p-6"><header className="mb-5"><h1 className="text-3xl font-bold"><T text="School Calendar"/></h1><p className="mt-1 text-slate-600"><T text="Academic years, confirmed closures, holidays and published exam dates in one place."/></p></header><AcademicYearCalendar canManage={canManageYears}/><AttendanceCalendar canManage={canManageClosures}/><HaitiHolidaySuggestions/><ExamCalendar/></main>
}
