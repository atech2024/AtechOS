'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { periodPresets, schoolSections } from '@/lib/school-catalog'
type Year = { id: string; name: string; is_current: boolean }
type Period = { id: string; name: string; code: string; academic_year_id: string | null; sections: string[]; is_active: boolean; start_date: string; end_date: string }
export default function GradingPeriodsPage() {
 const [years,setYears]=useState<Year[]>([]),[periods,setPeriods]=useState<Period[]>([])
 const [year,setYear]=useState(''),[preset,setPreset]=useState('T1'),[sections,setSections]=useState<string[]>(['primary'])
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function load() {
  const db=createClient()
  const [y,p]=await Promise.all([db.from('academic_years').select('id,name,is_current').order('start_date',{ascending:false}),db.from('grading_periods').select('id,name,code,academic_year_id,sections,is_active,start_date,end_date').order('start_date')])
  if(y.error || p.error) setError((y.error || p.error)!.message)
  setYears(y.data || []);setPeriods(p.data || []);setYear(v=>v || y.data?.find(x=>x.is_current)?.id || y.data?.[0]?.id || '')
 }
 useEffect(()=>{load()},[])
 async function save(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();setBusy(true);setError('');setMessage('')
  const form=new FormData(event.currentTarget),choice=periodPresets.find(x=>x[0]===preset)
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
 return <main className="mx-auto max-w-5xl p-6"><h1 className="text-3xl font-bold">Grading periods</h1><p className="my-3">Choose the calendar and sections that use each period. Your school sets the dates.</p>{error && <p role="alert" className="my-3 text-red-700">{error}</p>}{message && <p role="status">{message}</p>}<form onSubmit={save} className="my-6 grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2"><label>Academic year<select required value={year} onChange={e=>setYear(e.target.value)} className="block w-full rounded border p-3"><option value="">Select year</option>{years.map(y=><option key={y.id} value={y.id}>{y.name}</option>)}</select></label><label>Period<select value={preset} onChange={e=>setPreset(e.target.value)} className="block w-full rounded border p-3">{periodPresets.map(([code,name])=><option key={code} value={code}>{name}</option>)}<option value="custom">Other - add a period</option></select></label>{preset==='custom' && <><label>Name<input name="name" required className="block w-full rounded border p-3" /></label><label>Code<input name="code" required className="block w-full rounded border p-3" /></label></>}<label>Start date<input name="start" type="date" required className="block w-full rounded border p-3" /></label><label>End date<input name="end" type="date" required className="block w-full rounded border p-3" /></label><fieldset className="md:col-span-2"><legend>Sections using this period</legend><div className="my-3 flex flex-wrap gap-4">{schoolSections.map(s=><label key={s.code}><input type="checkbox" checked={sections.includes(s.code)} onChange={e=>setSections(v=>e.target.checked?[...v,s.code]:v.filter(x=>x!==s.code))} /> {s.name}</label>)}</div></fieldset><button disabled={busy || !year || !sections.length} className="rounded bg-blue-600 p-3 text-white disabled:opacity-50">{busy?'Saving...':'Activate period'}</button></form><p className="text-sm text-slate-600">To change dates or sections, select the same period and year above and save again.</p><div className="my-5 space-y-3">{periods.filter(p=>!year || !p.academic_year_id || p.academic_year_id===year).map(p=><article key={p.id} className="rounded-xl border bg-white p-4"><h2 className="font-semibold">{p.name} - {p.is_active?'Active':'Inactive'}</h2><p>{p.start_date} / {p.end_date}</p><p>{p.sections.map(code=>schoolSections.find(s=>s.code===code)?.name).join(', ')}</p>{!p.academic_year_id && <p className="text-sm">Legacy period - no specific academic year.</p>}<button disabled={busy || !year} onClick={()=>toggle(p)} className="mt-2 rounded border p-2">{p.is_active?'Deactivate':'Activate'}</button></article>)}</div></main>
}
