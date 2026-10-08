'use client'

import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react'
import {T} from '@/components/translation-provider'
import {createClient} from '@/lib/supabase/client'
import {FINANCE_PAYMENT_METHODS,familyPaymentMethodsForCurrency,type FinancePaymentMethods} from '@/lib/finance-payment-methods'
import {convertedPaymentValue} from '@/lib/finance-display'
import FamilyFinanceSummary from '@/components/family-finance-summary'

type Charge={id:string;description:string;class_name:string;currency_code:string;due_date:string;remaining_amount:number;pending_amount:number;settled_amount:number}
type Payment={id:string;amount:number;applied_amount?:number;currency_code:string;applied_currency_code?:string;payment_method:string;reference:string|null;paid_at:string;status:string;review_reason:string|null;recorded_at:string;charge_description:string;class_name:string;exchange_rate_snapshot?:number|null;exchange_rate_effective_date?:string|null;exchange_rate_source_url?:string|null}
type Workspace={school_id:string;student:{id:string;first_name:string;last_name:string;class_name:string};settings:{currency_code:string;moncash_payment_instructions:string;natcash_payment_instructions:string;bank_transfer_instructions:string;general_payment_instructions:string;payment_methods:FinancePaymentMethods;brh_rate?:{date:string;rate:number;source_url:string}|null};charges:Charge[];payments:Payment[]}

function localDate(value:string){return new Intl.DateTimeFormat('fr-HT',{dateStyle:'medium',timeZone:'America/Port-au-Prince'}).format(new Date(`${value.slice(0,10)}T12:00:00`))}
function money(value:number,code:string){try{return new Intl.NumberFormat('fr-HT',{style:'currency',currency:code}).format(Number(value))}catch{return `${Number(value).toFixed(2)} ${code}`} }
function destination(method:string,config:FinancePaymentMethods){const entry=FINANCE_PAYMENT_METHODS.find(item=>item.paymentMethod===method);return entry?config[entry.key]:undefined}
function destinationText(method:string,config:FinancePaymentMethods){const item=destination(method,config);if(!item)return '';return [item.account_name,item.phone,item.email,item.bank_name,item.account_number,item.branch,item.max_htg?`Maximum ${item.max_htg} HTG`:null].filter(Boolean).join(' · ')}
function paymentCurrency(method:string,chargeCurrency:string){const entry=FINANCE_PAYMENT_METHODS.find(item=>item.paymentMethod===method);return entry&&(entry.key.endsWith('_usd')||entry.key==='paypal'||entry.key==='zelle')?'USD':chargeCurrency}

