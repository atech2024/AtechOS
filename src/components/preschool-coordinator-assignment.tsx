'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserRoundCog } from 'lucide-react'
import { T } from '@/components/translation-provider'
import { createClient } from '@/lib/supabase/client'

export function PreschoolCoordinatorAssignment({
  userId,
  assigned,
}: {
  userId: string
  assigned: boolean
}) {
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
        p_coordinator: assigned ? null : userId,
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

  return <div className="space-y-2">
    <button type="button" disabled={busy} onClick={() => void save()} className={assigned ? 'inline-flex min-h-10 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900 transition hover:bg-violet-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-wait disabled:opacity-60' : 'inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-wait disabled:opacity-60'}>
      <UserRoundCog aria-hidden="true" className="size-4"/>
      <T text={busy ? 'Saving...' : assigned ? 'Remove Preschool coordinator role' : 'Assign as Preschool coordinator'}/>
    </button>
    {error && <p role="alert" className="text-sm text-red-700"><T text={error}/></p>}
    {saved && <p role="status" className="text-sm text-emerald-700"><T text="Preschool coordinator updated."/></p>}
  </div>
}
