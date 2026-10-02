'use client'
import {useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {schoolDate} from '@/lib/school-date'
import SchoolDateInput from '@/components/school-date-input'
import {useAcademicYear} from '@/components/academic-year-context'

type Closure={day:string;title:string}
export default function AttendanceCalendar({canManage}:{canManage:boolean}) {
 const {year,yearId}=useAcademicYear()
 const [rows,setRows]=useState<Closure[]>([]),[day,setDay]=useState(''),[title,setTitle]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function load(){if(!year){setRows([]);return}const closures=await createClient().from('school_closures').select('day,title').gte('day',year.start_date).lte('day',year.end_date).order('day');if(closures.error)setError(closures.error.message);else setRows(closures.data||[])}
 useEffect(()=>{void load()},[yearId])
 async function save(date:string,label:string){setBusy(true);setError('');try{const {error}=await createClient().rpc('save_school_closure',{p_day:date,p_title:label});if(error)setError(error.message);else {setDay('');setTitle('');await load()}}catch{setError('Connexion interrompue. Réessayez.')}finally{setBusy(false)}}
 return <details className="my-6 rounded-xl border bg-white p-5"><summary className="cursor-pointer font-semibold">Calendrier des jours de fermeture</summary><p className="my-3">À partir de 9:00 AM, heure d’Haïti, les élèves sans présence enregistrée sont marqués absents automatiquement, du lundi au vendredi et entre les dates de l’année scolaire. Une fermeture doit être validée ici par un responsable. Les jours fériés proposés ne ferment pas automatiquement l’école.</p>{error&&<p role="alert" className="text-red-700">{error}</p>}{canManage&&!year&&<p>No current academic year is configured; set one before adding a closure.</p>}{canManage&&<form className="my-4 flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void save(day,title)}}><label>Date<SchoolDateInput required disabled={!year} type="date" min={year?.start_date} max={year?.end_date} value={day} onChange={e=>setDay(e.target.value)} className="block rounded border p-2"/></label><label>Motif<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} className="block rounded border p-2"/></label><button disabled={busy||!year||!day||!title.trim()} className="rounded border p-2">Confirmer la fermeture</button></form>}<ul>{rows.map(r=><li key={r.day} className="flex flex-wrap items-center gap-3 border-t py-3"><span>{schoolDate(r.day)} · {r.title}</span>{canManage&&<button disabled={busy} className="text-blue-700 underline" onClick={()=>{if(window.confirm('Confirmer que l’école est ouverte ce jour-là ?'))void save(r.day,'')}}>Rouvrir ce jour</button>}</li>)}</ul>{!rows.length&&<p>Aucune fermeture enregistrée.</p>}<p className="mt-3 text-sm">Une fermeture ajoutée après 9:00 AM ne supprime pas les absences déjà enregistrées. Les responsables vérifient les corrections nécessaires.</p></details>
}
