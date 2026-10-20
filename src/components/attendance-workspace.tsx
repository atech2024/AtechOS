'use client'
import { T } from '@/components/translation-provider'
import { ScanLine } from 'lucide-react'
import Link from 'next/link'
import AttendanceCalendar from '@/components/attendance-calendar'
import {HomeArrivalStaffPanel} from '@/components/home-arrival-panel'
import SchoolReleaseProtocolPanel from '@/components/school-release-protocol'
import SchoolDateInput from '@/components/school-date-input'
import {schoolTime} from '@/lib/school-date'
import {useAcademicYear} from '@/components/academic-year-context'
import { useEffect,useState,useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {filterPreschoolAttendanceClasses} from '@/lib/preschool-overview'
type Student={id:string;first_name:string;last_name:string};type ClassRow={id:string;name:string;grade_level:string|null;grade_level_id:string|null;academic_year_id:string;year_start:string;year_end:string};type AttendanceRow={id:string;student_id:string;status:string;late_minutes:number;check_in_at:string|null;check_out_at:string|null;notes:string|null}
export default function AttendancePage({embedded=false}:{embedded?:boolean}){const {yearId:academicYearId}=useAcademicYear();let supabase: ReturnType<typeof createClient> | null = null
  const getSupabase = () => {
    if (!supabase) supabase = createClient()
    return supabase
  };const loadVersion=useRef(0);const [canMark,setCanMark]=useState(false),[events,setEvents]=useState<{student_id:string;source:string;actor_name:string;actor_role:string;action:string;recorded_at:string}[]>([]),[saving,setSaving]=useState(false);const [classes,setClasses]=useState<ClassRow[]>([]),[students,setStudents]=useState<Student[]>([]),[records,setRecords]=useState<Record<string,AttendanceRow>>({});const [classId,setClassId]=useState(''),[date,setDate]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince'}).format(new Date())),[loading,setLoading]=useState(true),[error,setError]=useState('')
 async function loadClasses(){
  const [classesResult,gradesResult]=await Promise.all([
   getSupabase().from('classes').select('id,name,grade_level,grade_level_id,academic_year_id').eq('enabled',true).eq('academic_year_id',academicYearId).order('name'),
   getSupabase().rpc('get_grade_levels'),
  ])
  const {data,error}=classesResult
  if(error||gradesResult.error){setError((error||gradesResult.error)?.message||'');setLoading(false);return}
  const scoped=embedded?filterPreschoolAttendanceClasses(data||[],gradesResult.data||[]):data||[]
  const ids=[...new Set(scoped.map(c=>c.academic_year_id).filter(Boolean))]
  const years=ids.length?await getSupabase().from('academic_years').select('id,start_date,end_date').in('id',ids):{data:[],error:null}
  if(years.error){setError(years.error.message);setLoading(false);return}
  const rows=scoped.map(c=>{const y=years.data?.find(y=>y.id===c.academic_year_id);return {...c,year_start:y?.start_date||'',year_end:y?.end_date||''}}) as ClassRow[]
  setClasses(rows)
  if(!rows.length){setClassId('');setStudents([]);setRecords({});setEvents([]);setLoading(false);return}
  if(!rows.some(c=>c.id===classId)){setClassId(rows[0]?.id||'');if(rows[0])setDate(current=>current<rows[0].year_start||current>rows[0].year_end?rows[0].year_start:current)}
 }
async function loadRoster(){
  if(!classId){setStudents([]);setRecords({});setEvents([]);setLoading(false);return}const version=++loadVersion.current;setLoading(true);setError('');
 const er=await getSupabase().from('enrollments').select('student_id').eq('class_id',classId).eq('status','active');
 if(version!==loadVersion.current)return;
 if(er.error){setError(er.error.message);setLoading(false);return}
 const studentIds=(er.data||[]).map(e=>e.student_id);
 if(!studentIds.length){setStudents([]);setRecords({});setEvents([]);setLoading(false);return}
 const [sr,ar,ev]=await Promise.all([
  getSupabase().from('students').select('id,first_name,last_name').in('id',studentIds),
  getSupabase().from('attendance').select('id,student_id,status,late_minutes,check_in_at,check_out_at,notes').in('student_id',studentIds).eq('attendance_date',date),
  getSupabase().from('attendance_events').select('student_id,source,actor_name,actor_role,action,recorded_at').in('student_id',studentIds).eq('attendance_date',date).order('recorded_at',{ascending:false})
 ]);
 if(version!==loadVersion.current)return;
 const failure=sr.error||ar.error||ev.error;if(failure)setError(failure.message);
 setStudents((sr.data||[]) as Student[]);setEvents(ev.data||[]);
 const map:Record<string,AttendanceRow>={};(ar.data||[]).forEach((r:AttendanceRow)=>{map[r.student_id]=r});setRecords(map);setLoading(false)
}
useEffect(()=>{loadClasses();getSupabase().rpc('school_context').then(({data})=>setCanMark(Boolean(data?.owner||data?.roles?.some((r:string)=>['school_admin','director','secretary','surveillant','censeur'].includes(r)))))},[academicYearId]);useEffect(()=>{loadRoster()},[classId,date]);const selectedClass=classes.find(c=>c.id===classId)
async function mark(student:string,status:string){setSaving(true);setError('');try{const {error}=await getSupabase().rpc('staff_mark_attendance',{p_student:student,p_class:classId,p_status:status});if(error)setError(error.message);else await loadRoster()}finally{setSaving(false)}}
return <div className={`${embedded?'':'mx-auto max-w-7xl'} space-y-6 ${embedded?'':'p-4 sm:p-6 lg:p-8'}`}>{!embedded&&<header><h1 className="text-3xl font-bold text-slate-900"><T text="Attendance"/></h1><p className="mt-1 text-slate-500"><T text="Manual attendance records include the staff account and role. Kiosk records identify the student."/></p><Link href="/kiosk" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-md"><ScanLine className="size-4" aria-hidden="true"/><T text="Attendance Kiosk"/></Link></header>}{!embedded&&canMark&&<SchoolReleaseProtocolPanel/>}{!embedded&&<HomeArrivalStaffPanel/>}<AttendanceCalendar canManage={canMark}/>{error&&<p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium"><T text="Class"/><select value={classId} onChange={e=>{const next=classes.find(c=>c.id===e.target.value);setClassId(e.target.value);if(next&&(date<next.year_start||date>next.year_end))setDate(next.year_start)}} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" disabled={!classes.length}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="text-sm font-medium"><T text="Date"/><SchoolDateInput type="date" min={selectedClass?.year_start} max={selectedClass?.year_end} value={date} onChange={e=>setDate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"/></label></div></section><section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-semibold"><T text="Daily roster"/></h2><p className="mt-1 text-sm text-slate-500"><strong>{students.length}</strong> <T text={students.length===1?'student':'students'}/></p></div>{loading?<p className="p-5 text-slate-500"><T text="Loading..."/></p>:classes.length===0&&embedded?<p className="p-5 text-slate-500"><T text="No preschool classes are available for this academic year."/></p>:students.length===0?<p className="p-5 text-slate-500"><T text="No active students are enrolled in this class yet."/></p>:<div className="divide-y divide-slate-100">{students.map(student=>{const r=records[student.id];return <div key={student.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-slate-900">{student.first_name} {student.last_name}</p><p className="text-xs text-slate-500">{r?.check_in_at?<><T text="Check-in"/> {schoolTime(r.check_in_at)}</>:<T text="No check-in"/>}{r?.check_out_at?<> · <T text="Check-out"/> {schoolTime(r.check_out_at)}</>:''}</p></div><div className="flex flex-wrap gap-2">{canMark&&date===new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince'}).format(new Date())&&['present','late','absent','checkout'].map(status=><button key={status} disabled={saving} onClick={()=>mark(student.id,status)} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${status==='present'?'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100':status==='late'?'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100':status==='absent'?'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100':'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'}`}><T text={status}/></button>)}<span className="rounded-lg bg-slate-100 px-3 py-2 text-sm"><T text={r?.status||'No check-in'}/></span>{events.filter(e=>e.student_id===student.id&&new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince'}).format(new Date(e.recorded_at))===date).map((e,i)=><p key={i} className="w-full text-xs">{e.source} · {e.actor_name} ({e.actor_role}) · {e.action} · {schoolTime(e.recorded_at)}</p>)}</div></div>})}</div>}</section></div>}
