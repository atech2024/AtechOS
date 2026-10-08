'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { T, useLocale } from '@/components/translation-provider'
import SchoolDateInput from '@/components/school-date-input'
import { createClient } from '@/lib/supabase/client'
import { schoolDateTimeToISO } from '@/lib/school-date'
import { translate } from '@/lib/translations'
import { financePaymentDisplayStatus } from '@/lib/finance-payment-status'
import { convertedPaymentValue } from '@/lib/finance-display'
import FinancePaymentMethodSettings from '@/components/finance-payment-method-settings'
import {EMPTY_FINANCE_PAYMENT_METHODS,FINANCE_PAYMENT_METHODS,type FinancePaymentMethods} from '@/lib/finance-payment-methods'

type Year = { id: string; name: string; start_date: string; end_date: string; is_current: boolean }
type ClassItem = { id: string; name: string; academic_year_id: string; enabled: boolean }
type Installment = { id: string; installment_number: number; amount: number; due_date: string }
type Plan = { id: string; academic_year_id: string; academic_year_name: string; class_id: string; class_name: string; fee_type: string; label: string; currency_code: string; active: boolean; created_at: string; installments: Installment[] }
type Charge = { id: string; student_id: string; academic_year_id: string; class_id: string; fee_plan_id: string; fee_installment_id: string; fee_type: string; description: string; amount: number; currency_code: string; due_date: string; student_name: string; student_code: string; class_name: string; academic_year_name: string; adjusted_amount: number; paid_amount: number; pending_amount: number }
type Payment = { id: string; charge_id: string; amount: number; applied_amount: number; applied_currency_code?: string | null; refunded_amount?: number; currency_code: string; payment_method: string; reference: string | null; proof_storage_path: string | null; paid_at: string; status: string; recorded_by: string; recorded_at: string; reviewed_by: string | null; review_reason: string | null; exchange_rate_snapshot?: number | null; exchange_rate_effective_date?: string | null; exchange_rate_source_url?: string | null; student_name: string; charge_description: string; class_name: string; charge_paid: number }
type Adjustment = { id: string; charge_id: string; adjustment_type: string; amount: number; currency_code: string; reason: string; valid_from: string | null; valid_until: string | null; status: string; student_name: string; charge_description: string; created_at: string; review_reason: string | null }
type AuditEvent = { id: number; actor_id: string | null; actor_role: string | null; actor_name: string | null; entity: string; action: string; occurred_at: string; before_data: unknown; after_data: unknown }
type StudentCredit = { student_id: string; student_name: string; currency_code: string; amount: number }
type Settings = { currency_code: string; director_can_validate: boolean; proof_required: boolean; restrict_kiosk: boolean; restrict_exams: boolean; restrict_bulletins: boolean; moncash_payment_instructions: string; natcash_payment_instructions: string; bank_transfer_instructions: string; general_payment_instructions: string; updated_at: string; updated_by: string }
type WorkspaceData = { settings: Settings | null; years: Year[]; classes: ClassItem[]; summary: { expected: number; paid: number; pending_payments: number; validated_payment_count: number; balance: number }; plans: Plan[]; charges: Charge[]; payments: Payment[]; adjustments: Adjustment[]; credits: StudentCredit[]; audit: AuditEvent[]; can_manage: boolean; can_validate: boolean; can_record: boolean }
type InstallmentDraft = { id: string; amount: string; due_date: string }

const blank: WorkspaceData = { settings: null, years: [], classes: [], summary: { expected: 0, paid: 0, pending_payments: 0, validated_payment_count: 0, balance: 0 }, plans: [], charges: [], payments: [], adjustments: [], credits: [], audit: [], can_manage: false, can_validate: false, can_record: false }
const feeTypes = ['inscription', 'rentree', 'class_fee'] as const
const paymentMethods = ['Cash', 'Check', 'Other'] as const
const adjustmentTypes = ['scholarship', 'half_scholarship', 'discount', 'exception', 'manual_exemption', 'temporary_clearance'] as const
const haitiToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port-au-Prince' }).format(new Date())
const isDigitalPaymentMethod = (value:string) => ['moncash','natcash','paypal','zelle','bank transfer','bank transfer htg','bank_transfer_htg','bank transfer usd','bank_transfer_usd','virement','virement bancaire'].includes(value.trim().toLocaleLowerCase())

