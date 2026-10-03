'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import {
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Contact,
  FileText,
  Settings,
  ArrowUpRight,
  UserPlus,
  ChevronRight,
  ChevronDown,
  Home,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { permittedNavigation, type NavigationGroup, type NavigationItem } from '@/lib/navigation'
import { schoolDateTime } from '@/lib/school-date'
import { translate } from '@/lib/translations'
import { T, useLocale } from '@/components/translation-provider'
import LanguageSelector from '@/components/language-selector'
import {useAcademicYear} from '@/components/academic-year-context'

type Notice = { id: string; title: string; description: string; created_at: string; read_at: string | null; priority: string; href: string; type: string }
type SearchResult = { kind: string; label: string; href: string }
const icons: Record<string, typeof Users> = {
  dashboard: LayoutDashboard, students: GraduationCap, parents: Users, teachers: Users, classes: BookOpen,
  attendance: ClipboardCheck, badge: Contact, calendar: CalendarDays, grades: FileText,
  publication: ClipboardCheck, reports: FileText, assignments: BookOpen, progression: ArrowUpRight,
  requests: UserPlus, users: Users, settings: Settings,
}
const roleLabels: Record<string, string> = {
  school_admin: 'Administrator', director: 'Director', secretary: 'Secretary', teacher: 'Teacher',
  accountant: 'Accountant', surveillant: 'Attendance supervisor', parent: 'Parent', student: 'Student',
  censeur: 'Academic reviewer',
}
const groupLabels: Record<NavigationGroup, string> = {
  overview: 'Dashboard', people: 'Students & families', preschool: 'Preschool', school_life: 'School life',
  teaching: 'Teaching', results: 'Evaluation & results', followup: 'Requests & follow-up',
  administration: 'Administration', family_portals: 'Family portals',
}
const groupOrder: NavigationGroup[] = ['people', 'preschool', 'school_life', 'teaching', 'results', 'followup', 'administration', 'family_portals']

