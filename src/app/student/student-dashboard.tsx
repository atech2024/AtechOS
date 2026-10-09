'use client'
import {useMemo,useState,type ReactNode} from 'react'
import {CalendarView,type CalendarData} from '@/components/exam-calendar'
import DynamicDashboard from '@/components/dynamic-dashboard'
import StudentChanges from '@/components/student-changes'
import StudentHomeArrival from '@/components/student-home-arrival'
import {T,useLocale} from '@/components/translation-provider'
import {schoolDate} from '@/lib/school-date'
import {type DashboardContext,type DashboardEvent,type DashboardWidget} from '@/lib/dashboard-dynamics'
import type {Report} from '@/components/report-card'
import StudentOverview,{type Student,type Grade,type Attendance,type Period} from './overview'
import SubmissionForm from './submission-form'
type Arrival={check_out_at:string;confirmed_at:string|null;confirmed_as:'parent'|'student'|null}|null
type Change={id:string;actor_name:string;actor_role:string;changed_at:string;entity:string;fields:string[]}
type Assignment={id:string;title:string;description:string;due_at:string|null;attachment_url:string|null;subject:string;teacher:string;online_submission:boolean;submission_status:string}
function dateKey(value:string){return /^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10):new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince'}).format(new Date(value))}
function studentEvents(schoolId:string|null,yearId:string|null,today:string,calendar:CalendarData|null,periods:Period[],year:string):DashboardEvent[]{
 if(!schoolId||!yearId)return[]
 const events:DashboardEvent[]=[]
 const add=(event:DashboardEvent)=>{if(!events.some(e=>e.kind===event.kind&&e.startsOn===event.startsOn&&e.endsOn===event.endsOn))events.push(event)}
 for(const exam of calendar?.exams||[])if(exam.year_id===yearId&&!exam.cancelled)add({id:`exam:${exam.id}`,schoolId,academicYearId:yearId,kind:'exams',startsOn:dateKey(exam.starts_at),endsOn:dateKey(exam.ends_at),priority:0,audienceRoles:['student'],upcomingWindowDays:30})
 for(const exam of calendar?.official_exam_dates||[])if(exam.year_id===yearId)add({id:`official-exam:${exam.id}`,schoolId,academicYearId:yearId,kind:'exams',startsOn:exam.start_date,endsOn:exam.end_date,priority:0,audienceRoles:['student'],upcomingWindowDays:30})
 for(const period of periods)if(period.year===year&&period.exam_start)add({id:`period-exam:${period.id}`,schoolId,academicYearId:yearId,kind:'exams',startsOn:period.exam_start,endsOn:period.exam_end||period.exam_start,priority:0,audienceRoles:['student'],upcomingWindowDays:30})
 for(const period of calendar?.periods||[])if(period.year_id===yearId&&period.start_date<=today&&period.end_date>=today)add({id:`courses:${period.id}`,schoolId,academicYearId:yearId,kind:'courses',startsOn:period.start_date,endsOn:period.end_date,priority:50,audienceRoles:['student']})
 const selected=periods.filter(period=>period.year===year),start=selected.map(period=>period.start_date).sort()[0],end=selected.map(period=>period.end_date).sort().at(-1)
 if(start&&end)for(const closure of calendar?.closures||[])if(closure.day>=start&&closure.day<=end)add({id:`holiday:${closure.day}`,schoolId,academicYearId:yearId,kind:'holidays',startsOn:closure.day,endsOn:closure.day,priority:5,audienceRoles:['student'],upcomingWindowDays:14})
 return events
}
function AssignmentList({assignments,locale}:{assignments:Assignment[];locale:ReturnType<typeof useLocale>}){
 return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold"><T text="Assignments"/></h2><div className="mt-4 grid gap-3 lg:grid-cols-2">
 {assignments.map(a=><article key={a.id} className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">{a.title}</h3><p className="mt-1 text-sm text-slate-600"><T text="Subject"/>: {a.subject||'—'} · <T text="Teacher"/>: {a.teacher||'—'}</p><p className="mt-3 whitespace-pre-wrap text-sm">{a.description}</p>{a.due_at&&<p className="mt-3 text-sm font-medium">Date limite : {schoolDate(a.due_at,locale)}</p>}{a.attachment_url&&<a href={`/student/attachment/${a.id}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-blue-700 underline"><T text="Open attachment ↗"/></a>}<p className="mt-3 text-sm">{a.submission_status==='received'?<T text="Devoir remis"/>:a.submission_status==='missing'?<T text="Non remis"/>:<T text="En attente"/>}</p>{a.online_submission&&a.due_at&&new Date(a.due_at).getTime()>=Date.now()&&<SubmissionForm id={a.id}/>}</article>)}
 {!assignments.length&&<p className="text-sm text-slate-600"><T text="No current assignments."/></p>}</div></section>
}
export default function StudentDashboard({student,grades,attendance,periods,report,qr,calendar,calendarError,homeArrival,changes,assignments}:{student:Student;grades:Grade[];attendance:Attendance[];periods:Period[];report:Report;qr?:string|null;calendar:CalendarData|null;calendarError:boolean;homeArrival:Arrival;changes:Change[];assignments:Assignment[]}){
 const locale=useLocale(),years=Array.from(new Set([student.academic_year,...grades.map(g=>g.year),...periods.map(p=>p.year),...attendance.map(a=>a.year),...(report.preschool_cards||[]).map(c=>c.payload.academic_year)].filter((v):v is string=>Boolean(v))))
 const [year,setYear]=useState(student.academic_year||years[0]||'')
 const scopedPeriods=(calendar?.periods||[]).filter(cp=>periods.some(p=>p.id===cp.id&&p.year===year))
 const yearId=scopedPeriods[0]?.year_id||calendar?.exams.find(e=>e.year===year)?.year_id||calendar?.official_exam_dates?.find(e=>e.year===year)?.year_id||null
 const schoolId=calendar?.school_scope_id||null
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince'}).format(new Date())
 const events=useMemo(()=>studentEvents(schoolId,yearId,today,calendar,periods,year),[schoolId,yearId,today,calendar,periods,year])
 const yearPeriods=useMemo(()=>periods.filter(period=>period.year===year),[periods,year])
 const periodIds=useMemo(()=>new Set(yearPeriods.map(period=>period.id)),[yearPeriods])
 const yearStart=yearPeriods.map(period=>period.start_date).sort()[0]
 const yearEnd=yearPeriods.map(period=>period.end_date).sort().at(-1)
 const calendarForYear=useMemo(()=>calendar?({
  ...calendar,
  exams:calendar.exams.filter(exam=>exam.year===year&&(!yearId||exam.year_id===yearId)),
  official_exam_dates:(calendar.official_exam_dates||[]).filter(date=>date.year===year&&(!yearId||date.year_id===yearId)),
  periods:calendar.periods.filter(period=>periodIds.has(period.id)&&(!yearId||period.year_id===yearId)),
  closures:yearStart&&yearEnd?calendar.closures.filter(closure=>closure.day>=yearStart&&closure.day<=yearEnd):[],
 }):null,[calendar,year,yearId,periodIds,yearStart,yearEnd])
 const currentAssignments=year===student.academic_year?assignments:[]
 const dueAssignments=currentAssignments.filter(a=>a.submission_status!=='received'&&a.due_at)
 const nextDue=dueAssignments.map(a=>dateKey(a.due_at!)).sort()[0]||null
 const context:DashboardContext={schoolId,academicYearId:yearId,dashboard:'student',roles:['student'],capabilities:['student:portal'],today}
 const widget=(id:string,baseOrder:number,eventKinds:DashboardWidget<ReactNode>['eventKinds'],content:ReactNode,dueOn?:string|null):DashboardWidget<ReactNode>=>({id,schoolId,academicYearId:yearId,dashboard:'student',requiredRoles:['student'],requiredCapabilities:['student:portal'],eventKinds,dueOn,deadlineWindowDays:7,baseOrder,content})
 const widgets:DashboardWidget<ReactNode>[]=[
 widget('student-profile-and-learning-summary',10,['courses','bulletins'],<StudentOverview qr={qr} student={student} grades={grades} attendance={attendance} periods={periods} report={report} selectedYear={year} onSelectedYearChange={setYear}/>),
 widget('assignments',20,['courses'],<AssignmentList assignments={currentAssignments} locale={locale}/>,nextDue),
 widget('exams-and-calendar',30,['exams','holidays'],calendar?<section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><CalendarView data={calendarForYear||calendar} academicYearId={yearId||undefined}/></section>:<section role="status" className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-bold"><T text="Exams and school calendar"/></h2><p className="mt-2 text-sm text-slate-600"><T text={calendarError?'Unable to load the calendar.':'No exams announced for this selection.'}/></p></section>),
 widget('home-arrival-confirmation',0,[],<StudentHomeArrival data={homeArrival}/>,homeArrival&&!homeArrival.confirmed_at?today:null),
 widget('student-record-updates',40,[],<StudentChanges changes={changes}/>)
 ]
 return <DynamicDashboard context={context} events={events} widgets={widgets}/>
}
