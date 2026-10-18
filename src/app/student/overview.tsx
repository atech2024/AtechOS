'use client'
import AttendanceHistory from '@/components/attendance-history'
import {schoolDate} from '@/lib/school-date'
import {useState} from 'react'
import {T,useLocale} from '@/components/translation-provider'
import {translate} from '@/lib/translations'
import StudentIdentityCard from '@/components/student-identity-card'
import {PreschoolReportCard,ReportCard,type Report} from '@/components/report-card'
type Student={id:string;first_name:string;last_name:string;atechos_id:string;class_name:string|null;academic_year:string|null;photo_available:boolean}
type Grade={student_id:string;subject:string;period:string|null;year:string;score:number;max_score:number;weight:number}
type Attendance={date:string;status:string;check_in_at:string|null;check_out_at:string|null;year:string}
type Period={id:string;name:string;year:string;start_date:string;end_date:string;exam_start:string|null;exam_end:string|null}
export function studentBulletinsForSelection(report:Report,year:string,periodId:string){
 return {
  numeric:report.cards.filter(card=>card.year===year&&(!periodId||card.period_id===periodId)),
  preschool:(report.preschool_cards||[]).filter(card=>card.payload.academic_year===year&&(!periodId||card.payload.period_id===periodId)),
 }
}
export default function StudentOverview({student,grades,attendance,periods,report,qr}:{student:Student;grades:Grade[];attendance:Attendance[];periods:Period[];report:Report;qr?:string|null}){
 const locale=useLocale()
 const t=(text:string)=>translate(text,locale)
 const years=Array.from(new Set([student.academic_year,...grades.map(g=>g.year),...periods.map(p=>p.year),...attendance.map(a=>a.year),...(report.preschool_cards||[]).map(card=>card.payload.academic_year)].filter((y):y is string=>!!y)))
 const [year,setYear]=useState(student.academic_year||years[0]||''),[periodId,setPeriodId]=useState('')
 const available=periods.filter(p=>p.year===year),period=available.find(p=>p.id===periodId)
 const examPeriodDates=available.filter(p=>(!period||p.id===period.id)&&p.exam_start)
 const bulletins=studentBulletinsForSelection(report,year,periodId)
 const records=attendance.filter(a=>a.year===year&&(!period||a.date>=period.start_date&&a.date<=period.end_date))
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince'}).format(new Date())
 const labels=[
  {status:'present',text:'Present',surface:'border-emerald-200 bg-emerald-50 text-emerald-900',progress:'accent-emerald-600'},
  {status:'late',text:'Late',surface:'border-amber-200 bg-amber-50 text-amber-950',progress:'accent-amber-500'},
  {status:'absent',text:'Absent',surface:'border-rose-200 bg-rose-50 text-rose-900',progress:'accent-rose-600'},
 ] as const

 return <>
  <StudentIdentityCard qr={qr} student={student} attendance={attendance.find(a=>a.date===today)}/>
  <p className="mt-3 text-sm text-slate-600"><T text="Attendance today"/> · {schoolDate(today,locale)} · <T text="Haiti time"/></p>
  <section aria-label={`${t('Academic year')} / ${t('Period')}`} className="my-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
   <label className="block text-sm font-semibold text-slate-800"><T text="Academic year"/><select value={year} onChange={e=>{setYear(e.target.value);setPeriodId('')}} className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">{years.map(y=><option key={y}>{y}</option>)}</select></label>
   <label className="block text-sm font-semibold text-slate-800"><T text="Period"/><select value={periodId} onChange={e=>setPeriodId(e.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"><option value=""><T text="All periods"/></option>{available.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  </section>
  <section className="my-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="student-attendance-heading">
   <div className="mb-5"><h2 id="student-attendance-heading" className="text-xl font-bold tracking-tight text-slate-950"><T text="Attendance, lateness and absences"/></h2><p className="mt-1 text-sm leading-6 text-slate-600"><T text="Only recorded school days are counted. A day without a record is not counted as an absence."/></p></div>
   <div className="grid gap-3 sm:grid-cols-3">{labels.map(({status,text,surface,progress})=>{const count=records.filter(a=>a.status===status).length;return <div key={status} className={`rounded-xl border p-4 ${surface}`}><div className="flex items-baseline justify-between gap-2"><span className="text-sm font-semibold">{t(text)}</span><strong className="text-2xl tabular-nums">{count}</strong></div><progress aria-label={`${t(text)} : ${count}`} value={count} max={Math.max(records.length,1)} className={`mt-3 block h-2 w-full overflow-hidden rounded-full ${progress}`}/></div>})}</div>
  </section>
  <AttendanceHistory records={records}/>
  <button onClick={()=>window.print()} className="my-4 inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-300 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 print:hidden"><T text="Print / Save as PDF"/></button>
  <section id="student-bulletins" className="my-6 scroll-mt-6" aria-labelledby="student-bulletins-heading">
   <h2 id="student-bulletins-heading" className="text-xl font-bold tracking-tight text-slate-950"><T text="Published bulletins"/></h2>
   {bulletins.numeric.map(card=><ReportCard key={card.class_id+card.period_id} report={report} card={card}/>)}
   {bulletins.preschool.map(card=><PreschoolReportCard key={card.id} document={card}/>)}
   {!bulletins.numeric.length&&!bulletins.preschool.length&&<p className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600"><T text="No published bulletin for this selection."/></p>}
  </section>
  <section className="my-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="student-exam-periods-heading">
   <h2 id="student-exam-periods-heading" className="text-xl font-bold tracking-tight text-slate-950"><T text="Exam period dates"/></h2>
   <p className="mt-1 text-sm text-slate-600"><T text="These are the dates defined for exam periods. Published exam times appear in the school calendar."/></p>
   {examPeriodDates.map(p=><p key={p.id} className="mt-3 text-sm font-semibold text-slate-800">{p.name} · {schoolDate(p.exam_start||'',locale)} → {schoolDate(p.exam_end||p.exam_start||'',locale)}</p>)}
   {!examPeriodDates.length&&<p className="mt-3 text-sm text-slate-600"><T text="No exam period dates are available for this selection."/></p>}
  </section>
 </>
}
