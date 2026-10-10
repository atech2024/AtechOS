'use client'

import {useEffect,useMemo,useState} from 'react'
import {BarChart3,CalendarDays,ChevronRight,Clock3,Download,FileText,GraduationCap,Plus,RotateCcw,Wallet} from 'lucide-react'
import {T,useLocale} from '@/components/translation-provider'
import {translate} from '@/lib/translations'
import {FinancePaymentReceiptButton} from '@/components/finance-payment-receipt'
import {financeChargeStatus,financeDaysOverdue,financeMonthlyRevenue,financePaymentMethodShare,financePaymentMonth,type FinanceDashboardCharge,type FinanceDashboardPayment} from '@/lib/finance-dashboard'

type ClassOption={id:string;name:string}
type Props={
  expected:number
  paid:number
  balance:number
  pending:number
  pendingPayments:{id:string;student_name:string;charge_description:string;class_name:string;amount:number;currency_code:string;recorded_at:string}[]
  brhRate:{date:string;rate:number;source_url?:string}|null
  latestBrhDate:string|null
  validatedCount:number
  charges:FinanceDashboardCharge[]
  payments:FinanceDashboardPayment[]
  classes:ClassOption[]
  classId:string
  onClassChange:(id:string)=>void
  currency:string
  locale:string
  credits:{student_id:string;student_name:string;currency_code:string;amount:number}[]
  onNavigate:(tab:'plans'|'payments'|'adjustments'|'history')=>void
}

const colors=['#13a765','#2475f5','#8b4cf6','#f6a51a','#a8bfd9','#e85656','#14b8a6','#f16e95']
const haitiToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince'}).format(new Date())
const currentMonth=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince',year:'numeric',month:'2-digit'}).format(new Date())
function money(amount:number,currency:string,locale:string){
  try{return new Intl.NumberFormat(locale==='fr'?'fr-HT':locale==='ht'?'ht-HT':'en-US',{style:'currency',currency}).format(Number(amount)||0)}
  catch{return `${Number(amount||0).toLocaleString()} ${currency}`}
}
function date(value:string,locale:string,withTime=false){
  const parsed=new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value}T12:00:00Z`:value)
  if(Number.isNaN(parsed.getTime()))return value
  return new Intl.DateTimeFormat(locale==='fr'?'fr-HT':locale==='ht'?'ht-HT':'en-US',{dateStyle:'medium',...(withTime?{timeStyle:'short' as const}:{}),timeZone:'America/Port-au-Prince'}).format(parsed)
}
function elapsedSince(value:string,locale:string,now:number){
  const timestamp=new Date(value).getTime()
  if(!Number.isFinite(timestamp))return value
  const minutes=Math.max(0,Math.floor((now-timestamp)/60000))
  if(minutes<1)return locale==='fr'?'À l’instant':locale==='ht'?'Kounye a':'Just now'
  const amount=minutes<60?minutes:minutes<1440?Math.floor(minutes/60):Math.floor(minutes/1440)
  const unit=minutes<60?(locale==='fr'?'min':locale==='ht'?'min':'min'):minutes<1440?(locale==='fr'?'h':locale==='ht'?'èdtan':'hr'):(locale==='fr'?'j':locale==='ht'?'jou':'days')
  return amount+' '+unit
}
function safeCsv(value:unknown){
  const text=String(value??'')
  return `"${(/^[=+\-@]/.test(text)?`'${text}`:text).replace(/"/g,'""')}"`
}
function monthLabel(value:string,locale:string,style:Intl.DateTimeFormatOptions['month']='short'){
  const [year,month]=value.split('-').map(Number)
  return new Intl.DateTimeFormat(locale==='fr'?'fr-HT':locale==='ht'?'ht-HT':'en-US',{month:style,timeZone:'America/Port-au-Prince'}).format(new Date(Date.UTC(year,month-1,15,12)))
}

