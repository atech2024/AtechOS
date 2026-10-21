'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, UserRoundCog } from 'lucide-react'
import { T } from '@/components/translation-provider'
import { createClient } from '@/lib/supabase/client'

type StaffOption = { id: string; name: string }

export function PreschoolCoordinatorAssignment({
  options,
  initialCoordinatorId,
  initialCoordinatorName,
}: {
  options: StaffOption[]
  initialCoordinatorId: string | null
  initialCoordinatorName: string | null
}) {
  const [selected, setSelected] = useState(initialCoordinatorId || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  async function save() {
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const { error: rpcError } = await createClient().rpc('save_preschool_coordinator', {
        p_coordinator: selected || null,
      })
      if (rpcError) throw rpcError
      setSaved(true)
      router.refresh()
    } catch {
      setError('Unable to assign the Preschool coordinator. Refresh and try again.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><UserRoundCog size={19} aria-hidden="true"/></span>
      <div>
        <h2 className="text-xl font-semibold text-slate-950"><T text="Preschool coordinator"/></h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600"><T text="Choose the active staff member responsible for the Preschool / Kindergarten space. This assignment grants access to that space only."/></p>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <label className="block text-sm font-medium text-slate-800"><T text="Coordinator"/>
        <select value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setSaved(false) }} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
          <option value=""><T text="No coordinator assigned"/></option>
          {initialCoordinatorId && !options.some(option => option.id === initialCoordinatorId) && <option value={initialCoordinatorId}>{initialCoordinatorName || 'Previously assigned staff member'}</option>}
          {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>
      <button type="button" disabled={busy || selected === (initialCoordinatorId || '')} onClick={() => void save()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
        <Save size={17} aria-hidden="true"/><T text={busy ? 'Saving...' : 'Save coordinator'}/>
      </button>
    </div>
    {!options.length && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><T text="Add or activate a teacher or staff member first."/></p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><T text={error}/></p>}
    {saved && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><T text="Preschool coordinator updated."/></p>}
  </section>
}
