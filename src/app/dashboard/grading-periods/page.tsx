'use client'
import { T } from '@/components/translation-provider'
import { schoolDate } from '@/lib/school-date'
import SchoolDateInput from '@/components/school-date-input'
import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import {useAcademicYear} from '@/components/academic-year-context'
import { periodPresets, schoolSections } from '@/lib/school-catalog'
type Year = { id: string; name: string; is_current: boolean; term_count: 3 | 4; start_date: string; end_date: string }
type Period = { id: string; name: string; code: string; academic_year_id: string | null; sections: string[]; is_active: boolean; start_date: string; end_date: string }
const termLabels:Record<string,string>={T1:'1st trimester',T2:'2nd trimester',T3:'3rd trimester',T4:'4th trimester'}
export default function GradingPeriodsPage() {
 const academicYear=useAcademicYear()
 const [years,setYears]=useState<Year[]>([]),[periods,setPeriods]=useState<Period[]>([])
 const [year,setYear]=useState(''),[preset,setPreset]=useState('T1'),[sections,setSections]=useState<string[]>(['primary']),[termCount,setTermCount]=useState<3|4>(3)
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function load() {
  const db=createClient()
  const [y,p]=await Promise.all([db.from('academic_years').select('id,name,is_current,term_count,start_date,end_date').order('start_date',{ascending:false}),db.from('grading_periods').select('id,name,code,academic_year_id,sections,is_active,start_date,end_date').order('start_date')])
  if(y.error || p.error) setError((y.error || p.error)!.message)
  setYears(y.data || []);setPeriods(p.data || []);setYear(v=>v || academicYear.yearId || y.data?.find(x=>x.is_current)?.id || y.data?.[0]?.id || '')
 }
 useEffect(()=>{load()},[])
 useEffect(()=>{if(academicYear.yearId&&academicYear.yearId!==year)setYear(academicYear.yearId)},[academicYear.yearId])
 const selectedYear=years.find(y=>y.id===year)
 useEffect(()=>{setTermCount(selectedYear?.term_count===4?4:3);if(selectedYear?.term_count!==4&&preset==='T4')setPreset('T1')},[year,selectedYear?.term_count])
 async function saveTermCount(){if(!year)return;setBusy(true);setError('');setMessage('');try{const result=await createClient().rpc('set_academic_year_term_count',{p_year:year,p_term_count:termCount});if(result.error)setError(result.error.message);else{setMessage('Academic-year term count saved.');await load()}}finally{setBusy(false)}}
 async function save(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();setBusy(true);setError('');setMessage('')
  const form=new FormData(event.currentTarget),choice=periodPresets.find(x=>x[0]===preset && (x[0]!=='T4'||termCount===4))
  try {
   const result=await createClient().rpc('activate_grading_period',{p_year:year,p_name:choice?.[1] || String(form.get('name')),p_code:choice?.[0] || String(form.get('code')),p_start:String(form.get('start')),p_end:String(form.get('end')),p_sections:sections})
   if(result.error)setError(result.error.message);else {setMessage('Period activated.');await load()}
  } finally {setBusy(false)}
 }
 async function toggle(period:Period) {
  setBusy(true);setError('')
  try {
   const result=await createClient().rpc('configure_grading_period',{p_id:period.id,p_year:period.academic_year_id || year,p_sections:period.sections,p_active:!period.is_active})
   if(result.error)setError(result.error.message);else await load()
  } finally {setBusy(false)}
 }
 return <main className="mx-auto max-w-5xl p-6"><h1 className="text-3xl font-bold"><T text="Grading periods"/></h1><p className="my-3"><T text="Choose the calendar and sections that use each period. Your school sets the dates."/></p>{error && <p role="alert" className="my-3 text-red-700">{error}</p>}{message && <p role="status"><T text={message}/></p>}<form onSubmit={save} className="my-6 grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2"><label><T text="Academic year"/><select required value={year} onChange={e=>{setYear(e.target.value);academicYear.setYearId(e.target.value)}} className="block w-full rounded border p-3"><option value=""><T text="Select year"/></option>{years.map(y=><option key={y.id} value={y.id}>{y.name}</option>)}</select></label><label><T text="Official terms this year"/><div className="flex gap-2"><select value={termCount} onChange={e=>setTermCount(Number(e.target.value) as 3|4)} className="block w-full rounded border p-3"><option value={3}><T text="3 trimesters"/></option><option value={4}><T text="4 trimesters"/></option></select><button type="button" disabled={busy||!year||termCount===selectedYear?.term_count} onClick={saveTermCount} className="rounded border px-3"><T text="Save"/></button></div></label><label><T text="Official term"/><select value={preset} onChange={e=>setPreset(e.target.value)} className="block w-full rounded border p-3">{periodPresets.filter(([code])=>code!=='T4'||termCount===4).map(([code,name])=><option key={code} value={code}><T text={termLabels[code]||name}/></option>)}<option value="custom"><T text="Other - add a period"/></option></select></label>{preset==='custom' && <><label><T text="Name"/><input name="name" required className="block w-full rounded border p-3" /></label><label><T text="Code"/><input name="code" required className="block w-full rounded border p-3" /></label></>}<label><T text="Start date"/><SchoolDateInput name="start" required min={selectedYear?.start_date} max={selectedYear?.end_date} className="block w-full rounded border p-3" /></label><label><T text="End date"/><SchoolDateInput name="end" required min={selectedYear?.start_date} max={selectedYear?.end_date} className="block w-full rounded border p-3" /></label><fieldset className="md:col-span-2"><legend><T text="Sections using this period"/></legend><div className="my-3 flex flex-wrap gap-4">{schoolSections.map(s=><label key={s.code}><input type="checkbox" checked={sections.includes(s.code)} onChange={e=>setSections(v=>e.target.checked?[...v,s.code]:v.filter(x=>x!==s.code))} /> <T text={s.name}/></label>)}</div></fieldset><button disabled={busy || !year || !sections.length} className="rounded bg-blue-600 p-3 text-white disabled:opacity-50"><T text={busy?'Saving...':'Activate period'}/></button></form><p className="text-sm text-slate-600"><T text="To change dates or sections, select the same period and year above and save again."/></p><div className="my-5 space-y-3">{periods.filter(p=>!year || !p.academic_year_id || p.academic_year_id===year).map(p=><article key={p.id} className="rounded-xl border bg-white p-4"><h2 className="font-semibold"><T text={termLabels[p.code]||p.name}/> - {p.is_active?<T text="Active"/>:<T text="Inactive"/>}{['C1','C2','C3','C4'].includes(p.code)&&<> · <T text="Historical control retained"/></>}</h2><p>{schoolDate(p.start_date)} / {schoolDate(p.end_date)}</p><p>{p.sections.map(code=>schoolSections.find(s=>s.code===code)?.name).join(', ')}</p>{!p.academic_year_id && <p className="text-sm"><T text="Legacy period - no specific academic year."/></p>}<button disabled={busy || !year || ['C1','C2','C3','C4'].includes(p.code)} onClick={()=>toggle(p)} className="mt-2 rounded border p-2">{p.is_active?'Deactivate':'Activate'}</button></article>)}</div></main>
}