export default function AppShell({ children, school, name, avatar, roles, owner, academicYear }: {
  children: ReactNode; school: string; name: string; avatar: string | null; roles: string[]; owner: boolean; academicYear: string | null
}) {
  const locale = useLocale()
  const {years,year,yearId,canSelect:canSelectYear,setYearId}=useAcademicYear()
  const t = (text: string) => translate(text, locale)
  const path = usePathname()
  const items = permittedNavigation(roles, owner)
  const dashboard = items.find(item => item.href === '/dashboard')
  const groups = groupOrder.map(group => ({ group, items: items.filter(item => item.group === group) })).filter(section => section.items.length)
  const activeItem = [...items].sort((a, b) => b.href.length - a.href.length).find(item => path === item.href || path.startsWith(item.href + '/'))
  const [collapsedGroups, setCollapsedGroups] = useState<NavigationGroup[]>([])
  const [menu, setMenu] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [open, setOpen] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])
  const [unread, setUnread] = useState<number | null>(null)
  const [noticeError, setNoticeError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [logoutError, setLogoutError] = useState(false)

  function withYear(href:string){
    if(!canSelectYear||!yearId||!href.startsWith('/dashboard'))return href
    const [pathname,query='']=href.split('?'),params=new URLSearchParams(query)
    params.set('year',yearId)
    return `${pathname}?${params}`
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('atechos:collapsed-navigation') || '[]') as NavigationGroup[]
      setCollapsedGroups(saved.filter(group => groupOrder.includes(group)))
    } catch { setCollapsedGroups([]) }
  }, [])

  useEffect(() => {
    let current = true
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) { setResults([]); setSearching(false); return }
      setSearching(true); setSearchError(false)
      try {
        const { data, error } = await createClient().rpc('school_search', { p_query: query.trim() })
        if (current) { setResults(error ? [] : data || []); setSearchError(Boolean(error)) }
      } catch { if (current) setSearchError(true) }
      finally { if (current) setSearching(false) }
    }, 250)
    return () => { current = false; clearTimeout(timer) }
  }, [query])

  useEffect(() => {
    let current = true
    async function load() {
      try {
        const db = createClient()
        const [list, count] = await Promise.all([
          db.from('notifications').select('id,title,description,created_at,read_at,priority,href,type').order('created_at', { ascending: false }).limit(30),
          db.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
        ])
        if (!current) return
        setNoticeError(Boolean(list.error || count.error))
        if (!list.error) setNotices(list.data || [])
        if (!count.error) setUnread(count.count || 0)
      } catch { if (current) setNoticeError(true) }
    }
    void load()
    const timer = setInterval(load, 60000)
    return () => { current = false; clearInterval(timer) }
  }, [open])

  async function read(notice: Notice) {
    if (notice.read_at) return
    const { error } = await createClient().rpc('mark_notification_read', { p_id: notice.id })
    if (error) { setNoticeError(true); return }
    setNotices(value => value.map(item => item.id === notice.id ? { ...item, read_at: new Date().toISOString() } : item))
    setUnread(value => value === null ? null : Math.max(0, value - 1))
  }

  async function logout() {
    setBusy(true); setLogoutError(false)
    try {
      const { error } = await createClient().auth.signOut({ scope: 'local' })
      if (error) throw error
      window.location.replace('/login')
    } catch { setLogoutError(true); setBusy(false) }
  }

  function toggleGroup(group: NavigationGroup) {
    setCollapsedGroups(previous => {
      const next = previous.includes(group) ? previous.filter(item => item !== group) : [...previous, group]
      try { localStorage.setItem('atechos:collapsed-navigation', JSON.stringify(next)) } catch { /* Preferences are optional. */ }
      return next
    })
  }

  function navLink(item: NavigationItem) {
    const Icon = icons[item.icon] || FileText
    const active = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href + '/'))
    return <Link key={item.href} href={withYear(item.href)} onClick={() => { setMenu(false); setQuery('') }} aria-current={active ? 'page' : undefined}
      className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? 'bg-blue-600 font-semibold text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
      <Icon size={18} aria-hidden="true"/><T text={item.label}/>{active && <ChevronRight size={15} className="ml-auto" aria-hidden="true"/>}
    </Link>
  }

  return <div className="atechos-shell min-h-screen bg-slate-50 text-slate-900">
    {menu && <button className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden print:hidden" aria-label={t('Close navigation')} onClick={() => setMenu(false)}/>}
    <aside className={`${menu ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col bg-[#101e38] text-slate-200 transition-transform lg:translate-x-0 print:hidden`}>
      <Link href="/onboarding" className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <span className="rounded-xl bg-blue-600 p-2 text-white"><GraduationCap/></span>
        <span><strong className="block text-xl tracking-tight text-white">AtechOS</strong><span className="text-xs text-slate-400"><T text="School system"/></span></span>
      </Link>
      <button className="absolute right-2 top-2 p-2 lg:hidden" aria-label={t('Close navigation')} onClick={() => setMenu(false)}><X size={18}/></button>
      <p className="truncate px-5 pb-2 pt-4 text-xs font-medium text-slate-400" title={school}>{school}</p>
      <nav aria-label={t('School modules')} className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {dashboard && <section aria-label={t('Dashboard')}>{navLink(dashboard)}</section>}
        {groups.map(({ group, items: sectionItems }) => {
          const collapsed = collapsedGroups.includes(group)
          return <section key={group}>
            <button type="button" aria-expanded={!collapsed} onClick={() => toggleGroup(group)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:bg-white/5 hover:text-slate-200">
              <T text={groupLabels[group]}/><ChevronDown size={15} className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} aria-hidden="true"/>
            </button>
            {!collapsed && <div className="mt-1 space-y-1">{sectionItems.map(navLink)}</div>}
          </section>
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button disabled={busy} onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-60"><LogOut size={18}/><T text={busy ? 'Signing out…' : 'Logout'}/></button>
        {logoutError && <p role="alert" className="px-3 text-sm text-red-300"><T text="Unable to sign out. Please try again."/></p>}
      </div>
    </aside>

    <div className="min-w-0 lg:pl-72 print:pl-0">
      <header className="relative z-20 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:px-6 print:hidden">
        <button className="rounded-lg border p-2 lg:hidden" aria-label={t('Open navigation')} aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu size={20}/></button>
        {canSelectYear&&years.length>0?<label className="order-last flex w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 sm:order-none sm:w-auto"><CalendarDays size={17} className="shrink-0 text-blue-700"/><span className="sr-only"><T text="Academic year"/></span><select aria-label={t('Academic year')} value={year?.id||''} onChange={event=>setYearId(event.target.value)} className="min-w-0 flex-1 bg-transparent font-semibold outline-none sm:max-w-40">{years.map(item=><option key={item.id} value={item.id}>{item.name}{item.is_current?` · ${t('Current')}`:''}</option>)}</select></label>:academicYear&&<div className="hidden shrink-0 items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 sm:flex"><CalendarDays size={17} className="text-blue-700"/><span><T text="Academic year"/> <strong>{academicYear}</strong></span></div>}
        <div className="relative order-last w-full min-w-0 md:order-none md:w-auto md:flex-1">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><Search size={18} className="shrink-0 text-slate-400"/><span className="sr-only"><T text="Search students, parents, teachers…"/></span><input value={query} maxLength={100} onChange={event => { setResults([]); setQuery(event.target.value) }} className="w-full min-w-0 bg-transparent text-sm outline-none" placeholder={t('Search students, parents, teachers…')}/></label>
          {query.trim().length >= 2 && <div className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-auto rounded-xl border bg-white p-2 shadow-xl" role="region" aria-label={t('Search results')}>
            {searching ? <p className="p-3"><T text="Loading..."/></p> : searchError ? <p role="alert" className="p-3"><T text="Search unavailable. Please try again."/></p> : results.length ? results.map((result, index) => <Link key={result.href + index} href={withYear(result.href)} onClick={() => setQuery('')} className="block rounded-lg p-3 hover:bg-blue-50"><span className="block text-sm font-semibold">{result.label}</span><span className="text-xs text-slate-500"><T text={result.kind === 'student' ? 'Student' : result.kind === 'teacher' ? 'Teacher' : result.kind === 'parent' ? 'Parent' : 'Class'}/></span></Link>) : <p className="p-3"><T text="No permitted results."/></p>}
          </div>}
        </div>
        <div className="relative">
          <button onClick={() => setOpen(!open)} aria-label={t('Notifications')} aria-expanded={open} className="relative rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50"><Bell size={20}/>{unread !== null && unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white">{unread}</span>}</button>
          {open && <section className="absolute right-0 top-full mt-3 w-80 max-w-[85vw] rounded-2xl border bg-white p-4 shadow-xl"><h2 className="mb-3 font-semibold"><T text="Notifications"/></h2>{noticeError && <p role="alert"><T text="Unable to load notifications."/></p>}<div className="max-h-96 overflow-auto">{notices.map(notice => <article key={notice.id} className={`mb-2 rounded-xl border p-3 ${notice.read_at ? 'bg-white' : 'border-blue-200 bg-blue-50'}`}><p className="flex items-center gap-2 text-sm font-semibold"><Bell size={15}/>{notice.title}</p><p className="my-1 text-sm text-slate-600">{notice.description}</p><p className="text-xs text-slate-500">{schoolDateTime(notice.created_at, locale)} · {notice.priority}</p><div className="mt-2 flex gap-3 text-sm text-blue-700">{notice.href.startsWith('/dashboard/') && !notice.href.includes('\\') && <Link href={withYear(notice.href)} onClick={() => { void read(notice); setOpen(false) }}><T text="Open"/></Link>}{!notice.read_at && <button onClick={() => void read(notice)}><T text="Mark as read"/></button>}</div></article>)}{!noticeError && !notices.length && <p className="text-sm text-slate-500"><T text="No notifications yet."/></p>}</div></section>}
        </div>
        <div className="flex min-w-0 items-center gap-2 border-l border-slate-200 pl-2 sm:gap-3 sm:pl-3">{avatar ? <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover sm:h-10 sm:w-10"/> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 sm:h-10 sm:w-10">{name.trim().slice(0, 1).toUpperCase() || 'A'}</span>}<div className="w-24 min-w-0 shrink-0"><p className="truncate text-sm font-semibold">{name}</p><p className="hidden truncate text-xs text-slate-500 2xl:block">{roles.map((role, index) => <span key={role}>{index > 0 ? ' · ' : ''}<T text={roleLabels[role] || role}/></span>)}</p></div></div>
        <div className="ml-auto shrink-0 text-xs"><LanguageSelector locale={locale} compact/></div>
      </header>
      {path !== '/dashboard' && <nav aria-label={t('Breadcrumb')} className="flex min-w-0 items-center gap-2 px-5 pt-4 text-sm text-slate-500 md:px-8"><Link href={withYear('/dashboard')} className="inline-flex shrink-0 items-center gap-1.5 hover:text-blue-700"><Home size={15}/><T text="Dashboard"/></Link><ChevronRight size={14} aria-hidden="true"/><span aria-current="page" className="truncate font-medium text-slate-800"><T text={activeItem?.label || 'School modules'}/></span></nav>}
      <div className="min-w-0">{children}</div>
    </div>
  </div>
}
