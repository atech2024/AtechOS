'use client'

import { FormEvent, useMemo, useState } from 'react'
import { T, useLocale } from '@/components/translation-provider'
import { createClient } from '@/lib/supabase/client'
import { translate } from '@/lib/translations'

type StudentHit = { id: string; first_name: string; last_name: string; atechos_id: string | null; school_status: 'active' | 'departed' }
type CurrencyTotal = { currency_code: string; paid_amount: number; refunded_amount: number; remaining_amount: number }
type StudentPayment = { id: string; amount: number; currency_code: string; paid_at: string; charge_description: string; refunded_amount: number; remaining_amount: number; refund_allowed: boolean }
type DepartureWorkspace = { student: StudentHit; totals: CurrencyTotal[]; payments: StudentPayment[] }

function money(value: number, currency: string, locale: string) {
  try { return new Intl.NumberFormat(locale === 'fr' ? 'fr-HT' : locale === 'ht' ? 'ht-HT' : 'en-US', { style: 'currency', currency }).format(value) }
  catch { return `${Number(value).toFixed(2)} ${currency}` }
}
function date(value: string, locale: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(locale === 'fr' ? 'fr-HT' : locale === 'ht' ? 'ht-HT' : 'en-US', { dateStyle: 'medium', timeZone: 'America/Port-au-Prince' }).format(parsed)
}

