'use client'
import {useActionState} from 'react'
import {T} from '@/components/translation-provider'
import {schoolDateTime} from '@/lib/school-date'
import {confirmStudentHomeArrival,type HomeArrivalActionState} from '@/app/student/arrival-actions'
import {CheckCircle2,House,LoaderCircle} from 'lucide-react'

type HomeArrival={check_out_at:string;confirmed_at:string|null;confirmed_as:'parent'|'student'|null}|null
const initial:HomeArrivalActionState={error:'',success:''}
export default function StudentHomeArrival({data}:{data:HomeArrival}){
 const [state,action,pending]=useActionState(confirmStudentHomeArrival,initial)
 if(!data)return null
 return <section className="my-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-950"><House size={19} aria-hidden="true"/><T text="Home-arrival confirmation"/></h2><p className="mt-2 text-sm text-emerald-950"><T text="KIOS check-out"/> · {schoolDateTime(data.check_out_at)}</p>{data.confirmed_at?<p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-green-800"><CheckCircle2 size={17} aria-hidden="true"/><T text="Home arrival confirmed"/> · {schoolDateTime(data.confirmed_at)} ({data.confirmed_as==='student'?<T text="Student"/>:<T text="Parent"/>})</p>:<form action={action} className="mt-3"><p className="mb-2 text-sm text-emerald-950"><T text="Have you arrived home safely?"/></p><button disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50">{pending?<LoaderCircle size={17} className="animate-spin" aria-hidden="true"/>:<CheckCircle2 size={17} aria-hidden="true"/>}<T text="Confirm arrival at home"/></button></form>}{state.error&&<p role="alert" className="mt-2 text-sm text-red-700"><T text={state.error}/></p>}{state.success&&<p role="status" className="mt-2 text-sm text-green-800"><T text={state.success}/></p>}</section>
}
