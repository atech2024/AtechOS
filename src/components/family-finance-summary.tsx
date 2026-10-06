'use client'

import {useEffect,useState} from 'react'
import {T} from '@/components/translation-provider'
import {createClient} from '@/lib/supabase/client'

type Total={currency_code:string;billed_amount:number;paid_amount:number;pending_amount:number;remaining_amount:number;upcoming_count:number;available_credit:number}
type Charge={id:string;description:string;class_name:string;currency_code:string;due_date:string;billed_amount:number;paid_amount:number;pending_amount:number;remaining_amount:number;status:'settled'|'pending'|'overdue'|'upcoming'}
type Summary={totals:Total[];charges:Charge[];charge_count:number;charges_truncated:boolean}

function money(value:number,currency:string){try{return new Intl.NumberFormat('fr-HT',{style:'currency',currency}).format(Number(value))}catch{return `${Number(value).toFixed(2)} ${currency}`}}
function dueDate(value:string){return new Intl.DateTimeFormat('fr-HT',{dateStyle:'medium',timeZone:'America/Port-au-Prince'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`))}

export default function FamilyFinanceSummary({studentId}:{studentId:string}){
 const [data,setData]=useState<Summary|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false)
 useEffect(()=>{
  let active=true
  if(!studentId){setData(null);setLoading(false);return()=>{active=false}}
  setLoading(true);setError(false)
  void createClient().rpc('family_finance_summary',{p_student_id:studentId}).then(({data:result,error:requestError})=>{
   if(!active)return
   const payload=(Array.isArray(result)?result[0]:result) as Summary|null
   if(requestError||!payload){setData(null);setError(true)}else setData(payload)
   setLoading(false)
  })
  return()=>{active=false}
 },[studentId])
 return <section aria-labelledby="family-finance-summary-title" className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
  <h3 id="family-finance-summary-title" className="font-semibold"><T text="All school fees"/></h3>
  <p className="mt-1 text-sm text-slate-600"><T text="Includes upcoming installments. Pending requests are separate from paid amounts."/></p>
  {loading?<p className="mt-3 text-sm text-slate-600"><T text="Loading..."/></p>:error?<p role="alert" className="mt-3 text-sm text-red-700"><T text="Unable to load the full fee summary."/></p>:!data?.charges.length?<p className="mt-3 text-sm text-slate-600"><T text="No school fees recorded for this child."/></p>:<>
   <div className="mt-3 grid gap-2 sm:grid-cols-2">{data.totals.map(total=><article key={total.currency_code} className="rounded-lg border border-slate-200 bg-white p-3 text-sm"><h4 className="font-semibold">{total.currency_code}</h4><dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1"><dt className="text-slate-600"><T text="Total fees"/></dt><dd className="text-right font-medium">{money(total.billed_amount,total.currency_code)}</dd><dt className="text-slate-600"><T text="Paid and applied"/></dt><dd className="text-right font-medium text-emerald-800">{money(total.paid_amount,total.currency_code)}</dd><dt className="text-slate-600"><T text="Payment requests pending"/></dt><dd className="text-right font-medium">{money(total.pending_amount,total.currency_code)}</dd><dt className="text-slate-600"><T text="Remaining balance"/></dt><dd className="text-right font-semibold">{money(total.remaining_amount,total.currency_code)}</dd>{Number(total.available_credit)>0&&<><dt className="text-slate-600"><T text="Available credit"/></dt><dd className="text-right font-medium">{money(total.available_credit,total.currency_code)}</dd></>}</dl></article>)}</div>
   <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-100"><tr>{['Fee / installment','Due date','Amount','Paid and applied','Pending','Remaining balance','Status'].map(label=><th key={label} className="px-3 py-2 font-semibold"><T text={label}/></th>)}</tr></thead><tbody>{data.charges.map(charge=><tr key={charge.id} className="border-t border-slate-200"><td className="px-3 py-2"><span className="font-medium">{charge.description}</span><span className="block text-xs text-slate-600">{charge.class_name}</span></td><td className="whitespace-nowrap px-3 py-2">{dueDate(charge.due_date)}</td><td className="whitespace-nowrap px-3 py-2">{money(charge.billed_amount,charge.currency_code)}</td><td className="whitespace-nowrap px-3 py-2">{money(charge.paid_amount,charge.currency_code)}</td><td className="whitespace-nowrap px-3 py-2">{money(charge.pending_amount,charge.currency_code)}</td><td className="whitespace-nowrap px-3 py-2 font-medium">{money(charge.remaining_amount,charge.currency_code)}</td><td className="px-3 py-2"><T text={charge.status==='settled'?'Paid':charge.status==='pending'?'Pending validation':charge.status==='overdue'?'Overdue':'Upcoming'}/></td></tr>)}</tbody></table></div>
   {data.charges_truncated&&<p className="mt-2 text-xs text-slate-600"><T text="Showing the first 500 installments; totals include every fee."/></p>}
  </>}
 </section>
}
