'use client'

import {financePaymentMonogram} from '@/lib/finance-payment-methods'

const styles:Record<string,string>={
 MonCash:'bg-orange-500 text-white',NatCash:'bg-red-600 text-white',PayPal:'bg-blue-700 text-white',Zelle:'bg-purple-700 text-white',
 'Bank transfer HTG':'bg-blue-900 text-white','Bank transfer USD':'bg-slate-800 text-white',
}
export default function FinancePaymentMethodLogo({method,bankName}:{method:string;bankName?:string}){
 const label=bankName||method
 const tone=styles[method]||'bg-indigo-700 text-white'
 return <span role="img" aria-label={label+' logo'} title={label} className={'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-1.5 text-[10px] font-extrabold tracking-tight shadow-sm '+tone}>{financePaymentMonogram(method,bankName)}</span>
}