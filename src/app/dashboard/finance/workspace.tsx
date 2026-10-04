'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { T, useLocale } from '@/components/translation-provider'
import SchoolDateInput from '@/components/school-date-input'
import { createClient } from '@/lib/supabase/client'
import { schoolDateTimeToISO } from '@/lib/school-date'
import { translate } from '@/lib/translations'

type Year = { id: string; name: string; start_date: string; end_date: string; is_current: boolean }
type ClassItem = { id: string; name: string; academic_year_id: string; enabled: boolean }
type Installment = { id: string; installment_number: number; amount: number; due_date: string }
type Plan = { id: string; academic_year_id: string; academic_year_name: string; class_id: string; class_name: string; fee_type: string; label: string; currency_code: string; active: boolean; created_at: string; installments: Installment[] }
type Charge = { id: string; student_id: string; academic_year_id: string; class_id: string; fee_plan_id: string; fee_installment_id: string; fee_type: string; description: string; amount: number; currency_code: string; due_date: string; student_name: string; student_code: string; class_name: string; academic_year_name: string; adjusted_amount: number; paid_amount: number; pending_amount: number }
type Payment = { id: string; charge_id: string; amount: number; applied_amount: number; currency_code: string; payment_method: string; reference: string | null; proof_storage_path: string | null; paid_at: string; status: string; recorded_by: string; recorded_at: string; reviewed_by: string | null; review_reason: string | null; student_name: string; charge_description: string; class_name: string; charge_paid: number }
type Adjustment = { id: string; charge_id: string; adjustment_type: string; amount: number; currency_code: string; reason: string; valid_from: string | null; valid_until: string | null; status: string; student_name: string; charge_description: string; created_at: string; review_reason: string | null }
type AuditEvent = { id: number; actor_id: string | null; actor_role: string | null; actor_name: string | null; entity: string; action: string; occurred_at: string; before_data: unknown; after_data: unknown }
type StudentCredit = { student_id: string; student_name: string; currency_code: string; amount: number }
type Settings = { currency_code: string; director_can_validate: boolean; proof_required: boolean; restrict_kiosk: boolean; restrict_exams: boolean; restrict_bulletins: boolean; updated_at: string; updated_by: string }
type WorkspaceData = { settings: Settings | null; years: Year[]; classes: ClassItem[]; summary: { expected: number; paid: number; pending_payments: number; validated_payment_count: number; balance: number }; plans: Plan[]; charges: Charge[]; payments: Payment[]; adjustments: Adjustment[]; credits: StudentCredit[]; audit: AuditEvent[]; can_manage: boolean; can_validate: boolean; can_record: boolean }
type InstallmentDraft = { amount: string; due_date: string }

const blank: WorkspaceData = { settings: null, years: [], classes: [], summary: { expected: 0, paid: 0, pending_payments: 0, validated_payment_count: 0, balance: 0 }, plans: [], charges: [], payments: [], adjustments: [], credits: [], audit: [], can_manage: false, can_validate: false, can_record: false }
const feeTypes = ['inscription', 'rentree', 'class_fee'] as const
const paymentMethods = ['Cash', 'Bank transfer', 'Check', 'MonCash', 'NatCash', 'Other'] as const
const adjustmentTypes = ['scholarship', 'half_scholarship', 'discount', 'exception', 'manual_exemption', 'temporary_clearance'] as const
const haitiToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port-au-Prince' }).format(new Date())

function money(amount: number, code: string, locale: string) {
  try { return new Intl.NumberFormat(locale === 'fr' ? 'fr-HT' : locale === 'ht' ? 'ht-HT' : 'en-US', { style: 'currency', currency: code }).format(amount) }
  catch { return `${Number(amount).toFixed(2)} ${code}` }
}
function dateLabel(value: string, locale: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale === 'fr' ? 'fr-HT' : locale === 'ht' ? 'ht-HT' : 'en-US', { dateStyle: 'medium', timeZone: 'America/Port-au-Prince' }).format(date)
}
function remaining(charge: Charge) { return Math.max(0, Number(charge.amount) - Number(charge.adjusted_amount) - Number(charge.paid_amount)) }
function feeLabel(type: string) { return type === 'inscription' ? 'Registration fee' : type === 'rentree' ? 'Back-to-school fee' : 'Class fee' }
function adjustmentLabel(type: string) {
  const labels: Record<string, string> = { scholarship: 'Scholarship', half_scholarship: 'Half scholarship', discount: 'Discount', exception: 'Exception', manual_exemption: 'Manual exemption', temporary_clearance: 'Temporary clearance' }
  return labels[type] || type
}

