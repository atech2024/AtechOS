'use client'

import { useMemo, useState } from 'react'
import { BriefcaseBusiness, Clock3, GraduationCap, HeartHandshake, Search, UsersRound } from 'lucide-react'
import { T, useLocale } from '@/components/translation-provider'
import { MemberAction } from '@/app/dashboard/staff/invite-form'
import type { Locale } from '@/lib/i18n'
import { getDirectorySections, type StaffDirectorySection } from '@/lib/staff-directory-sections'

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
const sectionConfig: { key: StaffDirectorySection; label: string; description: string; Icon: typeof UsersRound }[] = [
  { key: 'staff', label: 'Staff', description: 'School administrators and operational staff.', Icon: BriefcaseBusiness },
  { key: 'teachers', label: 'Teachers', description: 'Teaching staff and their school access.', Icon: GraduationCap },
  { key: 'parents', label: 'Parents', description: 'Parents and guardians linked to the school.', Icon: HeartHandshake },
  { key: 'students', label: 'Students', description: 'Student accounts already managed here.', Icon: UsersRound },
]

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toLocaleUpperCase()
}

function formatAcceptanceDate(value: string | null, locale: Locale) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const language = locale === 'fr' ? 'fr-HT' : locale === 'ht' ? 'ht-HT' : 'en-US'
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'America/Port-au-Prince' }).format(date)
}

export function InvitationAccepted({ acceptedAt }: { acceptedAt: string | null }) {
  const locale = useLocale()
  const date = formatAcceptanceDate(acceptedAt, locale)
  return <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-sm font-medium text-emerald-800">
    <span className="grid size-5 place-items-center rounded-full bg-emerald-100"><span aria-hidden="true" className="text-xs">✓</span></span>
    <T text="Invitation accepted"/>
    {date && <><span aria-hidden="true">·</span><time dateTime={acceptedAt || undefined}>{date}</time></>}
  </p>
}

export function InvitationPending({ expiresAt }: { expiresAt: string }) {
  const locale = useLocale()
  const date = formatAcceptanceDate(expiresAt, locale)
  return <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
    <Clock3 aria-hidden="true" className="size-4 text-amber-700"/>
    <T text="Awaiting acceptance"/>
    {date && <><span aria-hidden="true">·</span><T text="Expires"/> <time dateTime={expiresAt}>{date}</time></>}
  </p>
}

export function StaffDirectory({ people }: { people: StaffDirectoryPerson[] }) {
  const [query, setQuery] = useState('')
  const [selectedSection, setSelectedSection] = useState<StaffDirectorySection>('staff')
  const locale = useLocale()
  const sectionPeople = useMemo(() => people.filter(person => getDirectorySections(person.access).includes(selectedSection)), [people, selectedSection])
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return sectionPeople
    return sectionPeople.filter(person => `${person.name} ${person.email} ${person.access.map(item => item.role).join(' ')}`.toLocaleLowerCase().includes(normalized))
  }, [sectionPeople, query])
  const selected = sectionConfig.find(section => section.key === selectedSection)!

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

    <div role="group" aria-label={locale === 'fr' ? 'Sections du répertoire' : locale === 'ht' ? 'Seksyon lis la' : 'Directory sections'} className="grid grid-cols-2 gap-2 border-b border-slate-200 pb-4 sm:grid-cols-4">
      {sectionConfig.map(({ key, label, Icon }) => {
        const count = people.filter(person => getDirectorySections(person.access).includes(key)).length
        const active = selectedSection === key
        return <button key={key} type="button" aria-pressed={active} onClick={() => setSelectedSection(key)} className={active ? 'inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-left text-sm font-semibold text-blue-950 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700' : 'inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700'}>
          <span className="inline-flex min-w-0 items-center gap-2"><Icon aria-hidden="true" className="size-4 shrink-0"/><span className="truncate"><T text={label}/></span></span>
          <span className="tabular-nums text-xs">{count}</span>
        </button>
      })}
    </div>

    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
      <div>
        <h3 className="font-semibold text-slate-950"><T text={selected.label}/></h3>
        <p className="text-sm text-slate-600"><T text={selected.description}/></p>
      </div>
      <p className="text-sm text-slate-600" aria-live="polite">{filtered.length} <T text={filtered.length === 1 ? 'person' : 'people'}/></p>
    </div>

    {filtered.length ? <ul className="divide-y divide-slate-100">
      {filtered.map(person => <li key={person.id} className="py-4 first:pt-0 last:pb-0">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-800">{initials(person.name)}</span>
          <div className="min-w-0">
            <h4 className="truncate font-semibold text-slate-950">{person.name}</h4>
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
      <p className="mt-2 text-sm text-slate-700"><T text={sectionPeople.length ? 'No people match this search.' : 'No people in this section yet.'}/></p>
    </div>}
  </section>
}
