import Link from 'next/link'
import GradeActions from '@/components/grade-actions'
import {redirect} from 'next/navigation'
import {Users,UserCheck,Clock,UserX,ArrowUpRight,ClipboardList} from 'lucide-react'
import {createClient} from '@/lib/supabase/server'
import {schoolDate} from '@/lib/school-date'
import {T} from '@/components/translation-provider'
import {cookies} from 'next/headers'
import {localeFrom} from '@/lib/i18n'
export default async function DashboardPage(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login')
 const locale=localeFrom((await cookies()).get('atechos_locale')?.value)
 const [context,summary]=await Promise.all([db.rpc('school_context'),db.rpc('dashboard_summary')])
 if(context.error)throw new Error('Unable to verify school access.')
 const data=summary.data;const kpis=[['Students',data?.students,Users,'bg-blue-50 text-blue-700'],['Present today',data?.present,UserCheck,'bg-emerald-50 text-emerald-700'],['Late today',data?.late,Clock,'bg-amber-50 text-amber-700'],['Absent today',data?.absent,UserX,'bg-red-50 text-red-700']] as const
 return <main className="mx-auto max-w-7xl space-y-7 p-5 md:p-8"><header><p className="text-sm font-medium text-blue-700">{context.data?.school_name}</p><h1 className="mt-1 text-3xl font-bold tracking-tight"><T text="Dashboard"/></h1><p className="mt-2 text-sm text-slate-500">{data?.date&&schoolDate(data.date,locale)} · <T text={data?.school_scope?'School overview':'Your authorized records'}/></p></header>{summary.error?<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4"><T text="Unable to load dashboard totals."/></p>:<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.filter(([,value])=>value!==null&&value!==undefined).map(([label,value,Icon,color])=><article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-slate-500"><T text={label}/></p><span className={'rounded-xl p-3 '+color}><Icon size={21}/></span></div><p className="mt-3 text-3xl font-bold">{value}</p></article>)}</section>}
 <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-semibold"><ClipboardList size={21} className="text-blue-600"/><T text="Actions required"/></h2>{data?.draft_grades>0?<Link href="/dashboard/grades" className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4"><span><strong className="block"><T text="Unpublished grades"/> : {data.draft_grades}</strong><span className="text-sm text-slate-600"><T text="Open grade entry to verify the saved work."/></span></span><ArrowUpRight size={20}/></Link>:<p className="mt-3 text-sm text-slate-500"><T text="No grade-entry action in your current scope."/></p>}</section>
 <GradeActions/></main>
}