export default function FinanceWorkspace({ schoolId }: { schoolId: string }) {
  const locale = useLocale()
  const db = useMemo(() => createClient(), [])
  const [data, setData] = useState(blank)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState<'overview' | 'plans' | 'payments' | 'adjustments' | 'history'>('overview')
  const [yearId, setYearId] = useState('')
  const [classId, setClassId] = useState('')
  const [feeType, setFeeType] = useState<(typeof feeTypes)[number]>('inscription')
  const [planLabel, setPlanLabel] = useState('')
  const [installments, setInstallments] = useState<InstallmentDraft[]>([{ amount: '', due_date: '' }])
  const [chargeId, setChargeId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [otherPaymentMethod, setOtherPaymentMethod] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentDate, setPaymentDate] = useState(haitiToday())
  const [proof, setProof] = useState<File | null>(null)
  const [adjustmentCharge, setAdjustmentCharge] = useState('')
  const [adjustmentType, setAdjustmentType] = useState<(typeof adjustmentTypes)[number]>('scholarship')
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [clearanceFrom, setClearanceFrom] = useState('')
  const [clearanceUntil, setClearanceUntil] = useState('')
  const [currencyCode, setCurrencyCode] = useState('')
  const [directorCanValidate, setDirectorCanValidate] = useState(false)
  const [proofRequired, setProofRequired] = useState(false)
  const [restrictKiosk, setRestrictKiosk] = useState(false)
  const [restrictExams, setRestrictExams] = useState(false)
  const [restrictBulletins, setRestrictBulletins] = useState(false)
  const loadSequence = useRef(0)

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    setError('')
    try {
      const { data: result, error: loadError } = await db.rpc('finance_workspace', { p_academic_year_id: yearId || null, p_class_id: classId || null })
      if (loadError) throw loadError
      if (sequence !== loadSequence.current) return
      const next = (Array.isArray(result) ? result[0] : result) as WorkspaceData | null
      if (!next) throw new Error('finance_workspace_empty')
      setData({ ...blank, ...next })
      if (!yearId && next.years?.length) setYearId(next.years.find(year => year.is_current)?.id || next.years[0].id)
      if (next.settings) {
        setCurrencyCode(next.settings.currency_code)
        setDirectorCanValidate(next.settings.director_can_validate)
        setProofRequired(next.settings.proof_required)
        setRestrictKiosk(next.settings.restrict_kiosk)
        setRestrictExams(next.settings.restrict_exams)
        setRestrictBulletins(next.settings.restrict_bulletins)
      }
    } catch (cause) { if (sequence === loadSequence.current) setError(cause instanceof Error ? cause.message : 'finance_load_failed') }
    finally { if (sequence === loadSequence.current) setLoading(false) }
  }, [db, yearId, classId])

  useEffect(() => { void load() }, [load])
  const selectedClasses = data.classes.filter(item => item.academic_year_id === yearId && item.enabled)
  const selectedCharges = data.charges.filter(item => (!yearId || item.academic_year_id === yearId) && (!classId || item.class_id === classId))
  const paymentOptions = selectedCharges.filter(charge => remaining(charge) > 0)
  const pendingPayments = data.payments.filter(payment => payment.status === 'pending')
  const totalExpected = Number(data.summary.expected)
  const totalPaid = Number(data.summary.paid)
  const totalBalance = Number(data.summary.balance)
  const code = data.settings?.currency_code || currencyCode
  const tr = (text: string) => translate(text, locale)
  const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
  const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'
  const buttonClass = 'rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50'

  async function complete(action: () => Promise<void>, success: string) {
    setSaving(true); setError(''); setNotice('')
    try { await action(); setNotice(success); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'finance_action_failed') }
    finally { setSaving(false) }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await complete(async () => {
      const { error: actionError } = await db.rpc('save_finance_settings', { p_currency_code: currencyCode.trim().toUpperCase(), p_director_can_validate: directorCanValidate, p_proof_required: proofRequired, p_restrict_kiosk: restrictKiosk, p_restrict_exams: restrictExams, p_restrict_bulletins: restrictBulletins })
      if (actionError) throw actionError
    }, 'Finance settings saved.')
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await complete(async () => {
      const { error: actionError } = await db.rpc('create_finance_fee_plan', { p_academic_year_id: yearId, p_class_id: classId, p_fee_type: feeType, p_label: planLabel, p_installments: installments.map(item => ({ amount: Number(item.amount), due_date: item.due_date })) })
      if (actionError) throw actionError
      setPlanLabel(''); setInstallments([{ amount: '', due_date: '' }])
    }, 'Fee plan created.')
  }

  async function issuePlan(plan: Plan) {
    if (!window.confirm(`${plan.label} — ${plan.class_name}: ${tr('Generate charges for currently enrolled students?')}`)) return
    await complete(async () => {
      const { error: actionError } = await db.rpc('issue_finance_fee_plan', { p_fee_plan_id: plan.id })
      if (actionError) throw actionError
    }, 'Charges generated. Repeating this action will not duplicate charges.')
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await complete(async () => {
      const { data: authData, error: authError } = await db.auth.getUser()
      if (authError || !authData.user) throw new Error('not_authenticated')
      let proofPath: string | null = null
      if (proof) {
        if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(proof.type) || proof.size > 10 * 1024 * 1024) throw new Error('Proof must be a PDF or image up to 10 MB.')
        const safeName = proof.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(-100) || 'proof'
        proofPath = `${schoolId}/${authData.user.id}/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await db.storage.from('finance-proofs').upload(proofPath, proof, { contentType: proof.type, upsert: false })
        if (uploadError) throw uploadError
      }
      const paidAt = schoolDateTimeToISO(`${paymentDate}T12:00`)
      const recordedMethod = paymentMethod === 'Other' ? otherPaymentMethod.trim() : paymentMethod
      if (!recordedMethod) throw new Error('Choose or enter a payment method.')
      const { error: actionError } = await db.rpc('record_finance_payment', { p_charge_id: chargeId, p_amount: Number(paymentAmount), p_payment_method: recordedMethod, p_reference: paymentReference || null, p_proof_storage_path: proofPath, p_paid_at: paidAt })
      if (actionError) throw actionError
      setPaymentAmount(''); setPaymentMethod(''); setOtherPaymentMethod(''); setPaymentReference(''); setProof(null)
    }, 'Payment recorded and sent for validation.')
  }

  async function reviewPayment(payment: Payment, decision: 'validated' | 'rejected') {
    const reason = decision === 'rejected' ? window.prompt('Explain why this payment is rejected (at least 3 characters):') : ''
    if (decision === 'rejected' && (!reason || reason.trim().length < 3)) return
    await complete(async () => {
      const { error: actionError } = await db.rpc('review_finance_payment', { p_payment_id: payment.id, p_decision: decision, p_reason: reason || null })
      if (actionError) throw actionError
    }, decision === 'validated' ? 'Payment validated. Linked parents received an in-app notice.' : 'Payment rejected with an audit reason.')
  }

  async function requestAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await complete(async () => {
      const temporary = adjustmentType === 'temporary_clearance'
      const { error: actionError } = await db.rpc('request_finance_adjustment', { p_charge_id: adjustmentCharge, p_adjustment_type: adjustmentType, p_amount: temporary ? 0 : Number(adjustmentAmount), p_reason: adjustmentReason, p_valid_from: temporary ? schoolDateTimeToISO(clearanceFrom) : null, p_valid_until: temporary ? schoolDateTimeToISO(clearanceUntil) : null })
      if (actionError) throw actionError
      setAdjustmentAmount(''); setAdjustmentReason(''); setClearanceFrom(''); setClearanceUntil('')
    }, 'Finance request submitted for review.')
  }

  async function reviewAdjustment(item: Adjustment, decision: 'approved' | 'rejected') {
    const reason = decision === 'rejected' ? window.prompt('Explain why this request is rejected (at least 3 characters):') : ''
    if (decision === 'rejected' && (!reason || reason.trim().length < 3)) return
    await complete(async () => {
      const { error: actionError } = await db.rpc('review_finance_adjustment', { p_adjustment_id: item.id, p_decision: decision, p_reason: reason || null })
      if (actionError) throw actionError
    }, 'Finance request updated.')
  }

  async function revokeAdjustment(item: Adjustment) {
    const reason = window.prompt('Reason for revoking this approved adjustment:')
    if (!reason || reason.trim().length < 3) return
    await complete(async () => {
      const { error: actionError } = await db.rpc('revoke_finance_adjustment', { p_adjustment_id: item.id, p_reason: reason })
      if (actionError) throw actionError
    }, 'Approved adjustment revoked. Its history remains available.')
  }

  async function openProof(path: string) {
    const { data: signed, error: proofError } = await db.storage.from('finance-proofs').createSignedUrl(path, 60)
    if (proofError || !signed?.signedUrl) { setError(proofError?.message || 'proof_unavailable'); return }
    window.open(signed.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const activeTab = (key: typeof tab, label: string) => <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === key ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}><T text={label}/></button>

  if (loading) return <main className="mx-auto max-w-7xl p-6"><p className="text-slate-600"><T text="Loading finance workspace…"/></p></main>

  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700"><T text="School management"/></p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950"><T text="Finance & Accounting"/></h1><p className="mt-2 max-w-3xl text-sm text-slate-600"><T text="Manage class fees, due dates, partial payments, approvals, scholarships and audit history."/></p></div>
      <label className="min-w-52 text-sm font-medium text-slate-700"><T text="Academic year"/><select value={yearId} onChange={event => { setYearId(event.target.value); setClassId('') }} className={`${fieldClass} mt-1`}><option value=""><T text="Choose"/></option>{data.years.map(year => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
    </header>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><T text={notice}/></p>}
    {!data.settings && <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><strong><T text="Set up Finance before creating fees."/></strong><p className="mt-1"><T text="A school manager must choose a currency before fee plans and payments can be recorded."/></p></section>}

    <nav aria-label="Finance sections" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      {activeTab('overview','Overview')}{activeTab('plans','Fee plans')}{activeTab('payments','Payments')}{activeTab('adjustments','Scholarships & clearances')}{activeTab('history','Audit history')}
    </nav>

    {tab === 'overview' && <>
      <section className="grid gap-4 sm:grid-cols-3">
        {([['Expected',totalExpected],['Validated payments',totalPaid],['Balance remaining',totalBalance]] as const).map(([label,value]) => <article key={label} className={cardClass}><p className="text-sm font-medium text-slate-600"><T text={label}/></p><p className="mt-2 text-2xl font-bold text-slate-950">{code ? money(Number(value),code,locale) : '—'}</p></article>)}
      </section>
      {data.credits.length>0&&<section className={`${cardClass} space-y-3`}><div><h2 className="text-lg font-semibold"><T text="Available student credits"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Overpayments are applied automatically to the student’s next outstanding fees; this is the remaining unapplied credit."/></p></div><ul className="divide-y divide-slate-100">{data.credits.map((credit,index)=><li key={`${credit.student_id}-${credit.currency_code}-${index}`} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span className="font-medium">{credit.student_name}</span><span className="font-semibold">{money(Number(credit.amount),credit.currency_code,locale)}</span></li>)}</ul></section>}
      <section className={cardClass}><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-950"><T text="Student balances"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Balances use validated payments and approved adjustments only."/></p></div><label className="min-w-56 text-sm text-slate-700"><T text="Class filter"/><select className={`${fieldClass} mt-1`} value={classId} onChange={event => setClassId(event.target.value)}><option value=""><T text="All classes"/></option>{selectedClasses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr>{['Student','Class','Fee','Due date','Expected','Paid','Pending','Balance'].map(title => <th key={title} className="px-3 py-3"><T text={title}/></th>)}</tr></thead><tbody className="divide-y divide-slate-100">{selectedCharges.map(charge => <tr key={charge.id}><td className="px-3 py-3 font-medium text-slate-900">{charge.student_name}</td><td className="px-3 py-3">{charge.class_name}</td><td className="px-3 py-3">{charge.description}</td><td className="px-3 py-3">{dateLabel(charge.due_date,locale)}</td><td className="px-3 py-3">{money(Number(charge.amount)-Number(charge.adjusted_amount),charge.currency_code,locale)}</td><td className="px-3 py-3">{money(Number(charge.paid_amount),charge.currency_code,locale)}</td><td className="px-3 py-3">{money(Number(charge.pending_amount),charge.currency_code,locale)}</td><td className="px-3 py-3 font-semibold">{money(remaining(charge),charge.currency_code,locale)}</td></tr>)}</tbody></table>{selectedCharges.length===0&&<p className="p-6 text-center text-sm text-slate-500"><T text="No fee charges for this academic year yet."/></p>}</div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2"><article className={cardClass}><p className="text-sm text-slate-600"><T text="Payments awaiting review"/></p><p className="mt-2 text-2xl font-bold">{data.summary.pending_payments}</p></article><article className={cardClass}><p className="text-sm text-slate-600"><T text="Validated payments"/></p><p className="mt-2 text-2xl font-bold">{data.summary.validated_payment_count}</p></article></section>
    </>}

    {tab === 'plans' && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {data.can_manage && <form onSubmit={savePlan} className={`${cardClass} space-y-4`}><div><h2 className="text-lg font-semibold"><T text="Create a class fee plan"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Fee installments will become student charges for active enrollments in the selected class and year."/></p></div>
        <label className="block text-sm"><T text="Class"/><select required className={`${fieldClass} mt-1`} value={classId} onChange={event=>setClassId(event.target.value)}><option value=""><T text="Choose"/></option>{selectedClasses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="block text-sm"><T text="Fee category"/><select className={`${fieldClass} mt-1`} value={feeType} onChange={event=>setFeeType(event.target.value as typeof feeType)}>{feeTypes.map(type=><option key={type} value={type}>{tr(feeLabel(type))}</option>)}</select></label>
        <label className="block text-sm"><T text="Fee name"/><input required minLength={2} maxLength={120} className={`${fieldClass} mt-1`} value={planLabel} onChange={event=>setPlanLabel(event.target.value)}/></label>
        <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-medium"><T text="Installments and due dates"/></h3><button type="button" onClick={()=>setInstallments(value=>[...value,{amount:'',due_date:''}])} className="text-sm font-semibold text-blue-700"><T text="Add installment"/></button></div>{installments.map((item,index)=><div key={index} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"><label className="text-sm"><T text="Amount"/> ({code})<input type="number" min="0.01" step="0.01" required className={`${fieldClass} mt-1`} value={item.amount} onChange={event=>setInstallments(value=>value.map((row,i)=>i===index?{...row,amount:event.target.value}:row))}/></label><label className="text-sm"><T text="Due date"/><SchoolDateInput type="date" min={data.years.find(year=>year.id===yearId)?.start_date} max={data.years.find(year=>year.id===yearId)?.end_date} required className={`${fieldClass} mt-1`} value={item.due_date} onChange={event=>setInstallments(value=>value.map((row,i)=>i===index?{...row,due_date:event.target.value}:row))}/></label>{installments.length>1&&<button type="button" className="text-left text-sm text-red-700 sm:col-span-2" onClick={()=>setInstallments(value=>value.filter((_,i)=>i!==index))}><T text="Remove installment"/></button>}</div>)}</div>
        <button className={buttonClass} disabled={saving||!data.settings||!classId||!yearId}><T text="Save fee plan"/></button>
      </form>}
      <section className={`${cardClass} space-y-3`}><h2 className="text-lg font-semibold"><T text="Fee plans"/></h2>{data.plans.filter(plan=>!yearId||plan.academic_year_id===yearId).map(plan=><article key={plan.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{plan.label}</p><p className="mt-1 text-sm text-slate-600">{plan.class_name} · {plan.academic_year_name} · <T text={feeLabel(plan.fee_type)}/></p></div>{data.can_manage&&<button disabled={saving||!plan.active} className={buttonClass} onClick={()=>void issuePlan(plan)}><T text="Generate charges"/></button>}</div><ul className="mt-3 space-y-1 text-sm">{plan.installments.map(item=><li key={item.id} className="flex justify-between gap-3"><span><T text="Installment"/> {item.installment_number} · {dateLabel(item.due_date,locale)}</span><span className="font-medium">{money(Number(item.amount),plan.currency_code,locale)}</span></li>)}</ul></article>)}{data.plans.length===0&&<p className="text-sm text-slate-500"><T text="No fee plans yet."/></p>}</section>
    </div>}

    {tab === 'payments' && <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      {data.can_record&&<form onSubmit={recordPayment} className={`${cardClass} space-y-4`}><div><h2 className="text-lg font-semibold"><T text="Record a payment"/></h2><p className="mt-1 text-sm text-slate-600"><T text="A recorded payment remains pending until an authorized person validates it."/></p></div>
        <label className="block text-sm"><T text="Student fee"/><select required className={`${fieldClass} mt-1`} value={chargeId} onChange={event=>setChargeId(event.target.value)}><option value=""><T text="Choose"/></option>{paymentOptions.map(item=><option key={item.id} value={item.id}>{item.student_name} · {item.description} · {money(remaining(item),item.currency_code,locale)}</option>)}</select></label>
        {paymentOptions.find(item=>item.id===chargeId&&['inscription','rentree'].includes(item.fee_type))&&<p className="-mt-2 text-xs text-slate-600 sm:col-span-2"><T text="If this entry fee is overpaid, the extra amount becomes student credit and is applied automatically to the next outstanding fees."/></p>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm"><T text="Amount"/> ({code})<input type="number" required min="0.01" step="0.01" className={`${fieldClass} mt-1`} value={paymentAmount} onChange={event=>setPaymentAmount(event.target.value)}/></label><label className="text-sm"><T text="Payment method"/><select required className={`${fieldClass} mt-1`} value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value)}><option value=""><T text="Choose"/></option>{paymentMethods.map(method=><option key={method} value={method}>{tr(method)}</option>)}</select></label>{paymentMethod==='Other'&&<label className="text-sm"><T text="Specify payment method"/><input required minLength={2} maxLength={60} className={`${fieldClass} mt-1`} value={otherPaymentMethod} onChange={event=>setOtherPaymentMethod(event.target.value)}/></label>}</div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm"><T text="Payment date"/><SchoolDateInput type="date" required className={`${fieldClass} mt-1`} value={paymentDate} max={haitiToday()} onChange={event=>setPaymentDate(event.target.value)}/></label><label className="text-sm"><T text="Reference"/><input maxLength={120} className={`${fieldClass} mt-1`} value={paymentReference} onChange={event=>setPaymentReference(event.target.value)}/></label></div>
        <label className="block text-sm"><T text="Proof of payment"/>{data.settings?.proof_required&&<span className="ml-1 text-red-700">*</span>}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required={Boolean(data.settings?.proof_required)} className={`${fieldClass} mt-1`} onChange={event=>setProof(event.target.files?.[0]||null)}/><span className="mt-1 block text-xs text-slate-500"><T text="Private file, PDF or image, maximum 10 MB."/></span></label>
        <button disabled={saving||!chargeId||!data.settings} className={buttonClass}><T text="Record for validation"/></button>
      </form>}
      <section className={`${cardClass} space-y-3`}><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold"><T text="Payment history"/></h2>{data.can_validate&&<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{pendingPayments.length} <T text="awaiting review"/></span>}</div>{data.payments.map(payment=><article key={payment.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{payment.student_name} · {money(Number(payment.amount),payment.currency_code,locale)}</p><p className="mt-1 text-sm text-slate-600">{payment.charge_description} · {payment.class_name} · {dateLabel(payment.paid_at,locale)}</p><p className="mt-1 text-xs text-slate-500"><T text="Method"/>: {payment.payment_method} · <T text="Reference"/>: {payment.reference||'—'}</p>{payment.review_reason&&<p className="mt-1 text-sm text-red-700">{payment.review_reason}</p>}</div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${payment.status==='validated'?'bg-emerald-100 text-emerald-800':payment.status==='rejected'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-900'}`}><T text={payment.status==='validated'?'Validated':payment.status==='rejected'?'Rejected':'Pending validation'}/></span></div><div className="mt-3 flex flex-wrap gap-2">{payment.proof_storage_path&&<button type="button" onClick={()=>void openProof(payment.proof_storage_path!)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"><T text="Open proof"/></button>}{payment.status==='pending'&&data.can_validate&&<><button type="button" disabled={saving} onClick={()=>void reviewPayment(payment,'validated')} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white"><T text="Validate"/></button><button type="button" disabled={saving} onClick={()=>void reviewPayment(payment,'rejected')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700"><T text="Reject with reason"/></button></>}</div></article>)}{data.payments.length===0&&<p className="text-sm text-slate-500"><T text="No payments recorded yet."/></p>}</section>
    </div>}

    {tab === 'adjustments' && <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      {data.can_manage&&<form onSubmit={requestAdjustment} className={`${cardClass} space-y-4`}><h2 className="text-lg font-semibold"><T text="Scholarships, exceptions and clearances"/></h2><label className="block text-sm"><T text="Student fee"/><select required className={`${fieldClass} mt-1`} value={adjustmentCharge} onChange={event=>setAdjustmentCharge(event.target.value)}><option value=""><T text="Choose"/></option>{selectedCharges.map(item=><option key={item.id} value={item.id}>{item.student_name} · {item.description} · {money(remaining(item),item.currency_code,locale)}</option>)}</select></label><label className="block text-sm"><T text="Request type"/><select className={`${fieldClass} mt-1`} value={adjustmentType} onChange={event=>setAdjustmentType(event.target.value as typeof adjustmentType)}>{adjustmentTypes.map(type=><option key={type} value={type}>{tr(adjustmentLabel(type))}</option>)}</select></label>{adjustmentType!=='temporary_clearance'&&<label className="block text-sm"><T text="Approved reduction amount"/> ({code})<input type="number" min="0.01" step="0.01" required className={`${fieldClass} mt-1`} value={adjustmentAmount} onChange={event=>setAdjustmentAmount(event.target.value)}/></label>}{adjustmentType==='temporary_clearance'&&<div className="grid gap-3 sm:grid-cols-2"><label className="text-sm"><T text="Clearance starts"/><SchoolDateInput type="datetime-local" required className={`${fieldClass} mt-1`} value={clearanceFrom} onChange={event=>setClearanceFrom(event.target.value)}/></label><label className="text-sm"><T text="Clearance expires"/><SchoolDateInput type="datetime-local" required className={`${fieldClass} mt-1`} value={clearanceUntil} onChange={event=>setClearanceUntil(event.target.value)}/></label><p className="text-xs text-slate-500 sm:col-span-2"><T text="Temporary clearance does not remove or reduce the outstanding balance."/></p></div>}<label className="block text-sm"><T text="Reason"/><textarea required minLength={3} maxLength={500} className={`${fieldClass} mt-1`} value={adjustmentReason} onChange={event=>setAdjustmentReason(event.target.value)}/></label><button disabled={saving||!adjustmentCharge} className={buttonClass}><T text="Submit for approval"/></button></form>}
      <section className={`${cardClass} space-y-3`}><h2 className="text-lg font-semibold"><T text="Adjustment history"/></h2>{data.adjustments.map(item=><article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{item.student_name} · <T text={adjustmentLabel(item.adjustment_type)}/></p><p className="mt-1 text-sm text-slate-600">{item.charge_description} · {item.reason}</p>{item.adjustment_type==='temporary_clearance'&&<p className="mt-1 text-xs text-slate-500">{item.valid_from&&dateLabel(item.valid_from,locale)} — {item.valid_until&&dateLabel(item.valid_until,locale)}</p>}{item.amount>0&&<p className="mt-1 text-sm">{money(Number(item.amount),item.currency_code,locale)}</p>}</div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold"><T text={item.status==='approved'?'Approved':item.status==='rejected'?'Rejected':item.status==='revoked'?'Revoked':'Pending validation'}/></span></div><p className="mt-2 text-sm">{item.review_reason}</p><div className="mt-3 flex flex-wrap gap-2">{item.status==='pending'&&data.can_manage&&<><button disabled={saving} onClick={()=>void reviewAdjustment(item,'approved')} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white"><T text="Approve"/></button><button disabled={saving} onClick={()=>void reviewAdjustment(item,'rejected')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700"><T text="Reject with reason"/></button></>}{item.status==='approved'&&data.can_manage&&<button disabled={saving} onClick={()=>void revokeAdjustment(item)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"><T text="Revoke with reason"/></button>}</div></article>)}{data.adjustments.length===0&&<p className="text-sm text-slate-500"><T text="No scholarship or clearance requests yet."/></p>}</section>
    </div>}

    {tab === 'history' && <section className={`${cardClass} space-y-3`}><h2 className="text-lg font-semibold"><T text="Immutable audit history"/></h2><p className="text-sm text-slate-600"><T text="Finance changes keep the actor, role, timestamp and before/after values. Audit rows cannot be edited through the app."/></p><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr>{['When','Actor','Role','Record','Action','Details'].map(label=><th key={label} className="px-3 py-3"><T text={label}/></th>)}</tr></thead><tbody className="divide-y">{data.audit.map(event=><tr key={event.id}><td className="px-3 py-3">{new Intl.DateTimeFormat(locale==='fr'?'fr-HT':locale==='ht'?'ht-HT':'en-US',{dateStyle:'short',timeStyle:'short',timeZone:'America/Port-au-Prince'}).format(new Date(event.occurred_at))}</td><td className="px-3 py-3">{event.actor_name||'—'}</td><td className="px-3 py-3"><T text={event.actor_role||'System'}/></td><td className="px-3 py-3">{event.entity}</td><td className="px-3 py-3"><T text={event.action}/></td><td className="max-w-md px-3 py-3"><details><summary className="cursor-pointer text-blue-700"><T text="View change"/></summary><pre className="mt-2 max-w-full overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2 text-xs">{JSON.stringify(event.after_data||event.before_data,null,2)}</pre></details></td></tr>)}</tbody></table>{data.audit.length===0&&<p className="p-6 text-center text-sm text-slate-500"><T text="No finance actions have been recorded."/></p>}</div></section>}

    {data.can_manage&&<form onSubmit={saveSettings} className={`${cardClass} grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]`}><div><h2 className="text-lg font-semibold"><T text="Finance settings"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Only school managers can change currency and critical finance rules. Secretaries cannot change these settings."/></p></div><div className="space-y-3"><label className="block text-sm"><T text="Currency code"/><input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" className={`${fieldClass} mt-1 uppercase`} placeholder="HTG" value={currencyCode} onChange={event=>setCurrencyCode(event.target.value.toUpperCase())}/></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={directorCanValidate} onChange={event=>setDirectorCanValidate(event.target.checked)}/><span><T text="Allow the director to validate payments."/></span></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={proofRequired} onChange={event=>setProofRequired(event.target.checked)}/><span><T text="Require proof before a payment can be validated."/></span></label><fieldset className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3"><legend className="px-1 text-sm font-semibold text-slate-900"><T text="Optional overdue-fee restrictions"/></legend><p className="text-xs text-slate-700"><T text="A restriction applies only after a fee due date has passed and the remaining balance is positive. Pending payments do not reduce the balance; approved reductions do. Restrictions are off until the school selects them."/></p><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={restrictKiosk} onChange={event=>setRestrictKiosk(event.target.checked)}/><span><T text="Block student KIOS check-in for an overdue balance."/></span></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={restrictExams} onChange={event=>setRestrictExams(event.target.checked)}/><span><T text="Hide published exam schedules in the student and parent portals for an overdue balance."/></span></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={restrictBulletins} onChange={event=>setRestrictBulletins(event.target.checked)}/><span><T text="Hide current-year bulletins in the student and parent portals for an overdue balance; prior-year bulletins remain available."/></span></label></fieldset><button disabled={saving} className={buttonClass}><T text="Save finance settings"/></button></div></form>}

    {selectedCharges.length>=500&&<p className="text-xs text-slate-500"><T text="The list shows the newest 500 records in the selected scope. Totals include all records."/></p>}
  </main>
}