export default function FamilyFinancePanel({studentId}:{studentId:string}){
 const db=useMemo(()=>createClient(),[])
 const [data,setData]=useState<Workspace|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const [chargeId,setChargeId]=useState(''),[method,setMethod]=useState(''),[amount,setAmount]=useState(''),[reference,setReference]=useState(''),[proof,setProof]=useState<File|null>(null)
 const load=useCallback(async()=>{if(!studentId){setData(null);setLoading(false);return}setLoading(true);setError('');const {data:result,error:loadError}=await db.rpc('family_finance_workspace',{p_student_id:studentId});if(loadError){setError('Impossible de charger les frais de cet enfant.');setData(null)}else{const value=(Array.isArray(result)?result[0]:result) as Workspace|null;setData(value);if(value?.charges?.length&&!value.charges.some(item=>item.id===chargeId))setChargeId(value.charges[0].id)}setLoading(false)},[db,studentId,chargeId])
 useEffect(()=>{void load()},[load])
 const selectedCharge=data?.charges.find(item=>item.id===chargeId)
 const enabledMethods=familyPaymentMethodsForCurrency(data?.settings.payment_methods,selectedCharge?.currency_code)
 const paymentInstructions=method&&data?destinationText(method,data.settings.payment_methods):''
 const tenderCurrency=selectedCharge?paymentCurrency(method,selectedCharge.currency_code):data?.settings.currency_code||'HTG'
 const usdNeedsRate=tenderCurrency==='USD'&&!data?.settings.brh_rate
 const field='mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900'
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!data||!selectedCharge||!method||!proof)return;setBusy(true);setError('');setNotice('')
  try{
   if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(proof.type)||proof.size>10*1024*1024)throw new Error('Le justificatif doit être un PDF ou une image de 10 Mo maximum.')
   const {data:auth,error:authError}=await db.auth.getUser();if(authError||!auth.user)throw new Error('not_authenticated')
   const safeName=proof.name.toLowerCase().replace(/[^a-z0-9._-]/g,'-').slice(-100)||'justificatif'
   const path=`${data.school_id}/${auth.user.id}/${studentId}/${crypto.randomUUID()}-${safeName}`
   const {error:uploadError}=await db.storage.from('finance-proofs').upload(path,proof,{contentType:proof.type,upsert:false});if(uploadError)throw uploadError
   const {error:submitError}=await db.rpc('submit_family_finance_payment',{p_charge_id:chargeId,p_amount:Number(amount),p_payment_method:method,p_reference:reference.trim(),p_proof_storage_path:path});if(submitError)throw submitError
   setAmount('');setReference('');setMethod('');setProof(null);setNotice('Votre demande de paiement a été transmise à l’école. Elle reste en attente de validation.');await load()
  }catch(cause){setError(cause instanceof Error?cause.message:'Impossible de transmettre le paiement.')}finally{setBusy(false)}
 }
 return <section className="my-7 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
  <div><h2 className="text-2xl font-bold"><T text="School payments"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Review this child's due fees and submit proof of a digital payment. The school will verify it before posting it."/></p></div>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><T text={error}/></p>}{notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  {loading?<p className="text-sm text-slate-500"><T text="Loading..."/></p>:!data?<p className="text-sm text-slate-600"><T text="No finance information is available for this child."/></p>:<>
   <FamilyFinanceSummary key={studentId+'summary'} studentId={studentId}/>
   <div className="grid gap-4 lg:grid-cols-2">
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 p-4">
     <h3 className="font-semibold"><T text="Submit a payment request"/></h3>
     <label className="block text-sm"><T text="Fee / installment"/><select required className={field} value={chargeId} onChange={event=>{setChargeId(event.target.value);setMethod('')}}><option value=""><T text="Choose"/></option>{data.charges.map(item=><option key={item.id} value={item.id}>{item.description} · {item.class_name} · {localDate(item.due_date)} · {money(Number(item.remaining_amount),item.currency_code)}</option>)}</select></label>
     {selectedCharge&&<p className="text-xs text-slate-600"><T text="Amount still due"/>: {money(Number(selectedCharge.remaining_amount),selectedCharge.currency_code)}{Number(selectedCharge.pending_amount)>0&&<> · <T text="Already submitted"/>: {money(Number(selectedCharge.pending_amount),selectedCharge.currency_code)}</>}</p>}
     <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm"><T text="Payment method"/><select required className={field} value={method} onChange={event=>{setMethod(event.target.value);setAmount('')}}><option value=""><T text="Choose"/></option>{enabledMethods.map(item=>{const usd=item.key.endsWith('_usd')||item.key==='paypal'||item.key==='zelle';return <option key={item.key} value={item.paymentMethod} disabled={usd&&!data.settings.brh_rate}><T text={item.title}/>{usd&&!data.settings.brh_rate?' — indisponible (taux BRH du jour manquant)':''}</option>})}</select></label><label className="block text-sm"><T text="Amount paid"/> ({tenderCurrency})<input type="number" min="0.01" step="0.01" required className={field} value={amount} onChange={event=>setAmount(event.target.value)}/></label></div>
     {!enabledMethods.length&&selectedCharge&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><T text="The school has not enabled a digital payment method for this currency."/></p>}
     {method&&<div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950"><p className="font-semibold"><T text="Where to pay"/> · {method}</p><p className="mt-1">{paymentInstructions}</p>{tenderCurrency==='USD'&&data.settings.brh_rate&&<p className="mt-2"><T text="Current BRH reference rate"/>: {data.settings.brh_rate.rate} HTG/USD · {data.settings.brh_rate.date}{selectedCharge?.currency_code==='HTG'&&Number(amount)>0&&<> · <T text="Approximate HTG equivalent"/>: {money(Number(amount)*Number(data.settings.brh_rate.rate),'HTG')}</>}</p>}{usdNeedsRate&&<p className="mt-2 text-red-800"><T text="USD validation is unavailable until the BRH publishes today's rate."/></p>}</div>}
     <label className="block text-sm"><T text="Transaction reference"/><input required maxLength={120} className={field} value={reference} onChange={event=>setReference(event.target.value)}/></label>
     <label className="block text-sm"><T text="Proof of payment"/><input required type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className={field} onChange={event=>setProof(event.target.files?.[0]||null)}/><span className="mt-1 block text-xs text-slate-500"><T text="Upload the receipt or transfer confirmation (PDF or image, maximum 10 MB)."/></span></label>
     <button disabled={busy||!selectedCharge||!method||!proof||!enabledMethods.length||usdNeedsRate} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy?<T text="Saving..."/>:<T text="Send for school approval"/>}</button>
     {!data.charges.length&&<p className="text-sm text-slate-600"><T text="There are no due fees for this child right now."/></p>}
    </form>
    <div className="space-y-3 rounded-xl border border-slate-200 p-4"><h3 className="font-semibold"><T text="Payment instructions"/></h3><p className="text-sm text-slate-600"><T text="Make the payment through the selected service, then attach its reference and proof here. AtechOS does not debit your wallet or bank account."/></p>
     {data.settings.general_payment_instructions&&<p className="whitespace-pre-wrap rounded-lg bg-blue-50 p-3 text-sm">{data.settings.general_payment_instructions}</p>}
     {FINANCE_PAYMENT_METHODS.filter(item=>data.settings.payment_methods?.[item.key]?.enabled).map(item=><article key={item.key} className="rounded-lg bg-slate-50 p-3 text-sm"><h4 className="font-semibold"><T text={item.title}/></h4><p className="mt-1">{destinationText(item.paymentMethod,data.settings.payment_methods)}</p></article>)}
     {!FINANCE_PAYMENT_METHODS.some(item=>data.settings.payment_methods?.[item.key]?.enabled)&&<p className="text-sm text-amber-800"><T text="The school has not entered payment details yet."/></p>}
    </div>
   </div>
   <div className="space-y-2"><h3 className="font-semibold"><T text="My payment requests"/></h3>{data.payments.map(payment=><article key={payment.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"><div><p className="font-medium">{payment.charge_description} · {payment.class_name}</p><p className="mt-1 text-slate-600">{payment.payment_method} · {payment.reference||'—'} · <T text="Amount paid"/>: {money(Number(payment.amount),payment.currency_code)}</p>{convertedPaymentValue(payment)!==null&&<p className="mt-1 text-slate-600"><T text="Converted at validation"/>: {money(convertedPaymentValue(payment)!, 'HTG')}</p>}{payment.status==='validated'&&payment.applied_currency_code&&<p className="mt-1 text-slate-600"><T text="Applied to fee"/>: {money(Number(payment.applied_amount||0),payment.applied_currency_code)}</p>}{payment.exchange_rate_snapshot&&<p className="mt-1 text-slate-600"><T text="BRH rate snapshot"/>: {payment.exchange_rate_snapshot} HTG/USD · {payment.exchange_rate_effective_date} · <a className="underline" href={payment.exchange_rate_source_url||'https://www.brh.ht/politique-monetaire/taux-de-change/'} target="_blank" rel="noreferrer"><T text="Official source"/></a></p>}{payment.review_reason&&<p className="mt-1 text-red-700">{payment.review_reason}</p>}</div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${payment.status==='validated'?'bg-emerald-100 text-emerald-800':payment.status==='rejected'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-900'}`}><T text={payment.status==='validated'?'Validated':payment.status==='rejected'?'Rejected':'Pending validation'}/></span></article>)}{!data.payments.length&&<p className="text-sm text-slate-500"><T text="No payment requests yet."/></p>}</div>
  </>}
 </section>
}
