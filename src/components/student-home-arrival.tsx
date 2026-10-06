'use client'
import {useActionState} from 'react'
import {T} from '@/components/translation-provider'
import {schoolDateTime} from '@/lib/school-date'
import {confirmStudentHomeArrival,type HomeArrivalActionState} from '@/app/student/arrival-actions'

type HomeArrival={check_out_at:string;confirmed_at:string|null;confirmed_as:'parent'|'student'|null}|null
const initial:HomeArrivalActionState={error:'',success:''}
export default function StudentHomeArrival({data}:{data:HomeArrival}){
 const [state,action,pending]=useActionState(confirmStudentHomeArrival,initial)
 if(!data)return null
 return <section className="my-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h2 className="text-lg font-semibold"><T text="Home-arrival confirmation"/></h2><p className="mt-2 text-sm"><T text="KIOS check-out"/> · {schoolDateTime(data.check_out_at)}</p>{data.confirmed_at?<p className="mt-2 text-sm text-green-800"><T text="Home arrival confirmed"/> · {schoolDateTime(data.confirmed_at)} ({data.confirmed_as==='student'?<T text="Student"/>:<T text="Parent"/>})</p>:<form action={action} className="mt-3"><p className="mb-2 text-sm"><T text="Have you arrived home safely?"/></p><button disabled={pending} className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50"><T text="Confirm arrival at home"/></button></form>}{state.error&&<p role="alert" className="mt-2 text-sm text-red-700"><T text={state.error}/></p>}{state.success&&<p role="status" className="mt-2 text-sm text-green-800"><T text={state.success}/></p>}</section>
}
