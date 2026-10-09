'use client'
import AttendanceHistory from '@/components/attendance-history'
import {schoolDate} from '@/lib/school-date'
import {useState} from 'react'
import StudentIdentityCard from '@/components/student-identity-card'
import {PreschoolReportCard,ReportCard,type Report} from '@/components/report-card'
export type Student={id:string;first_name:string;last_name:string;atechos_id:string;class_name:string|null;academic_year:string|null;photo_available:boolean}
export type Grade={student_id:string;subject:string;period:string|null;year:string;score:number;max_score:number;weight:number}
export type Attendance={date:string;status:string;check_in_at:string|null;check_out_at:string|null;year:string}
export type Period={id:string;name:string;year:string;start_date:string;end_date:string;exam_start:string|null;exam_end:string|null}
export function studentBulletinsForSelection(report:Report,year:string,periodId:string){
 return {
  numeric:report.cards.filter(card=>card.year===year&&(!periodId||card.period_id===periodId)),
  preschool:(report.preschool_cards||[]).filter(card=>card.payload.academic_year===year&&(!periodId||card.payload.period_id===periodId)),
 }
}
export default function StudentOverview({student,grades,attendance,periods,report,qr,selectedYear,onSelectedYearChange}:{student:Student;grades:Grade[];attendance:Attendance[];periods:Period[];report:Report;qr?:string|null;selectedYear?:string;onSelectedYearChange?:(year:string)=>void}){
 const years=Array.from(new Set([student.academic_year,...grades.map(g=>g.year),...periods.map(p=>p.year),...attendance.map(a=>a.year),...(report.preschool_cards||[]).map(card=>card.payload.academic_year)].filter((y):y is string=>!!y)))
 const [internalYear,setInternalYear]=useState(student.academic_year||years[0]||''),[periodId,setPeriodId]=useState('')\n const year=selectedYear??internalYear,chooseYear=onSelectedYearChange??setInternalYear
 const available=periods.filter(p=>p.year===year),period=available.find(p=>p.id===periodId)
 const bulletins=studentBulletinsForSelection(report,year,periodId)
 const records=attendance.filter(a=>a.year===year&&(!period||a.date>=period.start_date&&a.date<=period.end_date))
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince'}).format(new Date())
 const labels=[['present','Présent'],['late','En retard'],['absent','Absent']] as const
 return <><StudentIdentityCard qr={qr} student={student} attendance={attendance.find(a=>a.date===today)}/><p className="text-sm text-slate-500">Présence du {schoolDate(today)} · heure d’Haïti</p><div className="my-5 flex flex-wrap gap-4"><label>Année académique<select value={year} onChange={e=>{chooseYear(e.target.value);setPeriodId('')}} className="ml-2 rounded border p-3">{years.map(y=><option key={y}>{y}</option>)}</select></label><label>Période<select value={periodId} onChange={e=>setPeriodId(e.target.value)} className="ml-2 rounded border p-3"><option value="">Toutes les périodes</option>{available.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div><section className="my-5 rounded-2xl border p-5"><h2 className="text-xl font-bold">Présence, retards et absences</h2><p className="my-2 text-sm">Comptage des jours enregistrés uniquement. Un jour sans dossier n’est pas considéré absent.</p>{labels.map(([status,label])=>{const count=records.filter(a=>a.status===status).length;return <div key={status} className="my-3"><label>{label} : {count}<progress aria-label={label} value={count} max={Math.max(records.length,1)} className="block h-5 w-full"/></label></div>})}</section><AttendanceHistory records={records}/><button onClick={()=>window.print()} className="rounded border p-3 print:hidden">Imprimer / Enregistrer en PDF</button><section className="my-5"><h2 className="text-xl font-bold">Bulletins publiés</h2>{bulletins.numeric.map(card=><ReportCard key={card.class_id+card.period_id} report={report} card={card}/>)}{bulletins.preschool.map(card=><PreschoolReportCard key={card.id} document={card}/>)}{!bulletins.numeric.length&&!bulletins.preschool.length&&<p>Aucun bulletin publié pour cette sélection.</p>}</section><section className="my-5 rounded-2xl border p-5"><h2 className="text-xl font-bold">Dates des examens</h2>{available.filter(p=>(!period||p.id===period.id)&&p.exam_start).map(p=><p key={p.id} className="my-3">{p.name} : {schoolDate(p.exam_start)} → {schoolDate(p.exam_end||p.exam_start)}</p>)}{!available.some(p=>(!period||p.id===period.id)&&p.exam_start)&&<p>Aucune date d’examen annoncée pour cette sélection.</p>}</section></>
}