function financeErrorMessage(cause: unknown, locale: string) {
  const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : ''
  const message = typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : ''
  const known = new Set(['payment_reference_required','not_authorized','invalid_payment','charge_not_found','payment_not_pending','payment_proof_required','payment_exceeds_balance','overpayment_only_allowed_for_entry_fees','payment_balance_conflict','proof_unavailable','finance_workspace_empty','not_authenticated','payment_method_disabled','payment_destination_required','brh_rate_unavailable','payment_currency_mismatch','payment_method_limit_exceeded'])
  const key = known.has(message) ? message : known.has(code) ? code : 'finance_action_failed'
  const labels: Record<string, [string,string,string]> = {
    payment_reference_required: ['Add the transaction reference for this digital payment.','Saisissez la référence de cette transaction numérique.','Antre referans tranzaksyon dijital sa a.'],
    payment_method_disabled: ['This payment method is not enabled by the school.','Ce moyen de paiement n’est pas activé par l’école.','Lekòl la pa aktive metòd peman sa a.'],
    payment_destination_required: ['The school must complete the receiving account details first.','L’école doit d’abord compléter les coordonnées de réception.','Lekòl la dwe ranpli enfòmasyon kont k ap resevwa lajan an anvan.'],
    brh_rate_unavailable: ['USD payments are blocked until the BRH publishes today’s reference rate.','Les paiements en USD sont bloqués jusqu’à la publication du taux BRH du jour.','Peman USD bloke jiskaske BRH pibliye to referans jodi a.'],
    payment_currency_mismatch: ['This payment method is not compatible with the fee currency.','Ce moyen de paiement n’est pas compatible avec la devise des frais.','Metòd peman sa a pa mache ak lajan frè a.'],
    payment_method_limit_exceeded: ['The payment is above the configured limit for this method.','Le paiement dépasse le plafond défini pour ce moyen.','Peman an depase limit yo fikse pou metòd sa a.'],
    not_authorized: ['You are not allowed to do this.','Vous n’êtes pas autorisé à effectuer cette action.','Ou pa gen otorizasyon pou fè aksyon sa a.'],
    invalid_payment: ['Check the payment amount, method and date.','Vérifiez le montant, le mode et la date du paiement.','Verifye montan, mòd ak dat peman an.'],
    charge_not_found: ['The selected fee was not found. Refresh the page.','Les frais sélectionnés sont introuvables. Actualisez la page.','Frè ou chwazi a pa jwenn. Rafrechi paj la.'],
    payment_not_pending: ['This payment was already processed. Refresh the page.','Ce paiement a déjà été traité. Actualisez la page.','Peman sa a deja trete. Rafrechi paj la.'],
    payment_proof_required: ['The school requires proof of payment.','Une preuve de paiement est requise par les paramètres de l’école.','Paramèt lekòl la mande yon prèv peman.'],
    payment_exceeds_balance: ['The balance changed. Refresh before validating.','Le solde a changé. Actualisez la page avant de valider.','Balans lan chanje. Rafrechi paj la anvan ou valide.'],
    invalid_refund: ['Enter a refund amount and a reason with at least 3 characters.','Saisissez un montant et un motif d’au moins 3 caractères.','Mete yon montan ranbousman ak yon rezon ki gen omwen 3 karaktè.'],
    payment_not_refundable: ['Only validated payments can be refunded.','Seuls les paiements validés peuvent être remboursés.','Se peman ki valide yo sèlman ki ka ranbouse.'],
    refund_exceeds_remaining: ['The refund exceeds the unrefunded amount. Refresh the ledger and try again.','Le remboursement dépasse le montant restant. Actualisez le registre et réessayez.','Ranbousman an depase montan ki rete a. Rafrechi lis la epi eseye ankò.'],
    refund_accounting_conflict: ['The refund could not be reconciled safely. No changes were saved; contact the finance manager.','Le remboursement ne peut pas être rapproché. Aucune modification n’a été enregistrée; contactez la direction financière.','Nou pa t ka rekonsilye ranbousman an san danje. Pa gen chanjman ki anrejistre; kontakte responsab finans lan.'],
    overpayment_only_allowed_for_entry_fees: ['Overpayment is allowed only for registration or back-to-school fees.','Un paiement supérieur au solde est permis uniquement pour les frais d’inscription ou de rentrée.','Peman ki depase balans lan pèmèt sèlman pou frè enskripsyon oswa rantre.'],
    payment_balance_conflict: ['Another payment changed this balance. Refresh and try again.','Un autre paiement a modifié ce solde. Actualisez et réessayez.','Yon lòt peman chanje balans sa a. Rafrechi epi eseye ankò.'],
    proof_unavailable: ['The payment proof cannot be opened.','La preuve de paiement ne peut pas être ouverte.','Nou pa ka louvri prèv peman an.'],
    finance_workspace_empty: ['Finance data is unavailable. Please try again.','Les données financières sont indisponibles. Réessayez.','Done finansye yo pa disponib. Eseye ankò.'],
    not_authenticated: ['Your session expired. Sign in again.','Votre session a expiré. Reconnectez-vous.','Sesyon w lan fini. Konekte ankò.'],
    finance_action_failed: ['Something went wrong. Check your connection and try again.','Une erreur est survenue. Vérifiez votre connexion et réessayez.','Gen yon erè ki rive. Verifye koneksyon an epi eseye ankò.'],
  }
  return locale === 'fr' ? labels[key][1] : locale === 'ht' ? labels[key][2] : labels[key][0]
}

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