export default function FinanceDepartureRefundPanel({ currentYearId, canManage, canRefund }: { currentYearId: string; canManage: boolean; canRefund: boolean }) {
  const db = useMemo(() => createClient(), [])
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const [students, setStudents] = useState<StudentHit[]>([])
  const [summary, setSummary] = useState<DepartureWorkspace | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refundId, setRefundId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice(''); setSummary(null); setStudents([])
    try {
      if (query.trim().length < 2) throw new Error('search_minimum')
      const { data, error: rpcError } = await db.rpc('finance_departure_refund_workspace', { p_query: query.trim(), p_student_id: null })
      if (rpcError) throw rpcError
      setStudents((data?.students || []) as StudentHit[])
    } catch (cause) {
      const message = cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : ''
      setError(translate(message === 'search_minimum' ? message : message === 'not_authorized' ? message : 'finance_action_failed', locale))
    } finally { setBusy(false) }
  }

  async function selectStudent(studentId: string) {
    if (!studentId) { setSummary(null); return }
    setBusy(true); setError(''); setNotice(''); setRefundId('')
    try {
      const { data, error: rpcError } = await db.rpc('finance_departure_refund_workspace', { p_query: null, p_student_id: studentId })
      if (rpcError) throw rpcError
      setSummary(data as DepartureWorkspace)
    } catch (cause) {
      const message = cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : ''
      setError(translate(message === 'student_not_found' ? message : message === 'not_authorized' ? message : 'finance_action_failed', locale))
    } finally { setBusy(false) }
  }

  async function markDeparted() {
    if (!summary || !currentYearId) { setError(translate('departure_year_required', locale)); return }
    if (!window.confirm(translate('confirm_student_departure', locale))) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { error: rpcError } = await db.rpc('mark_student_departed', { p_student: summary.student.id, p_last_year: currentYearId })
      if (rpcError) throw rpcError
      const { data, error: refreshError } = await db.rpc('finance_departure_refund_workspace', { p_query: null, p_student_id: summary.student.id })
      if (refreshError) throw refreshError
      setSummary(data as DepartureWorkspace)
      setNotice(translate('student_departure_recorded', locale))
    } catch (cause) {
      const message = cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : ''
      setError(translate(message === 'not_authorized' ? message : 'finance_action_failed', locale))
    } finally { setBusy(false) }
  }

  async function recordRefund(event: FormEvent<HTMLFormElement>, payment: StudentPayment) {
    event.preventDefault()
    const value = Number(amount)
    if (!summary || !Number.isFinite(value) || value <= 0 || value > payment.remaining_amount || reason.trim().length < 3) return
    if (!window.confirm(`${translate('Record this refund', locale)} ${money(value, payment.currency_code, locale)}? ${translate('The original receipt and audit history will be kept.', locale)}`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { error: rpcError } = await db.rpc('refund_finance_payment', { p_payment_id: payment.id, p_amount: value, p_reason: reason.trim() })
      if (rpcError) throw rpcError
      const { data, error: refreshError } = await db.rpc('finance_departure_refund_workspace', { p_query: null, p_student_id: summary.student.id })
      if (refreshError) throw refreshError
      setSummary(data as DepartureWorkspace); setRefundId(''); setAmount(''); setReason('')
      setNotice(translate('departure_refund_recorded', locale))
    } catch (cause) {
      const message = cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : ''
      const known = new Set(['refund_window_expired', 'refund_exceeds_remaining', 'invalid_refund', 'not_authorized'])
      setError(translate(known.has(message) ? message : 'finance_action_failed', locale))
    } finally { setBusy(false) }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-950"><T text="Student departure and refunds"/></h2>
      <p className="mt-1 text-sm text-slate-600"><T text="Search a student to view the validated payments and refund balance. After 15 days, refunds require an official school departure."/></p>
    </div>
    {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    <form onSubmit={event => void search(event)} className="flex flex-col gap-2 sm:flex-row">
      <label className="min-w-0 flex-1 text-sm font-medium text-slate-700"><T text="Search by name or AtechOS ID"/><input type="search" minLength={2} value={query} onChange={event => setQuery(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"/></label>
      <button type="submit" disabled={busy || query.trim().length < 2} className="mt-6 min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><T text="Search"/></button>
    </form>
    {students.length > 0 && <label className="mt-3 block text-sm font-medium text-slate-700"><T text="Select a student"/><select defaultValue="" onChange={event => void selectStudent(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"><option value=""><T text="Choose a student"/></option>{students.map(student => <option key={student.id} value={student.id}>{student.last_name} {student.first_name} · {student.atechos_id || '—'} · {student.school_status === 'departed' ? translate('Departed', locale) : translate('Active', locale)}</option>)}</select></label>}
    {query.trim().length >= 2 && students.length === 0 && !summary && !busy && <p className="mt-3 text-sm text-slate-600"><T text="No students match this search."/></p>}
    {summary && <div className="mt-4 space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-start">
        <div><p className="text-base font-semibold text-slate-950">{summary.student.last_name} {summary.student.first_name}</p><p className="mt-1 text-sm text-slate-600"><T text="AtechOS ID"/>: {summary.student.atechos_id || '—'} · <T text="Student status"/>: <span className="font-medium">{summary.student.school_status === 'departed' ? <T text="Departed"/> : <T text="Active"/>}</span></p></div>
        {summary.student.school_status === 'active' && canManage && <button type="button" disabled={busy || !currentYearId} onClick={() => void markDeparted()} className="min-h-11 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50"><T text="Mark student as departed"/></button>}
      </div>
      {summary.student.school_status === 'active' && canManage && <p className="text-xs text-slate-600"><T text="Marking as departed closes the active enrollment and preserves historical family records."/></p>}
      <div><h3 className="mb-2 text-sm font-semibold text-slate-800"><T text="Paid and refunded totals by currency"/></h3>
        {summary.totals.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{summary.totals.map(total => <article key={total.currency_code} className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{total.currency_code}</p><dl className="mt-2 space-y-1 text-sm"><div className="flex justify-between gap-3"><dt><T text="Paid"/></dt><dd className="font-semibold">{money(total.paid_amount,total.currency_code,locale)}</dd></div><div className="flex justify-between gap-3"><dt><T text="Refunded"/></dt><dd>{money(total.refunded_amount,total.currency_code,locale)}</dd></div><div className="flex justify-between gap-3"><dt><T text="Remaining paid amount"/></dt><dd className="font-semibold">{money(total.remaining_amount,total.currency_code,locale)}</dd></div></dl></article>)}</div> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><T text="No validated payments are available for this student."/></p>}
      </div>
      <div className="space-y-2"><h3 className="text-sm font-semibold text-slate-800"><T text="Validated payments"/></h3>
        {summary.payments.map(payment => <article key={payment.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="font-medium text-slate-900">{payment.charge_description}</p><p className="mt-1 text-xs text-slate-600"><T text="Payment date"/>: {date(payment.paid_at,locale)}</p><dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3"><div><dt className="text-xs text-slate-500"><T text="Paid"/></dt><dd className="font-medium">{money(payment.amount,payment.currency_code,locale)}</dd></div><div><dt className="text-xs text-slate-500"><T text="Refunded"/></dt><dd>{money(payment.refunded_amount,payment.currency_code,locale)}</dd></div><div><dt className="text-xs text-slate-500"><T text="Available to refund"/></dt><dd className="font-semibold">{money(payment.remaining_amount,payment.currency_code,locale)}</dd></div></dl></div>
            {canRefund && payment.remaining_amount > 0 && payment.refund_allowed && <button type="button" disabled={busy} onClick={() => {setRefundId(refundId === payment.id ? '' : payment.id);setAmount(payment.remaining_amount.toFixed(2));setReason('')}} className="min-h-11 self-start rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900"><T text={refundId===payment.id?'Cancel':'Refund payment'}/></button>}
          </div>
          {payment.remaining_amount > 0 && !payment.refund_allowed && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-950"><T text="Refund window expired. Record a school departure before refunding this payment."/></p>}
          {refundId===payment.id && <form onSubmit={event=>void recordRefund(event,payment)} className="mt-3 grid gap-3 rounded-lg bg-amber-50 p-3 sm:grid-cols-2"><label className="text-sm font-medium"><T text="Amount to refund"/> ({payment.currency_code})<input required type="number" min="0.01" max={payment.remaining_amount.toFixed(2)} step="0.01" inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"/></label><label className="text-sm font-medium sm:col-span-2"><T text="Refund reason"/><textarea required minLength={3} maxLength={500} rows={2} value={reason} onChange={event=>setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"/></label><div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" disabled={busy||Number(amount)<=0||Number(amount)>payment.remaining_amount||reason.trim().length<3} className="min-h-11 rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><T text="Record refund"/></button><button type="button" disabled={busy} onClick={() => setRefundId('')} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm"><T text="Cancel"/></button></div></form>}
        </article>)}
      </div>
    </div>}
  </section>
}
