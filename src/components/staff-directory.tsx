'use client'

import { useMemo, useState } from 'react'
import { Search, UsersRound } from 'lucide-react'
import { T } from '@/components/translation-provider'
import { MemberAction } from '@/app/dashboard/staff/invite-form'

export type StaffDirectoryAccess = {
  id: string
  role: string
  enabled: boolean
  protectedMember: boolean
  schoolOwner: boolean
}

export type StaffDirectoryPerson = {
  id: string
  name: string
  email: string
  access: StaffDirectoryAccess[]
}

const roleLabels: Record<string, string> = {
  owner: 'School owner',
  school_admin: 'School administrator',
  director: 'Director',
  censeur: 'Academic reviewer',
  secretary: 'Secretary',
  surveillant: 'Supervisor',
  teacher: 'Teacher',
  accountant: 'Accountant',
  parent: 'Parent',
  student: 'Student',
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toLocaleUpperCase()
}

export function StaffDirectory({ people }: { people: StaffDirectoryPerson[] }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return people
    return people.filter(person => `${person.name} ${person.email} ${person.access.map(item => item.role).join(' ')}`.toLocaleLowerCase().includes(normalized))
  }, [people, query])

  return <section className="staff-panel space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-slate-950"><T text="Staff directory"/></h2>
        <p className="mt-1 text-sm text-slate-600"><T text="Search people and review each school access."/></p>
      </div>
      <label className="relative block w-full sm:max-w-sm">
        <span className="sr-only"><T text="Search staff"/></span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"/>
        <input value={query} onChange={event => setQuery(event.target.value)} type="search" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-100"/>
      </label>
    </div>

    <p className="text-sm text-slate-600" aria-live="polite">{filtered.length} <T text={filtered.length === 1 ? 'person' : 'people'}/></p>

    {filtered.length ? <ul className="divide-y divide-slate-100">
      {filtered.map(person => <li key={person.id} className="py-4 first:pt-0 last:pb-0">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-800">{initials(person.name)}</span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-950">{person.name}</h3>
            <p className="truncate text-sm text-slate-600">{person.email || <T text="No email address"/>}</p>
          </div>
        </div>
        <ul className="mt-3 divide-y divide-slate-100 sm:ml-14">
          {person.access.map(access => <li key={access.id} className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-800"><T text={roleLabels[access.role] || access.role}/></span>
              <span className={access.enabled ? 'inline-flex min-h-7 items-center rounded-full bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800' : 'inline-flex min-h-7 items-center rounded-full bg-slate-100 px-2.5 text-xs font-semibold text-slate-700'}><T text={access.enabled ? 'Active' : 'Disabled'}/></span>
            </div>
            {access.protectedMember ? <span className="inline-flex min-h-10 items-center rounded-lg bg-slate-50 px-3 text-sm font-medium text-slate-600"><T text={access.role === 'owner' ? 'School owner' : 'Protected'}/></span> : <MemberAction id={access.id} enabled={access.enabled} role={access.role} owner={access.schoolOwner} compact/>}
          </li>)}
        </ul>
      </li>)}
    </ul> : <div className="rounded-xl bg-slate-50 px-4 py-8 text-center">
      <UsersRound aria-hidden="true" className="mx-auto size-7 text-slate-500"/>
      <p className="mt-2 text-sm text-slate-700"><T text={people.length ? 'No people match this search.' : 'No staff access has been added yet.'}/></p>
    </div>}
  </section>
}