export default function AccountingDashboard(props:Props){
  const locale=useLocale()
  const [month,setMonth]=useState(currentMonth())
  const [now,setNow]=useState(0)
  useEffect(()=>{setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),60_000);return()=>window.clearInterval(timer)},[])
  const activeClassName=props.classes.find(item=>item.id===props.classId)?.name
  const visiblePayments=useMemo(()=>props.payments.filter(payment=>!activeClassName||payment.class_name===activeClassName),[props.payments,activeClassName])
  const monthPayments=useMemo(()=>visiblePayments.filter(payment=>financePaymentMonth(payment.paid_at)===month),[visiblePayments,month])
  const monthCharges=useMemo(()=>props.charges.filter(charge=>charge.due_date.slice(0,7)===month),[props.charges,month])
  const chartYear=Number(month.slice(0,4))||new Date().getFullYear()
  const revenue=useMemo(()=>financeMonthlyRevenue(visiblePayments,props.currency,chartYear),[visiblePayments,props.currency,chartYear])
  const methods=useMemo(()=>financePaymentMethodShare(monthPayments),[monthPayments])
  const statuses=useMemo(()=>financeChargeStatus(monthCharges,haitiToday()),[monthCharges])
  const maxRevenue=Math.max(1,...revenue.map(item=>item.amount))
  const collectionRate=props.expected>0?Math.min(100,Math.round(props.paid/props.expected*100)):0
  const overdueCharges=useMemo(()=>props.charges
    .filter(charge=>charge.due_date<haitiToday()&&Math.max(0,Number(charge.amount)-Number(charge.adjusted_amount)-Number(charge.paid_amount))>0)
    .sort((a,b)=>a.due_date.localeCompare(b.due_date))
    .slice(0,5),[props.charges])
  const recentPayments=useMemo(()=>monthPayments
    .filter(payment=>payment.status==='validated')
    .sort((a,b)=>b.paid_at.localeCompare(a.paid_at))
    .slice(0,6),[monthPayments])
  const upcoming=useMemo(()=>{
    const today=haitiToday()
    return props.charges.filter(charge=>charge.due_date>=today&&charge.due_date.slice(0,7)===month)
      .sort((a,b)=>a.due_date.localeCompare(b.due_date))
      .slice(0,6)
  },[props.charges,month])
  const donutTotal=statuses.total||1
  const donutStops=[
    {value:statuses.paid,color:'#13a765'},
    {value:statuses.overdue,color:'#f6a51a'},
    {value:statuses.upcoming,color:'#e85656'}
  ]
  let stopAt=0
  const donut=donutStops.map(item=>{
    const start=stopAt
    stopAt+=item.value/donutTotal*100
    return `${item.color} ${start}% ${stopAt}%`
  }).join(', ')
  function exportCsv(){
    const rows=[
      ['Date','Élève','Classe','Frais','Montant','Devise','Mode','Référence','Statut'],
      ...monthPayments.map(payment=>[date(payment.paid_at,locale,true),payment.student_name,payment.class_name,payment.charge_description,payment.amount,payment.currency_code,payment.payment_method,(payment as FinanceDashboardPayment & {reference?:string|null}).reference||'',payment.status])
    ]
    const csv='\uFEFF'+rows.map(row=>row.map(safeCsv).join(';')).join('\r\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
    const anchor=document.createElement('a')
    anchor.href=url
    anchor.download=`rapport-finances-${month}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const cards=[
    {label:'Expected fees',value:props.expected,detail:'For the selected school year',icon:Wallet,color:'bg-emerald-100 text-emerald-700'},
    {label:'Payments received',value:props.paid,detail:'For the selected school year',icon:GraduationCap,color:'bg-blue-100 text-blue-700'},
    {label:'Outstanding balance',value:props.balance,detail:'Outstanding fee balance',icon:Clock3,color:'bg-amber-100 text-amber-700'}
  ]
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="hidden sm:block"><span className="sr-only"><T text="Finance filters"/></span></div>
      <div className="grid w-full gap-2 sm:grid-cols-[1fr_1fr_auto] lg:w-auto">
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"><CalendarDays className="size-4 text-slate-500"/><span className="sr-only"><T text="Period"/></span><input aria-label={locale==='fr'?'Période':locale==='ht'?'Peryòd':'Period'} type="month" value={month} onChange={event=>setMonth(event.target.value)} className="min-w-0 bg-transparent outline-none"/></label>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"><span className="sr-only"><T text="Filter details by class"/></span><select aria-label={locale==='fr'?'Filtrer les détails par classe':locale==='ht'?'Filtre detay yo pa klas':'Filter details by class'} value={props.classId} onChange={event=>props.onClassChange(event.target.value)} className="min-w-0 bg-transparent outline-none"><option value=""><T text="All classes"/></option>{props.classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button type="button" onClick={exportCsv} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"><Download className="size-4"/><T text="Export"/></button>
      </div>
      <p className="w-full text-xs text-slate-500"><T text="Summary cards cover the school year; details follow the selected class."/></p>
    </div>

    <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h3 className="font-bold"><T text="Quick actions"/></h3></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{[
          {label:'Add a payment',icon:Plus,onClick:undefined,tab:'payments' as const,color:'border-blue-200 bg-blue-50 text-blue-800'},
          {label:'Create a fee plan',icon:FileText,onClick:undefined,tab:'plans' as const,color:'border-emerald-200 bg-emerald-50 text-emerald-800'},
          {label:'Scholarships and discounts',icon:GraduationCap,onClick:undefined,tab:'adjustments' as const,color:'border-violet-200 bg-violet-50 text-violet-800'},
          {label:'Record a refund',icon:RotateCcw,onClick:undefined,tab:'payments' as const,color:'border-orange-200 bg-orange-50 text-orange-800'},
          {label:'Export financial report',icon:BarChart3,tab:undefined,onClick:()=>exportCsv(),color:'border-amber-200 bg-amber-50 text-amber-800'}
        ].map(action=><button key={action.label} type="button" onClick={()=>action.tab?props.onNavigate(action.tab):action.onClick?.()} className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center text-xs font-semibold hover:shadow-sm ${action.color}`}><action.icon className="size-6"/><T text={action.label}/></button>)}</div>
        <p className="mt-3 text-xs text-slate-500"><T text="Amounts use recorded fee and payment data."/></p>
      </article>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <article className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-950">{locale==='fr'?'Taux BRH du jour':locale==='ht'?'To BRH pou jodi a':'Today’s BRH rate'}</h3><p className="mt-1 text-xs text-slate-500">{locale==='fr'?'Taux officiel de référence USD/HTG':locale==='ht'?'To ofisyèl USD/HTG':'Official USD/HTG reference rate'}</p></div><Wallet className="size-5 shrink-0 text-blue-700"/></div>
          {props.brhRate?.date===haitiToday()?<><p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">1 USD = {Number(props.brhRate.rate).toLocaleString(locale==='fr'?'fr-HT':locale==='ht'?'ht-HT':'en-US',{minimumFractionDigits:2,maximumFractionDigits:4})} HTG</p><p className="mt-1 text-xs text-emerald-700">{locale==='fr'?'Publié le':locale==='ht'?'Pibliye':'Published'} {date(props.brhRate.date,locale)}</p></>:<><p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{locale==='fr'?'Taux du jour non disponible':locale==='ht'?'To jodi a poko disponib':'Today’s rate is not available'}</p>{props.latestBrhDate&&<p className="mt-2 text-xs text-slate-500">{locale==='fr'?'Dernier taux publié':locale==='ht'?'Dènye to pibliye':'Last published rate'}: {date(props.latestBrhDate,locale)}</p>}</>}
          <a className="mt-2 inline-flex text-xs font-semibold text-blue-700 underline" href={props.brhRate?.source_url||'https://www.brh.ht/taux-du-jour/'} target="_blank" rel="noreferrer">BRH · {locale==='fr'?'Source officielle':locale==='ht'?'Sous ofisyèl':'Official source'}</a>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-950">{locale==='fr'?'Paiements en attente':locale==='ht'?'Peman k ap tann':'Pending payments'}</h3><p className="mt-1 text-xs text-slate-500">{props.pending} · {locale==='fr'?'à traiter':locale==='ht'?'pou trete':'to review'}</p></div><button type="button" onClick={()=>props.onNavigate('payments')} className="text-sm font-semibold text-blue-700 hover:underline">{locale==='fr'?'Voir tout':locale==='ht'?'Gade tout':'View all'}</button></div>
          {props.pendingPayments.length>0?<ul className="mt-3 divide-y divide-amber-100">{props.pendingPayments.slice(0,3).map(payment=><li key={payment.id} className="flex items-start justify-between gap-3 py-2 first:pt-0"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{payment.student_name}</p><p className="truncate text-xs text-slate-600">{payment.class_name} · {payment.charge_description}</p><p className="mt-1 text-xs font-semibold text-amber-800">{locale==='fr'?'En attente depuis':locale==='ht'?'Ap tann depi':'Pending for'} {elapsedSince(payment.recorded_at,locale,now)}<span className="mt-0.5 block font-normal text-slate-500">{date(payment.recorded_at,locale,true)}</span></p></div><strong className="shrink-0 text-sm text-slate-950">{money(payment.amount,payment.currency_code,locale)}</strong></li>)}</ul>:<p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{locale==='fr'?'Aucun paiement en attente.':locale==='ht'?'Pa gen peman k ap tann.':'No pending payments.'}</p>}
        </article>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card,index)=><article key={card.label} className="flex min-h-28 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${card.color}`}><card.icon className="size-6"/></span>
        <div className="min-w-0"><p className="text-sm font-medium text-blue-800"><T text={card.label}/></p><p className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">{money(card.value,props.currency,locale)}</p><p className="mt-1 text-xs text-slate-500">{index===1?<><strong>{props.validatedCount}</strong> <T text="validated payments"/> · <span className="font-semibold text-emerald-700">{collectionRate}%</span> <T text="collection rate"/></>:<T text={card.detail}/>}</p></div>
      </article>)}
      <article className="flex min-h-28 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2 xl:col-span-1">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><GraduationCap className="size-6"/></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-medium text-blue-800"><T text="Installments paid"/></p><p className="mt-1 text-xl font-extrabold text-slate-950">{statuses.total?Math.round(statuses.paid/statuses.total*100):0}%</p><p className="mt-1 text-xs text-slate-500">{statuses.paid} / {statuses.total} <T text="installments due this month paid"/></p><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width:`${statuses.total?statuses.paid/statuses.total*100:0}%`}}/></div></div>
      </article>
    </section>

    {props.credits.length>0&&<section className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm"><strong className="text-violet-900"><T text="Available credits"/>:</strong>{props.credits.map((credit,index)=><span key={`${credit.student_id}-${credit.currency_code}-${index}`} className="rounded-full bg-white px-3 py-1 text-violet-900">{credit.student_name} · {money(Number(credit.amount),credit.currency_code,locale)}</span>)}</section>}

    <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr_1fr]">
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-950"><T text="Monthly revenue"/></h3><p className="text-xs text-slate-500"><T text="Validated payments by month"/> · {chartYear} · <T text="Based on up to 500 recent records"/></p></div><span className="rounded-lg border border-slate-200 px-2 py-1 text-xs"><T text="Currency"/>: {props.currency}</span></div>
        <div className="mt-5 flex h-44 items-end gap-1.5 sm:gap-2" role="img" aria-label={locale==='fr'?'Paiements validés par mois':locale==='ht'?'Peman valide pa mwa':'Validated payments by month'}>{revenue.map(item=><div key={item.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"><div className="flex h-full w-full items-end rounded-t bg-slate-50"><div title={money(item.amount,props.currency,locale)} className={`w-full rounded-t ${item.month===month?'bg-blue-700':'bg-blue-400'}`} style={{height:item.amount? `${Math.max(3,item.amount/maxRevenue*100)}%`:'2px'}}/></div><span className={`text-[10px] ${item.month===month?'font-bold text-blue-800':'text-slate-500'}`}>{monthLabel(item.month,locale)}</span></div>)}</div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-600"><span><T text="Received amount in the selected currency"/></span><strong>{money(revenue.reduce((sum,item)=>sum+item.amount,0),props.currency,locale)}</strong></div>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-bold text-slate-950"><T text="Payment methods"/></h3><p className="mt-1 text-xs text-slate-500">{monthLabel(month,locale,'long')} · <T text="By count of validated payments"/></p>
        <div className="mt-4 grid grid-cols-[140px_1fr] items-center gap-3">
          <div className="relative mx-auto size-32 rounded-full" style={{background:methods.length?`conic-gradient(${methods.map((item,index)=>{const before=methods.slice(0,index).reduce((sum,row)=>sum+row.percent,0);return `${colors[index%colors.length]} ${before}% ${before+item.percent}%`}).join(', ')})`:'#e2e8f0'}}>
            <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white text-center"><strong className="text-lg text-slate-950">{monthPayments.filter(p=>p.status==='validated').length}</strong><span className="text-[10px] text-slate-500"><T text="payments"/></span></div>
          </div>
          <ul className="space-y-2">{methods.slice(0,6).map((item,index)=><li key={item.method} className="flex min-w-0 items-center gap-2 text-xs"><span className="size-2.5 shrink-0 rounded-full" style={{backgroundColor:colors[index%colors.length]}}/><span className="min-w-0 flex-1 truncate text-slate-600">{translate(item.method,locale)}</span><strong className="text-slate-900">{item.percent}%</strong></li>)}</ul>
        </div>
        {methods.length===0&&<p className="mt-3 text-sm text-slate-500"><T text="No validated payments for this month."/></p>}
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-bold text-slate-950"><T text="School fee status"/></h3><p className="mt-1 text-xs text-slate-500">{monthLabel(month,locale,'long')}</p>
        <div className="mt-4 grid grid-cols-[140px_1fr] items-center gap-3">
          <div className="relative mx-auto size-32 rounded-full" style={{background:`conic-gradient(${donut})`}}><div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white text-center"><strong className="text-xl text-slate-950">{statuses.total?Math.round(statuses.paid/statuses.total*100):0}%</strong><span className="text-[10px] text-slate-500"><T text="paid"/></span></div></div>
          <ul className="space-y-3 text-xs"><li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-emerald-500"/><T text="Paid"/> <strong className="ml-auto">{statuses.paid}</strong></li><li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-amber-500"/><T text="Overdue"/> <strong className="ml-auto">{statuses.overdue}</strong></li><li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-red-500"/><T text="Upcoming / unpaid"/> <strong className="ml-auto">{statuses.upcoming}</strong></li></ul>
        </div>
        {statuses.total===0&&<p className="mt-3 text-sm text-slate-500"><T text="No installments due this month."/></p>}
        <button type="button" onClick={()=>props.onNavigate('plans')} className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"><T text="View all installments"/><ChevronRight className="size-4"/></button>
      </article>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 pb-2 pt-4 gap-3"><div className="flex items-center gap-3"><h3 className="font-bold"><T text="Recent payments"/></h3>{props.pending>0&&<button type="button" onClick={()=>props.onNavigate('payments')} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900"><T text="Awaiting review"/> · {props.pending}</button>}</div><button type="button" onClick={()=>props.onNavigate('payments')} className="text-sm font-semibold text-blue-700 hover:underline"><T text="View all"/></button></div>
        <div className="overflow-x-auto"><table className="min-w-[700px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{['Date','Student','Class','Amount','Method','Status',''].map(label=><th key={label||'actions'} className="px-3 py-2"><T text={label}/></th>)}</tr></thead><tbody className="divide-y divide-slate-100">{recentPayments.map(payment=><tr key={payment.id}><td className="whitespace-nowrap px-3 py-2.5">{date(payment.paid_at,locale)}</td><td className="font-medium text-blue-800 px-3 py-2.5">{payment.student_name}</td><td className="px-3 py-2.5">{payment.class_name}</td><td className="whitespace-nowrap px-3 py-2.5 font-semibold">{money(Number(payment.amount),payment.currency_code,locale)}</td><td className="px-3 py-2.5">{payment.payment_method}</td><td className="px-3 py-2.5"><span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800"><T text="Validated"/></span></td><td className="px-3 py-2.5"><FinancePaymentReceiptButton paymentId={payment.id}/></td></tr>)}</tbody></table>{recentPayments.length===0&&<p className="p-6 text-center text-sm text-slate-500"><T text="No validated payments for this month."/></p>}</div>
      </article>
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 pb-2 pt-4"><h3 className="font-bold"><T text="Overdue fees"/></h3><button type="button" onClick={()=>props.onNavigate('payments')} className="text-sm font-semibold text-blue-700 hover:underline"><T text="View all"/></button></div>
        <div className="overflow-x-auto"><table className="min-w-[520px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{['Student','Class','Amount','Delay'].map(label=><th key={label} className="px-3 py-2"><T text={label}/></th>)}</tr></thead><tbody className="divide-y divide-slate-100">{overdueCharges.map(charge=>{const pending=Math.max(0,Number(charge.amount)-Number(charge.adjusted_amount)-Number(charge.paid_amount));return <tr key={charge.id}><td className="px-3 py-2.5 font-medium">{charge.student_name}</td><td className="px-3 py-2.5">{charge.class_name}</td><td className="whitespace-nowrap px-3 py-2.5">{money(pending,charge.currency_code,locale)}</td><td className="whitespace-nowrap px-3 py-2.5 text-red-700">{financeDaysOverdue(charge.due_date,haitiToday())} <T text="days"/></td></tr>})}</tbody></table>{overdueCharges.length===0&&<p className="p-6 text-center text-sm text-slate-500"><T text="No overdue fees."/></p>}</div>
      </article>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between"><h3 className="font-bold"><T text="Upcoming installments"/></h3><button type="button" onClick={()=>props.onNavigate('plans')} className="text-sm font-semibold text-blue-700 hover:underline"><T text="View all"/></button></div>
        <div className="mt-2 overflow-x-auto"><table className="min-w-[540px] w-full text-left text-xs"><thead className="border-y border-slate-100 text-slate-600"><tr>{['Date','Fee','Student','Amount'].map(label=><th key={label} className="px-3 py-2"><T text={label}/></th>)}</tr></thead><tbody className="divide-y divide-slate-100">{upcoming.map(charge=><tr key={charge.id}><td className="whitespace-nowrap px-3 py-2">{date(charge.due_date,locale)}</td><td className="px-3 py-2">{charge.description}</td><td className="px-3 py-2">{charge.student_name}</td><td className="whitespace-nowrap px-3 py-2">{money(Math.max(0,Number(charge.amount)-Number(charge.adjusted_amount)-Number(charge.paid_amount)),charge.currency_code,locale)}</td></tr>)}</tbody></table>{upcoming.length===0&&<p className="p-4 text-sm text-slate-500"><T text="No upcoming installments."/></p>}</div>
      </article>
    </section>


  </div>
}
