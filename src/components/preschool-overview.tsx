'use client'

import {useCallback,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {Baby,BookOpen,CalendarDays,CheckCircle2,ClipboardCheck,GraduationCap,Layers3,Users} from 'lucide-react'
import {T,useLocale} from '@/components/translation-provider'
import {useAcademicYear} from '@/components/academic-year-context'
import {createClient} from '@/lib/supabase/client'
import {translate} from '@/lib/translations'
import {summarizePreschoolLevels,uniquePreschoolStaff,type PreschoolClassOverview,type PreschoolAssignedStaff} from '@/lib/preschool-overview'

type ClassRow={id:string;name:string;grade:string;year_id:string;year:string}
type Workspace={classes:ClassRow[];settings?:{coordinator_user_id?:string|null}}
type ClassDetail={students?:{id:string}[];staff?:PreschoolAssignedStaff[];staff_options?:{id:string;name:string}[];settings?:{coordinator_user_id?:string|null}}
type ViewState={classes:PreschoolClassOverview[];manager:boolean;coordinatorName:string|null;coordinatorAssigned:boolean}
const blank:ViewState={classes:[],manager:false,coordinatorName:null,coordinatorAssigned:false}

function initials(name:string){return name.trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase()}

export default function PreschoolOverview({canManage}:{canManage:boolean}){
 const locale=useLocale(),t=(text:string)=>translate(text,locale),db=useMemo(()=>createClient(),[])
 const {yearId,years,canSelect,setYearId}=useAcademicYear()
 const activeYear=years.find(item=>item.id===yearId)||years.find(item=>item.is_current)||null
 const [state,setState]=useState(blank),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const {data:overview,error:overviewError}=await db.rpc('preschool_report_workspace',{p_class:null,p_period:null})
   if(overviewError)throw overviewError
   const result=overview as Workspace
   const yearClasses=(result.classes||[]).filter(item=>!activeYear?.id||item.year_id===activeYear.id)
   const classDetails=await Promise.all(yearClasses.map(async(item)=>{
    const {data,error:detailError}=await db.rpc('preschool_report_workspace',{p_class:item.id,p_period:null})
    if(detailError)throw detailError
    const detail=data as ClassDetail
    return {overview:{...item,student_count:detail.students?.length||0,staff:detail.staff||[]} satisfies PreschoolClassOverview,detail}
   }))
   const settings=classDetails.map(item=>item.detail.settings).find(Boolean)||result.settings
   const coordinator=classDetails.flatMap(item=>item.detail.staff_options||[]).find(item=>item.id===settings?.coordinator_user_id)
   setState({classes:classDetails.map(item=>item.overview),manager:canManage,coordinatorName:coordinator?.name||null,coordinatorAssigned:Boolean(settings?.coordinator_user_id)})
  }catch{
   setState(blank);setError(translate('Unable to load the Preschool workspace. Check your school access and try again.',locale))
  }finally{setLoading(false)}
 },[activeYear?.id,canManage,db,locale])
 useEffect(()=>{void load()},[load])
 const levels=useMemo(()=>summarizePreschoolLevels(state.classes),[state.classes])
 const staff=useMemo(()=>uniquePreschoolStaff(state.classes),[state.classes])
 const studentCount=state.classes.reduce((total,item)=>total+item.student_count,0)
 const activeLevels=levels.filter(level=>level.classCount>0).length
 const teachingCount=staff.filter(item=>item.role==='titulaire'||item.role==='aide_educatrice').length
 const coordinatorText=state.coordinatorName|| (state.coordinatorAssigned?t('Coordinator assigned'):t('Not assigned'))

 return <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
  <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
   <div><p className="text-sm font-semibold text-blue-700"><T text="Preschool / Kindergarten"/></p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950"><T text="Kindergarten workspace"/></h1><p className="mt-2 max-w-2xl text-slate-600"><T text="A clear, caring place for the first steps of every child."/></p></div>
   {canSelect&&years.length>0&&<label className="text-sm font-medium text-slate-700"><T text="Academic year"/><span className="mt-1 flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><CalendarDays size={17} className="text-blue-700"/><select aria-label={t('Academic year')} value={activeYear?.id||''} onChange={event=>setYearId(event.target.value)} className="min-w-0 bg-transparent py-2 outline-none">{years.map(item=><option key={item.id} value={item.id}>{item.name}{item.is_current?` · ${t('Current')}`:''}</option>)}</select></span></label>}
  </header>

  <nav aria-label={t('Preschool sections')} className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
   <a href="#preschool-overview" className="shrink-0 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800"><T text="Overview"/></a>
   <a href="#preschool-levels" className="shrink-0 rounded-xl px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"><T text="Levels PS1–PS3"/></a>
   <a href="#preschool-classes" className="shrink-0 rounded-xl px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"><T text="Classes"/></a>
   <Link href="/dashboard/preschool" className="shrink-0 rounded-xl px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"><T text="Academic program"/></Link>
   <a href="#preschool-team" className="shrink-0 rounded-xl px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"><T text="Teaching team"/></a>
   {state.manager&&<Link href="/dashboard/settings" className="shrink-0 rounded-xl px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"><T text="Settings"/></Link>}
  </nav>

  <section id="preschool-overview" className="grid gap-5 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-amber-50 p-5 md:grid-cols-[1.4fr_.9fr] md:p-7">
   <div className="self-center"><h2 className="max-w-xl text-2xl font-bold leading-tight text-slate-950 md:text-3xl"><T text="A safe, caring environment for every first step."/></h2><p className="mt-2 max-w-2xl text-slate-600"><T text="Organize the PS1–PS3 team, classroom groups, learning observations and safe student pickup from one workspace."/></p>
    <div className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">{['Developmental tracking for PS1 to PS3','Attendance and secure pickup','Teaching team and classroom assignments','Family access to school updates'].map(item=><p key={item} className="flex items-start gap-2"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600"/><T text={item}/></p>)}</div>
   </div>
   <div className="flex flex-col justify-center gap-3 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm md:p-5"><p className="text-sm font-semibold text-slate-700"><T text="Quick actions"/></p>
    <Link href="/dashboard/preschool" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"><BookOpen size={17}/><T text="Open competency reports"/></Link>
    <Link href="/dashboard/attendance" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"><ClipboardCheck size={17}/><T text="Attendance"/></Link>
    {state.manager&&<Link href="/dashboard/attendance/kindergarten-pickup" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"><Baby size={17}/><T text="Kindergarten pickup"/></Link>}
   </div>
  </section>

  {error&&<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={()=>void load()} className="rounded-lg border border-red-300 bg-white px-3 py-2 font-semibold"><T text="Try again"/></button></div>}
  <section aria-label={t('Preschool overview metrics')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <Metric icon={Users} label="Enrolled students" value={loading?'—':studentCount} tone="blue"/>
   <Metric icon={BookOpen} label="Active classes" value={loading?'—':state.classes.length} tone="green"/>
   <Metric icon={Layers3} label="Active levels" value={loading?'—':activeLevels} tone="violet"/>
   <Metric icon={GraduationCap} label="Teaching team" value={loading?'—':teachingCount} tone="amber"/>
  </section>

  <section id="preschool-levels" className="scroll-mt-24">
   <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-950"><T text="Preschool levels"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Review the classes and assigned team for each level."/></p></div>{state.manager&&<Link href="/dashboard/classes" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"><BookOpen size={16}/><T text="Manage classes"/></Link>}</div>
   {loading?<div className="grid gap-3 md:grid-cols-3"><div className="h-48 animate-pulse rounded-2xl bg-slate-200"/><div className="h-48 animate-pulse rounded-2xl bg-slate-200"/><div className="h-48 animate-pulse rounded-2xl bg-slate-200"/></div>:<div className="grid gap-3 md:grid-cols-3">{levels.map((level,index)=>{
    const accent=[['bg-rose-50','text-rose-700'],['bg-violet-50','text-violet-700'],['bg-amber-50','text-amber-800']][index]
    return <article key={level.code} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className={`grid h-12 w-12 place-items-center rounded-2xl text-sm font-bold ${accent[0]} ${accent[1]}`}>{level.code}</span><div><h3 className="font-bold text-slate-950"><T text={level.name}/></h3><p className="text-sm text-slate-500">{level.age}</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${level.classCount?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-600'}`}><T text={level.classCount?'Active':'Not configured'}/></span></div>
     <div className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-100 py-3 text-center"><Count label="Classes" value={level.classCount}/><Count label="Students" value={level.studentCount}/><Count label="Teachers & aides" value={level.teacherCount+level.assistantCount}/></div>
     <ul className="mt-3 space-y-2">{level.classes.map(item=><li key={item.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"><div className="flex min-w-0 items-center gap-2"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${accent[0]} ${accent[1]}`}><Baby size={16}/></span><span className="truncate text-sm font-semibold text-slate-800">{item.name}</span></div><span className="shrink-0 text-xs text-slate-500">{item.student_count} <T text="students"/></span></li>)}</ul>
     {!level.classes.length&&<p className="mt-3 rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500"><T text="No classes are configured for this level and year."/></p>}
    </article>
   })}</div>}
  </section>

  <section id="preschool-classes" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-950"><T text="Classes"/></h2><p className="mt-1 text-sm text-slate-600">{activeYear?.name||<T text="Current school year"/>} · {loading?'—':state.classes.length} <T text="active classes"/></p></div><Link href="/dashboard/preschool" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"><T text="Choose class for reports"/></Link></div>
   {loading?<p className="mt-4 text-sm text-slate-500"><T text="Loading..."/></p>:state.classes.length===0?<p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"><T text="No preschool classes are available for this academic year."/> {state.manager&&<Link href="/dashboard/classes" className="font-semibold text-blue-700 underline underline-offset-2"><T text="Manage classes"/></Link>}</p>:<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-3 pr-4 font-semibold"><T text="Class"/></th><th className="py-3 pr-4 font-semibold"><T text="Level"/></th><th className="py-3 pr-4 font-semibold"><T text="Students"/></th><th className="py-3 pr-4 font-semibold"><T text="Classroom team"/></th><th className="py-3 font-semibold"><T text="Academic year"/></th></tr></thead><tbody className="divide-y divide-slate-100">{state.classes.map(item=><tr key={item.id} className="align-top"><td className="py-3 pr-4 font-semibold text-slate-900">{item.name}</td><td className="py-3 pr-4">{item.grade}</td><td className="py-3 pr-4 tabular-nums">{item.student_count}</td><td className="py-3 pr-4"><div className="flex flex-wrap gap-1.5">{item.staff.length?item.staff.map(person=><span key={person.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2 text-xs text-slate-700" title={person.role==='titulaire'?t('Classroom lead teacher'):t('Teaching assistant')}><span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[10px] font-bold text-blue-800">{initials(person.name)}</span>{person.name}</span>):<span className="text-slate-500"><T text="Team not assigned"/></span>}</div></td><td className="py-3 text-slate-600">{item.year}</td></tr>)}</tbody></table></div>}
  </section>

  <section id="preschool-team" className="scroll-mt-24 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
   <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-950"><T text="Teaching team"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Teachers and teaching assistants assigned to Preschool classes."/></p></div><Link href="/dashboard/preschool" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"><T text={state.manager?'Manage assignments':'Open competency reports'}/></Link></div>
    {loading?<p className="mt-4 text-sm text-slate-500"><T text="Loading..."/></p>:!staff.length?<p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><T text="No teaching team members are assigned to the available classes yet."/></p>:<div className="mt-4 grid gap-2 sm:grid-cols-2">{staff.map(person=><div key={person.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-800">{initials(person.name)}</span><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{person.name}</p><p className="text-xs text-slate-600"><T text={person.role==='titulaire'?'Classroom lead teacher':'Teaching assistant'}/></p></div></div>)}</div>}
   </article>
   <div className="grid gap-4">
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><GraduationCap size={19}/></span><div><h3 className="font-bold text-slate-950"><T text="Academic coordinator"/></h3><p className="text-sm text-slate-600">{loading?'—':coordinatorText}</p></div></div><Link href="/dashboard/preschool" className="mt-3 inline-block text-sm font-semibold text-blue-700 underline underline-offset-2"><T text={state.manager?'Review coordinator assignment':'Open competency reports'}/></Link></article>
    <article className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-amber-800"><Users size={18}/></span><div><h3 className="font-bold text-slate-950"><T text="Cleaning staff"/></h3><span className="text-xs font-semibold text-amber-900"><T text="Role not configured"/></span></div></div><p className="mt-2 text-sm leading-relaxed text-slate-700"><T text="AtechOS does not currently define a cleaning-staff assignment or access role. No account or access has been created."/></p></article>
   </div>
  </section>

  <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   <Shortcut href="/dashboard/attendance" icon={ClipboardCheck} title="Attendance" text="Review student attendance."/>
   {state.manager&&<Shortcut href="/dashboard/attendance/kindergarten-pickup" icon={Baby} title="Kindergarten pickup" text="Manage authorized student pickup."/>}
   <Shortcut href="/dashboard/calendar" icon={CalendarDays} title="School calendar" text="Review exams and school dates."/>
   <Shortcut href="/dashboard/preschool" icon={BookOpen} title="Academic program" text="Review observations and bulletins."/>
  </section>
 </main>
}

function Metric({icon:Icon,label,value,tone}:{icon:typeof Users;label:string;value:string|number;tone:'blue'|'green'|'violet'|'amber'}){
 const tones={blue:'bg-blue-50 text-blue-700',green:'bg-emerald-50 text-emerald-700',violet:'bg-violet-50 text-violet-700',amber:'bg-amber-50 text-amber-800'}
 return <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}><Icon size={21}/></span><div><p className="text-sm text-slate-600"><T text={label}/></p><p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-950">{value}</p></div></article>
}
function Count({label,value}:{label:string;value:number}){return <div><p className="text-lg font-bold tabular-nums text-slate-950">{value}</p><p className="text-[11px] leading-tight text-slate-500"><T text={label}/></p></div>}
function Shortcut({href,icon:Icon,title,text}:{href:string;icon:typeof Users;title:string;text:string}){return <Link href={href} className="group flex min-h-24 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 transition-colors group-hover:bg-white"><Icon size={19}/></span><span><strong className="block text-sm text-slate-900"><T text={title}/></strong><span className="mt-1 block text-xs leading-relaxed text-slate-600"><T text={text}/></span></span></Link>}
