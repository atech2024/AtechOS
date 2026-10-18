import type {CalendarData} from '@/components/exam-calendar'
import type {Period} from '@/app/student/overview'
import type {Report} from '@/components/report-card'
import type {DashboardEvent} from './dashboard-dynamics'

export function dateKey(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)?value:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince'}).format(new Date(value))}

export function buildStudentDashboardEvents({schoolId,yearId,today,calendar,periods,report,year}:{schoolId:string|null;yearId:string|null;today:string;calendar:CalendarData|null;periods:Period[];report:Report;year:string}):DashboardEvent[]{
 if(!schoolId||!yearId)return[]
 const events:DashboardEvent[]=[]
 const add=(event:DashboardEvent)=>{if(!events.some(e=>e.kind===event.kind&&e.startsOn===event.startsOn&&e.endsOn===event.endsOn))events.push(event)}
 for(const exam of calendar?.exams||[])if(exam.year_id===yearId&&!exam.cancelled)add({id:`exam:${exam.id}`,schoolId,academicYearId:yearId,kind:'exams',startsOn:dateKey(exam.starts_at),endsOn:dateKey(exam.ends_at),priority:0,audienceRoles:['student'],upcomingWindowDays:30})
 for(const exam of calendar?.official_exam_dates||[])if(exam.year_id===yearId)add({id:`official-exam:${exam.id}`,schoolId,academicYearId:yearId,kind:'exams',startsOn:exam.start_date,endsOn:exam.end_date,priority:0,audienceRoles:['student'],upcomingWindowDays:30})
 for(const period of periods)if(period.year===year&&period.exam_start)add({id:`period-exam:${period.id}`,schoolId,academicYearId:yearId,kind:'exams',startsOn:period.exam_start,endsOn:period.exam_end||period.exam_start,priority:0,audienceRoles:['student'],upcomingWindowDays:30})
 for(const period of calendar?.periods||[])if(period.year_id===yearId&&period.start_date<=today&&period.end_date>=today)add({id:`courses:${period.id}`,schoolId,academicYearId:yearId,kind:'courses',startsOn:period.start_date,endsOn:period.end_date,priority:50,audienceRoles:['student']})
 const selected=periods.filter(period=>period.year===year),start=selected.map(period=>period.start_date).sort()[0],end=selected.map(period=>period.end_date).sort().at(-1)
 if(start&&end)for(const closure of calendar?.closures||[])if(closure.day>=start&&closure.day<=end)add({id:`holiday:${closure.day}`,schoolId,academicYearId:yearId,kind:'holidays',startsOn:closure.day,endsOn:closure.day,priority:5,audienceRoles:['student'],upcomingWindowDays:14})
 // Published results are already visible to this student. Keep the results widget
 // relevant for the remainder of that academic year, after urgent exam/deadline widgets.
 if(start&&end){
  const periodIds=new Set(selected.map(period=>period.id))
  const published=(periodId:string,publishedAt:string|undefined,id:string)=>{const publishedOn=publishedAt?dateKey(publishedAt):'';if(periodIds.has(periodId)&&publishedOn&&publishedOn>=start&&publishedOn<=end)add({id,schoolId,academicYearId:yearId,kind:'bulletins',startsOn:publishedOn,endsOn:end,priority:65,audienceRoles:['student']})}
  for(const card of report.cards||[])if(card.year===year&&card.document?.published_at)published(card.period_id,card.document.published_at,`bulletin:${card.class_id}:${card.period_id}`)
  for(const card of report.preschool_cards||[])if(card.payload.academic_year===year)published(card.payload.period_id,card.published_at,`preschool-bulletin:${card.id}`)
 }
 return events
}