export default function FinanceWorkspace({ schoolId, initialTab = 'overview' }: { schoolId: string; initialTab?: 'overview' | 'plans' | 'payments' | 'adjustments' | 'history' | 'settings' }) {
  const locale = useLocale()
  const db = useMemo(() => createClient(), [])
  const [data, setData] = useState(blank)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState<'overview' | 'plans' | 'payments' | 'adjustments' | 'history' | 'settings'>(initialTab)
  const [ledgerPage, setLedgerPage] = useState(0)
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [ledgerQuery, setLedgerQuery] = useState('')
  const [ledgerStatus, setLedgerStatus] = useState('all')
  const [ledgerTotal, setLedgerTotal] = useState(0)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerRefresh, setLedgerRefresh] = useState(0)
  const [refundPaymentId, setRefundPaymentId] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [yearId, setYearId] = useState('')
  const [classId, setClassId] = useState('')
  const [feeType, setFeeType] = useState<(typeof feeTypes)[number]>('inscription')
  const [planLabel, setPlanLabel] = useState('')
  const [installments, setInstallments] = useState<InstallmentDraft[]>([{ id: 'installment-1', amount: '', due_date: '' }])
  const [chargeId, setChargeId] = useState('')
  const [paymentSearch, setPaymentSearch] = useState('')
  const [paymentClassFilter, setPaymentClassFilter] = useState('')
  const [paymentOptions, setPaymentOptions] = useState<Charge[]>([])
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
  const [configuredMethods,setConfiguredMethods] = useState<FinancePaymentMethods>(EMPTY_FINANCE_PAYMENT_METHODS)
  const [brhRateAvailable,setBrhRateAvailable] = useState(false)
  const loadSequence = useRef(0)

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    setError('')
    try {
      const [workspaceResult, optionsResult] = await Promise.all([
        db.rpc('finance_workspace', { p_academic_year_id: yearId || null, p_class_id: classId || null }),
        db.rpc('finance_payment_options', { p_academic_year_id: yearId || null, p_class_id: classId || null }),
      ])
      if (workspaceResult.error) throw workspaceResult.error
      if (optionsResult.error) throw optionsResult.error
      const result = workspaceResult.data
      if (sequence !== loadSequence.current) return
      const next = (Array.isArray(result) ? result[0] : result) as WorkspaceData | null
      if (!next) throw new Error('finance_workspace_empty')
      const {data:paymentSetup,error:setupError}=await db.rpc('finance_payment_setup')
      if(setupError)throw setupError
      const setup=(Array.isArray(paymentSetup)?paymentSetup[0]:paymentSetup) as {payment_methods?:FinancePaymentMethods;brh_rate?:{date:string;rate:number}|null}|null
      setConfiguredMethods({...EMPTY_FINANCE_PAYMENT_METHODS,...setup?.payment_methods})
      setBrhRateAvailable(Boolean(setup?.brh_rate))
      setData(current => ({ ...blank, ...next, payments: initialTab === 'payments' ? current.payments : next.payments }))
      const options = optionsResult.data as { items?: Charge[] } | null
      setPaymentOptions(options?.items || [])
      if (!yearId && next.years?.length) setYearId(next.years.find(year => year.is_current)?.id || next.years[0].id)
      if (next.settings) {
        setCurrencyCode(next.settings.currency_code)
        setDirectorCanValidate(next.settings.director_can_validate)
        setProofRequired(next.settings.proof_required)
        setRestrictKiosk(next.settings.restrict_kiosk)
        setRestrictExams(next.settings.restrict_exams)
        setRestrictBulletins(next.settings.restrict_bulletins)
      }
    } catch (cause) { if (sequence === loadSequence.current) setError(financeErrorMessage(cause, locale)) }
    finally { if (sequence === loadSequence.current) setLoading(false) }
  }, [db, yearId, classId, locale, initialTab])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (tab !== 'payments') return
    let active = true
    setLedgerLoading(true)
    void (async () => {
      try {
        const { data: result, error: ledgerError } = await db.rpc('finance_payment_ledger', { p_academic_year_id: yearId || null, p_class_id: classId || null, p_status: ledgerStatus === 'all' ? null : ledgerStatus, p_search: ledgerQuery || null, p_offset: ledgerPage * 50, p_limit: 50 })
        if (ledgerError) throw ledgerError
        if (!active) return
        const page = (Array.isArray(result) ? result[0] : result) as { items?: Payment[]; total?: number } | null
        setData(current => ({ ...current, payments: page?.items || [] }))
        setLedgerTotal(Number(page?.total || 0))
      } catch (cause) { if (active) setError(financeErrorMessage(cause, locale)) }
      finally { if (active) setLedgerLoading(false) }
    })()
    return () => { active = false }
  }, [db, tab, yearId, classId, ledgerPage, ledgerStatus, ledgerQuery, ledgerRefresh, locale])
  const selectedClasses = data.classes.filter(item => item.academic_year_id === yearId && item.enabled)
  const selectedPaymentCurrency=paymentOptions.find(item=>item.id===chargeId)?.currency_code||data.settings?.currency_code||'HTG'
  const activeDigitalMethods=FINANCE_PAYMENT_METHODS.filter(method=>configuredMethods[method.key].enabled&&(
    method.key==='moncash'||method.key==='natcash'||method.key==='bank_transfer_htg'
      ? selectedPaymentCurrency==='HTG'
      : selectedPaymentCurrency==='USD'
  ))
  const selectedMethodIsDigital=activeDigitalMethods.some(item=>item.paymentMethod===paymentMethod)||isDigitalPaymentMethod(otherPaymentMethod)
  const selectedCharges = data.charges
    .filter(item => (!yearId || item.academic_year_id === yearId) && (!classId || item.class_id === classId))
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.student_name.localeCompare(b.student_name) || a.description.localeCompare(b.description))
  const filteredPaymentOptions = paymentOptions.filter(charge => (!paymentClassFilter || charge.class_id === paymentClassFilter) && (!paymentSearch.trim() || [charge.student_name, charge.student_code, charge.class_name].some(value => value.toLocaleLowerCase().includes(paymentSearch.trim().toLocaleLowerCase()))))
  const orderedInstallments = [...installments].sort((a, b) => (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31') || a.id.localeCompare(b.id))
  const installmentTotal = orderedInstallments.reduce((total, item) => total + (Number(item.amount) || 0), 0)
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
    catch (cause) { setError(financeErrorMessage(cause, locale)) }
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
      const { error: actionError } = await db.rpc('create_finance_fee_plan', { p_academic_year_id: yearId, p_class_id: classId, p_fee_type: feeType, p_label: planLabel, p_installments: orderedInstallments.map(item => ({ amount: Number(item.amount), due_date: item.due_date })) })
      if (actionError) throw actionError
      setPlanLabel(''); setInstallments([{ id: 'installment-1', amount: '', due_date: '' }])
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
      const digitalPayment = isDigitalPaymentMethod(recordedMethod)
      if (digitalPayment && !paymentReference.trim()) throw new Error('payment_reference_required')
      if (digitalPayment && !proof) throw new Error('payment_proof_required')
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

  async function refundPayment(event: FormEvent<HTMLFormElement>, payment: Payment) {
    event.preventDefault()
    const refundable = Math.max(0, Number(payment.amount) - Number(payment.refunded_amount || 0))
    const amount = Number(refundAmount)
    if (!Number.isFinite(amount) || amount <= 0 || amount > refundable || refundReason.trim().length < 3) return
    if (!window.confirm(`${tr('Record this refund')} ${money(amount,payment.currency_code,locale)}? ${tr('The original receipt and audit history will be kept.')}`)) return
    await complete(async () => {
      const { error: actionError } = await db.rpc('refund_finance_payment', { p_payment_id: payment.id, p_amount: amount, p_reason: refundReason.trim() })
      if (actionError) throw actionError
      setRefundPaymentId(''); setRefundAmount(''); setRefundReason(''); setLedgerRefresh(value => value + 1)
    }, 'Refund recorded. The original receipt and audit history remain available.')
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
    if (proofError || !signed?.signedUrl) { setError(financeErrorMessage(proofError || 'proof_unavailable', locale)); return }
    window.open(signed.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const activeTab = (key: typeof tab, label: string) => <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === key ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}><T text={label}/></button>
  const routeTab = (key: 'payments' | 'settings', label: string, href: string) => <Link key={key} href={href} aria-current={tab === key ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === key ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}><T text={label}/></Link>

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
      {activeTab('overview','Overview')}{activeTab('plans','Fee plans')}{routeTab('payments','Payments','/dashboard/finance/payments')}{activeTab('adjustments','Scholarships & clearances')}{activeTab('history','Audit history')}{routeTab('settings','Finance settings','/dashboard/finance/settings')}
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
        <label className="block text-sm"><T text="Number of payments"/><select className={`${fieldClass} mt-1`} value={installments.length} onChange={event=>{const count=Number(event.target.value);setInstallments(value=>{const kept=[...value].sort((a,b)=>(a.due_date||'9999-12-31').localeCompare(b.due_date||'9999-12-31'));return Array.from({length:count},(_,index)=>kept[index]||{id:`installment-${crypto.randomUUID()}`,amount:'',due_date:''})})}}><option value={1}><T text="One payment (cash)"/></option><option value={2}>2 <T text="installments"/></option><option value={3}>3 <T text="installments"/></option></select></label>
        <div className="space-y-3"><div><h3 className="font-medium"><T text="Installments and due dates"/></h3><p className="mt-1 text-xs text-slate-600"><T text="Installments are numbered and applied in due-date order. Enter each payment amount and its due date."/></p></div>{orderedInstallments.map((item,index)=><div key={item.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"><h4 className="font-semibold sm:col-span-2"><T text="Installment"/> {index+1}</h4><label className="text-sm"><T text="Amount"/> ({code})<input type="number" min="0.01" step="0.01" required className={`${fieldClass} mt-1`} value={item.amount} onChange={event=>setInstallments(value=>value.map(row=>row.id===item.id?{...row,amount:event.target.value}:row))}/></label><label className="text-sm"><T text="Due date"/><SchoolDateInput type="date" min={data.years.find(year=>year.id===yearId)?.start_date} max={data.years.find(year=>year.id===yearId)?.end_date} required className={`${fieldClass} mt-1`} value={item.due_date} onChange={event=>setInstallments(value=>value.map(row=>row.id===item.id?{...row,due_date:event.target.value}:row))}/></label></div>)}<p className="rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-950"><T text="Total fee"/>: {money(installmentTotal,code,locale)}</p></div>
        <button className={buttonClass} disabled={saving||!data.settings||!classId||!yearId}><T text="Save fee plan"/></button>
      </form>}
      <section className={`${cardClass} space-y-3`}><h2 className="text-lg font-semibold"><T text="Fee plans"/></h2>{data.plans.filter(plan=>!yearId||plan.academic_year_id===yearId).map(plan=><article key={plan.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{plan.label}</p><p className="mt-1 text-sm text-slate-600">{plan.class_name} · {plan.academic_year_name} · <T text={feeLabel(plan.fee_type)}/></p></div>{data.can_manage&&<button disabled={saving||!plan.active} className={buttonClass} onClick={()=>void issuePlan(plan)}><T text="Generate charges"/></button>}</div><ul className="mt-3 space-y-1 text-sm">{[...plan.installments].sort((a,b)=>a.due_date.localeCompare(b.due_date)||a.installment_number-b.installment_number).map((item,index)=><li key={item.id} className="flex justify-between gap-3"><span><T text="Installment"/> {index+1} · {dateLabel(item.due_date,locale)}</span><span className="font-medium">{money(Number(item.amount),plan.currency_code,locale)}</span></li>)}</ul></article>)}{data.plans.length===0&&<p className="text-sm text-slate-500"><T text="No fee plans yet."/></p>}</section>
    </div>}

    {tab === 'payments' && <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      {data.can_record&&<form onSubmit={recordPayment} className={`${cardClass} space-y-4`}><div><h2 className="text-lg font-semibold"><T text="Record a payment"/></h2><p className="mt-1 text-sm text-slate-600"><T text="A recorded payment remains pending until an authorized person validates it."/></p></div>
        <label className="block text-sm"><T text="Class"/><select className={`${fieldClass} mt-1`} value={paymentClassFilter} onChange={event=>{setPaymentClassFilter(event.target.value);setChargeId('')}}><option value=""><T text="All classes"/></option>{selectedClasses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="block text-sm"><T text="Find student by name, AtechOS ID or class"/><input type="search" className={`${fieldClass} mt-1`} value={paymentSearch} onChange={event=>setPaymentSearch(event.target.value)} placeholder="AtechOS ID · élève · classe"/></label>
        <label className="block text-sm"><T text="Student fee"/><select required className={`${fieldClass} mt-1`} value={chargeId} onChange={event=>{setChargeId(event.target.value);setPaymentMethod('')}}><option value=""><T text="Choose"/></option>{filteredPaymentOptions.map(item=><option key={item.id} value={item.id}>{item.student_name} · {item.student_code} · {item.class_name} · {item.description} · {dateLabel(item.due_date,locale)} · {money(remaining(item),item.currency_code,locale)}</option>)}</select></label>
        {filteredPaymentOptions.length===0&&<p className="-mt-2 text-xs text-slate-600"><T text={paymentOptions.length===0?'No installment is due yet. Upcoming installments will appear here on their due dates.':'No student or fee matches this search.'}/></p>}
        {paymentOptions.find(item=>item.id===chargeId&&['inscription','rentree'].includes(item.fee_type))&&<p className="-mt-2 text-xs text-slate-600 sm:col-span-2"><T text="If this entry fee is overpaid, the extra amount becomes student credit and is applied automatically to the next outstanding fees."/></p>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm"><T text="Amount"/> ({selectedPaymentCurrency})<input type="number" required min="0.01" step="0.01" className={`${fieldClass} mt-1`} value={paymentAmount} onChange={event=>setPaymentAmount(event.target.value)}/></label><label className="text-sm"><T text="Payment method"/><select required className={`${fieldClass} mt-1`} value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value)}><option value=""><T text="Choose"/></option>{paymentMethods.map(method=><option key={method} value={method}>{tr(method)}</option>)}{activeDigitalMethods.map(method=><option key={method.key} value={method.paymentMethod}>{method.title}</option>)}</select></label>{paymentMethod==='Other'&&<label className="text-sm"><T text="Specify payment method"/><input required minLength={2} maxLength={60} className={`${fieldClass} mt-1`} value={otherPaymentMethod} onChange={event=>setOtherPaymentMethod(event.target.value)}/></label>}</div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm"><T text="Payment date"/><SchoolDateInput type="date" required className={`${fieldClass} mt-1`} value={paymentDate} max={haitiToday()} onChange={event=>setPaymentDate(event.target.value)}/></label><label className="text-sm"><T text="Reference"/>{['Bank transfer','MonCash','NatCash'].includes(paymentMethod)&&<span className="ml-1 text-red-700">*</span>}<input required={selectedMethodIsDigital} maxLength={120} className={`${fieldClass} mt-1`} value={paymentReference} onChange={event=>setPaymentReference(event.target.value)}/></label></div>
        <label className="block text-sm"><T text="Proof of payment"/>{(data.settings?.proof_required||['Bank transfer','MonCash','NatCash'].includes(paymentMethod))&&<span className="ml-1 text-red-700">*</span>}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required={Boolean(data.settings?.proof_required)||selectedMethodIsDigital} className={`${fieldClass} mt-1`} onChange={event=>setProof(event.target.files?.[0]||null)}/><span className="mt-1 block text-xs text-slate-500"><T text="Private file, PDF or image, maximum 10 MB."/></span></label>
        {selectedPaymentCurrency==='USD'&&!brhRateAvailable&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><T text="USD validation is unavailable until the BRH publishes today's rate."/></p>}<button disabled={saving||!chargeId||!data.settings||(selectedPaymentCurrency==='USD'&&!brhRateAvailable)} className={buttonClass}><T text="Record for validation"/></button>
      </form>}
      <section className={`${cardClass} space-y-3`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold"><T text="Payment history"/></h2>{data.can_validate&&<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{data.summary.pending_payments} <T text="awaiting review"/></span>}</div><form onSubmit={event=>{event.preventDefault();setLedgerPage(0);setLedgerQuery(ledgerSearch.trim())}} className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_12rem_auto]"><label className="sr-only" htmlFor="finance-ledger-search"><T text="Search payments"/></label><input id="finance-ledger-search" maxLength={120} value={ledgerSearch} onChange={event=>setLedgerSearch(event.target.value)} placeholder={tr('Search student, fee or reference')} className={fieldClass}/><label className="sr-only" htmlFor="finance-ledger-status"><T text="Payment status"/></label><select id="finance-ledger-status" value={ledgerStatus} onChange={event=>{setLedgerStatus(event.target.value);setLedgerPage(0)}} className={fieldClass}><option value="all">{tr('All statuses')}</option><option value="pending">{tr('Pending validation')}</option><option value="validated">{tr('Validated')}</option><option value="rejected">{tr('Rejected')}</option></select><button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold"><T text="Search"/></button></form>{ledgerLoading&&<p role="status" className="text-sm text-slate-600"><T text="Loading finance workspace…"/></p>}{data.payments.map(payment=>{const refundable=Math.max(0,Number(payment.amount)-Number(payment.refunded_amount||0));const displayStatus=financePaymentDisplayStatus(payment.status,Number(payment.amount),Number(payment.refunded_amount||0));return <article key={payment.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{payment.student_name} · <T text="Amount paid"/>: {money(Number(payment.amount),payment.currency_code,locale)}</p>{convertedPaymentValue(payment)!==null&&<p className="mt-1 text-sm text-slate-600"><T text="Converted at validation"/>: {money(convertedPaymentValue(payment)!, 'HTG', locale)}</p>}{payment.status==='validated'&&payment.applied_currency_code&&<p className="mt-1 text-sm text-slate-600"><T text="Applied to fee"/>: {money(Number(payment.applied_amount),payment.applied_currency_code,locale)}</p>}{Number(payment.refunded_amount||0)>0&&<p className="mt-1 text-sm text-amber-800"><T text="Refunded"/>: {money(Number(payment.refunded_amount),payment.currency_code,locale)} · <T text="Refundable amount"/>: {money(refundable,payment.currency_code,locale)}</p>}<p className="mt-1 break-words text-sm text-slate-600">{payment.charge_description} · {payment.class_name} · {dateLabel(payment.paid_at,locale)}</p><p className="mt-1 break-words text-xs text-slate-500"><T text="Method"/>: {payment.payment_method} · <T text="Reference"/>: {payment.reference||'—'}</p>{payment.exchange_rate_snapshot&&<p className="mt-1 text-xs text-slate-600"><T text="BRH rate snapshot"/>: {payment.exchange_rate_snapshot} HTG/USD · {payment.exchange_rate_effective_date} · <a className="underline" href={payment.exchange_rate_source_url||'https://www.brh.ht/politique-monetaire/taux-de-change/'} target="_blank" rel="noreferrer"><T text="Official source"/></a></p>}{payment.review_reason&&<p className="mt-1 text-sm text-red-700">{payment.review_reason}</p>}</div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${displayStatus==='validated'?'bg-emerald-100 text-emerald-800':displayStatus==='rejected'?'bg-red-100 text-red-800':displayStatus==='refunded'?'bg-purple-100 text-purple-800':displayStatus==='partially_refunded'?'bg-amber-100 text-amber-900':'bg-amber-100 text-amber-900'}`}><T text={displayStatus==='validated'?'Validated':displayStatus==='rejected'?'Rejected':displayStatus==='refunded'?'Refunded status':displayStatus==='partially_refunded'?'Partially refunded':'Pending validation'}/></span></div><div className="mt-3 flex flex-wrap gap-2">{payment.proof_storage_path&&<button type="button" onClick={()=>void openProof(payment.proof_storage_path!)} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm"><T text="Open proof"/></button>}{payment.status==='pending'&&data.can_validate&&<><button type="button" disabled={saving} onClick={()=>void reviewPayment(payment,'validated')} className="min-h-11 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"><T text="Validate"/></button><button type="button" disabled={saving} onClick={()=>void reviewPayment(payment,'rejected')} className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700"><T text="Reject with reason"/></button></>}{payment.status==='validated'&&refundable>0&&data.can_validate&&<button type="button" disabled={saving} onClick={()=>{setRefundPaymentId(refundPaymentId===payment.id?'':payment.id);setRefundAmount(refundable.toFixed(2));setRefundReason('')}} className="min-h-11 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900"><T text={refundPaymentId===payment.id?'Cancel refund':'Refund payment'}/></button>}</div>{refundPaymentId===payment.id&&<form onSubmit={event=>void refundPayment(event,payment)} className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-2"><label className="text-sm font-medium"><T text="Refund amount"/> ({payment.currency_code})<input type="number" required min="0.01" max={refundable.toFixed(2)} step="0.01" inputMode="decimal" className={`${fieldClass} mt-1 text-base`} value={refundAmount} onChange={event=>setRefundAmount(event.target.value)}/></label><label className="text-sm font-medium sm:col-span-2"><T text="Required reason"/><textarea required minLength={3} maxLength={500} rows={3} className={`${fieldClass} mt-1 text-base`} value={refundReason} onChange={event=>setRefundReason(event.target.value)}/></label><p className="text-xs text-slate-700 sm:col-span-2"><T text="The original receipt, proof and audit history will be kept. Any credit already used will be restored to the related fee balance."/></p><div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" disabled={saving||Number(refundAmount)<=0||Number(refundAmount)>refundable||refundReason.trim().length<3} className="min-h-11 rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><T text="Record refund"/></button><button type="button" disabled={saving} onClick={()=>setRefundPaymentId('')} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm"><T text="Cancel"/></button></div></form>}</article>})}{!ledgerLoading&&data.payments.length===0&&<p className="text-sm text-slate-500"><T text="No payments recorded yet."/></p>}<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm"><span className="text-slate-600">{ledgerTotal} <T text="payments found"/> · {ledgerTotal===0?0:ledgerPage*50+1}–{Math.min((ledgerPage+1)*50,ledgerTotal)}</span><div className="flex gap-2"><button type="button" disabled={ledgerPage===0||ledgerLoading} onClick={()=>setLedgerPage(page=>Math.max(0,page-1))} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50"><T text="Previous"/></button><button type="button" disabled={(ledgerPage+1)*50>=ledgerTotal||ledgerLoading} onClick={()=>setLedgerPage(page=>page+1)} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50"><T text="Next"/></button></div></div></section>
    </div>}

    {tab === 'adjustments' && <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      {data.can_manage&&<form onSubmit={requestAdjustment} className={`${cardClass} space-y-4`}><h2 className="text-lg font-semibold"><T text="Scholarships, exceptions and clearances"/></h2><label className="block text-sm"><T text="Student fee"/><select required className={`${fieldClass} mt-1`} value={adjustmentCharge} onChange={event=>setAdjustmentCharge(event.target.value)}><option value=""><T text="Choose"/></option>{selectedCharges.map(item=><option key={item.id} value={item.id}>{item.student_name} · {item.description} · {money(remaining(item),item.currency_code,locale)}</option>)}</select></label><label className="block text-sm"><T text="Request type"/><select className={`${fieldClass} mt-1`} value={adjustmentType} onChange={event=>setAdjustmentType(event.target.value as typeof adjustmentType)}>{adjustmentTypes.map(type=><option key={type} value={type}>{tr(adjustmentLabel(type))}</option>)}</select></label>{adjustmentType!=='temporary_clearance'&&<label className="block text-sm"><T text="Approved reduction amount"/> ({code})<input type="number" min="0.01" step="0.01" required className={`${fieldClass} mt-1`} value={adjustmentAmount} onChange={event=>setAdjustmentAmount(event.target.value)}/></label>}{adjustmentType==='temporary_clearance'&&<div className="grid gap-3 sm:grid-cols-2"><label className="text-sm"><T text="Clearance starts"/><SchoolDateInput type="datetime-local" required className={`${fieldClass} mt-1`} value={clearanceFrom} onChange={event=>setClearanceFrom(event.target.value)}/></label><label className="text-sm"><T text="Clearance expires"/><SchoolDateInput type="datetime-local" required className={`${fieldClass} mt-1`} value={clearanceUntil} onChange={event=>setClearanceUntil(event.target.value)}/></label><p className="text-xs text-slate-500 sm:col-span-2"><T text="Temporary clearance does not remove or reduce the outstanding balance."/></p></div>}<label className="block text-sm"><T text="Reason"/><textarea required minLength={3} maxLength={500} className={`${fieldClass} mt-1`} value={adjustmentReason} onChange={event=>setAdjustmentReason(event.target.value)}/></label><button disabled={saving||!adjustmentCharge} className={buttonClass}><T text="Submit for approval"/></button></form>}
      <section className={`${cardClass} space-y-3`}><h2 className="text-lg font-semibold"><T text="Adjustment history"/></h2>{data.adjustments.map(item=><article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{item.student_name} · <T text={adjustmentLabel(item.adjustment_type)}/></p><p className="mt-1 text-sm text-slate-600">{item.charge_description} · {item.reason}</p>{item.adjustment_type==='temporary_clearance'&&<p className="mt-1 text-xs text-slate-500">{item.valid_from&&dateLabel(item.valid_from,locale)} — {item.valid_until&&dateLabel(item.valid_until,locale)}</p>}{item.amount>0&&<p className="mt-1 text-sm">{money(Number(item.amount),item.currency_code,locale)}</p>}</div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold"><T text={item.status==='approved'?'Approved':item.status==='rejected'?'Rejected':item.status==='revoked'?'Revoked':'Pending validation'}/></span></div><p className="mt-2 text-sm">{item.review_reason}</p><div className="mt-3 flex flex-wrap gap-2">{item.status==='pending'&&data.can_manage&&<><button disabled={saving} onClick={()=>void reviewAdjustment(item,'approved')} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white"><T text="Approve"/></button><button disabled={saving} onClick={()=>void reviewAdjustment(item,'rejected')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700"><T text="Reject with reason"/></button></>}{item.status==='approved'&&data.can_manage&&<button disabled={saving} onClick={()=>void revokeAdjustment(item)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"><T text="Revoke with reason"/></button>}</div></article>)}{data.adjustments.length===0&&<p className="text-sm text-slate-500"><T text="No scholarship or clearance requests yet."/></p>}</section>
    </div>}

    {tab === 'history' && <section className={`${cardClass} space-y-3`}><h2 className="text-lg font-semibold"><T text="Immutable audit history"/></h2><p className="text-sm text-slate-600"><T text="Finance changes keep the actor, role, timestamp and before/after values. Audit rows cannot be edited through the app."/></p><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr>{['When','Actor','Role','Record','Action','Details'].map(label=><th key={label} className="px-3 py-3"><T text={label}/></th>)}</tr></thead><tbody className="divide-y">{data.audit.map(event=><tr key={event.id}><td className="px-3 py-3">{new Intl.DateTimeFormat(locale==='fr'?'fr-HT':locale==='ht'?'ht-HT':'en-US',{dateStyle:'short',timeStyle:'short',timeZone:'America/Port-au-Prince'}).format(new Date(event.occurred_at))}</td><td className="px-3 py-3">{event.actor_name||'—'}</td><td className="px-3 py-3"><T text={event.actor_role||'System'}/></td><td className="px-3 py-3">{event.entity}</td><td className="px-3 py-3"><T text={event.action}/></td><td className="max-w-md px-3 py-3"><details><summary className="cursor-pointer text-blue-700"><T text="View change"/></summary><pre className="mt-2 max-w-full overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2 text-xs">{JSON.stringify(event.after_data||event.before_data,null,2)}</pre></details></td></tr>)}</tbody></table>{data.audit.length===0&&<p className="p-6 text-center text-sm text-slate-500"><T text="No finance actions have been recorded."/></p>}</div></section>}

    {tab === 'settings' && (data.can_manage ? <><form onSubmit={saveSettings} className={`${cardClass} grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]`}><div><h2 className="text-lg font-semibold"><T text="Finance settings"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Only school managers can change currency and critical finance rules. Secretaries cannot change these settings."/></p></div><div className="space-y-3"><label className="block text-sm"><T text="Currency code"/><input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" className={`${fieldClass} mt-1 uppercase`} placeholder="HTG" value={currencyCode} onChange={event=>setCurrencyCode(event.target.value.toUpperCase())}/></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={directorCanValidate} onChange={event=>setDirectorCanValidate(event.target.checked)}/><span><T text="Allow the director to validate payments."/></span></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={proofRequired} onChange={event=>setProofRequired(event.target.checked)}/><span><T text="Require proof before a payment can be validated."/></span></label><fieldset className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3"><legend className="px-1 text-sm font-semibold text-slate-900"><T text="Optional overdue-fee restrictions"/></legend><p className="text-xs text-slate-700"><T text="A restriction applies only after a fee due date has passed and the remaining balance is positive. Pending payments do not reduce the balance; approved reductions do. Restrictions are off until the school selects them."/></p><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={restrictKiosk} onChange={event=>setRestrictKiosk(event.target.checked)}/><span><T text="Block student KIOS check-in for an overdue balance."/></span></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={restrictExams} onChange={event=>setRestrictExams(event.target.checked)}/><span><T text="Hide published exam schedules in the student and parent portals for an overdue balance."/></span></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={restrictBulletins} onChange={event=>setRestrictBulletins(event.target.checked)}/><span><T text="Hide current-year bulletins in the student and parent portals for an overdue balance; prior-year bulletins remain available."/></span></label></fieldset><button disabled={saving} className={buttonClass}><T text="Save finance settings"/></button></div></form><FinancePaymentMethodSettings onRateStatus={setBrhRateAvailable}/></> : <section className={cardClass}><p className="text-sm text-slate-600"><T text="Only school managers can change finance settings."/></p></section>)}

  </main>
}
