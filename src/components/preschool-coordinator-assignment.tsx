'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, UserRoundCog } from 'lucide-react'
import { T } from '@/components/translation-provider'
import { createClient } from '@/lib/supabase/client'

type CoordinatorOption = { id: string; name: string }

export function PreschoolCoordinatorAssignment({
  options,
  initialCoordinatorId,
  initialCoordinatorName,
}: {
  options: CoordinatorOption[]
  initialCoordinatorId: string | null
  initialCoordinatorName: string | null
}) {
  const [selected, setSelected] = useState(initialCoordinatorId || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setSelected(initialCoordinatorId || '')
    setSaved(false)
  }, [initialCoordinatorId])

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
      setError('Unable to update the Preschool coordinator. Refresh and try again.')
    } finally {
      setBusy(false)
    }
  }

  const missingCurrent = Boolean(initialCoordinatorId && !options.some(option => option.id === initialCoordinatorId))
  const disabled = busy || selected === (initialCoordinatorId || '')

  return <section aria-labelledby="preschool-coordinator-heading" data-testid="preschool-coordinator-assignment" className="grid gap-3 rounded-xl border-2 border-violet-200 bg-violet-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-4">
    <div className="space-y-2">
      <div>
        <h3 id="preschool-coordinator-heading" className="flex items-center gap-2 text-base font-semibold text-violet-950">
          <UserRoundCog aria-hidden="true" className="size-5"/>
          <T text="Preschool coordinator"/>
        </h3>
        <p className="mt-1 text-sm text-slate-700">{initialCoordinatorId ? <><T text="Assigned staff member"/>: <strong>{initialCoordinatorName || <T text="Assigned staff member"/>}</strong></> : <T text="No coordinator assigned"/>}</p>
      </div>
      <label className="block text-sm font-medium text-slate-800"><T text="Choose a coordinator"/>
        <select value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setSaved(false) }} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
          <option value=""><T text="No coordinator assigned"/></option>
          {missingCurrent && <option value={initialCoordinatorId || ''}>{initialCoordinatorName || <T text="Assigned staff member"/>}</option>}
          {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>
      {missingCurrent && <p role="status" className="text-xs text-amber-900"><T text="The current coordinator is no longer an active team member. Choose an active staff member to replace them."/></p>}
      {!options.length && !initialCoordinatorId && <p className="text-xs text-slate-600"><T text="Add or activate a teacher or staff member first."/></p>}
      {error && <p role="alert" className="text-sm text-red-700"><T text={error}/></p>}
      {saved && <p role="status" className="text-sm text-emerald-700"><T text="Preschool coordinator updated."/></p>}
    </div>
    <button type="button" disabled={disabled} onClick={() => void save()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
      <Save aria-hidden="true" className="size-4"/><T text={busy ? 'Saving...' : 'Save coordinator'}/>
    </button>
  </section>
}
