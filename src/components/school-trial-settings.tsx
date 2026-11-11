'use client'

import { useState, type FormEvent } from 'react'
import { T, useLocale } from '@/components/translation-provider'
import { schoolPlanIds, type SchoolPlanId } from '@/lib/subscription-pricing'
import { schoolDateTime } from '@/lib/school-date'
import { createClient } from '@/lib/supabase/client'

type Trial = { plan: SchoolPlanId; ends_at: string; active: boolean }
const labels: Record<SchoolPlanId, string> = {
 attendance: 'Attendance plan',
 school: 'School plan',
 school_finance: 'School + Finance plan',
}

export default function SchoolTrialSettings({ initialTrial }: { initialTrial: Trial | null }) {
 const locale = useLocale()
 const [trial, setTrial] = useState(initialTrial)
 const [plan, setPlan] = useState<SchoolPlanId>(initialTrial?.plan ?? 'attendance')
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [saved, setSaved] = useState(false)
 const expired = trial?.active === false

 async function save(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  if (busy || expired) return
  setBusy(true)
  setError('')
  setSaved(false)
  try {
   const { data, error: failure } = await createClient().rpc('choose_school_trial_plan', { p_plan: plan })
   if (failure?.message === 'school_trial_expired' && trial) {
    setTrial({ ...trial, active: false })
    return
   }
   if (failure || !data?.ends_at) throw new Error('trial_save_failed')
   setTrial({ plan: data.plan, ends_at: data.ends_at, active: true })
   setSaved(true)
  } catch {
   setError('Unable to complete the request. Please try again.')
  } finally {
   setBusy(false)
  }
 }

 return <section aria-labelledby="school-trial-title" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
  <div>
   <h2 id="school-trial-title" className="text-xl font-semibold text-slate-950"><T text="30-day school trial"/></h2>
   <p className="mt-1 text-sm text-slate-600"><T text="Trial preview. Plan selection does not yet change module access."/></p>
  </div>
  {trial && <p className="text-sm"><T text="Trial ends"/> · <time dateTime={trial.ends_at}>{schoolDateTime(trial.ends_at, locale)}</time></p>}
  {expired ? <p role="status"><T text="This school's trial has ended."/></p> : <form onSubmit={save} className="flex flex-wrap items-end gap-3">
   <label className="grid gap-1 text-sm font-medium">
    <T text="Trial plan"/>
    <select value={plan} onChange={event => { setPlan(event.target.value as SchoolPlanId); setSaved(false) }} disabled={busy} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3">
     {schoolPlanIds.map(id => <option key={id} value={id}><T text={labels[id]}/></option>)}
    </select>
   </label>
   <button disabled={busy || trial?.plan === plan} className="min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:opacity-60">
    <T text={busy ? 'Loading...' : trial ? 'Change trial plan' : 'Start trial'}/>
   </button>
  </form>}
  {error && <p role="alert" className="text-sm text-red-800"><T text={error}/></p>}
  {saved && <p role="status" className="text-sm text-emerald-800"><T text="Trial plan saved."/></p>}
 </section>
}
