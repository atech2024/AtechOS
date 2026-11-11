'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { CreditCard, ShieldCheck, Receipt, Settings2 } from 'lucide-react'
import { useLocale } from '@/components/translation-provider'
import { createClient } from '@/lib/supabase/client'
import { schoolDateTime } from '@/lib/school-date'
import { schoolPlanIds, type SchoolPlanId } from '@/lib/subscription-pricing'

type Method = { method: string; currency: string; recipient: string; account: string; enabled: boolean }
type Invoice = {
 id: string; plan: SchoolPlanId; currency: string; billing_period: string; amount: number
 method: string; destination: { recipient: string; account: string }; status: string
 created_at: string; expires_at: string; reference: string | null; review_note: string | null
 school_name?: string; school_id: string
}
type Workspace = {
 methods: Method[]; invoices: Invoice[]
 subscription?: { plan: SchoolPlanId; starts_at: string; ends_at: string } | null
}
const methodNames: Record<string, string> = { moncash: 'MonCash', natcash: 'NatCash', paypal: 'PayPal', wise: 'Wise' }
const copy = {
 fr: {
  title: 'Abonnement AtechOS', admin: 'Gestion des abonnements AtechOS',
  intro: 'Choisissez votre offre et votre devise. Le montant reste fixe sur chaque facture.',
  reviewIntro: 'Vérifiez la transaction dans le compte destinataire avant de confirmer le paiement.',
  plan: 'Offre', attendance: 'Présences', school: 'École', school_finance: 'École + Finance',
  currency: 'Devise', period: 'Facturation', monthly: 'Mensuelle', yearly: 'Annuelle',
  method: 'Moyen de paiement', create: 'Créer ma facture', loading: 'Chargement…',
  unavailable: 'Aucun moyen de paiement configuré pour cette devise.',
  expired: 'Expirée', pending: 'À payer', submitted: 'Vérification en cours', paid: 'Paiement confirmé',
  rejected: 'Paiement refusé', cancelled: 'Annulée', expires: 'Valable jusqu’au',
  beneficiary: 'Bénéficiaire', account: 'Compte destinataire', reference: 'Référence de la transaction',
  referenceHint: 'Recopiez la référence du reçu fourni par le service de paiement.',
  send: 'Soumettre pour vérification', cancel: 'Annuler cette facture',
  invoice: 'Facture', empty: 'Aucune facture pour le moment.', saved: 'Enregistré.',
  error: 'La demande a échoué. Réessayez ou contactez AtechOS.',
  manual: 'L’abonnement est activé après vérification du paiement reçu par AtechOS.',
  amount: 'Montant vérifié', note: 'Note de vérification ou motif du refus',
  checked: 'J’ai vérifié le montant, la devise et la référence dans le compte destinataire.',
  approve: 'Confirmer le paiement', reject: 'Refuser', methods: 'Destinations de paiement',
  enabled: 'Disponible pour les nouvelles factures', save: 'Enregistrer',
  subscription: 'Période d’abonnement', starts: 'Du', ends: 'au',
  subscription_invoice_pending: 'Une facture est déjà ouverte. Terminez-la ou annulez-la avant d’en créer une autre.',
  subscription_quote_required: 'Au-delà de 150 élèves actifs, contactez AtechOS pour un devis.',
  subscription_reference_used: 'Cette référence a déjà été soumise pour un paiement.',
  subscription_invoice_not_pending: 'Cette facture ne peut plus être modifiée. Actualisez la liste.',
  subscription_invoice_not_submitted: 'Cette facture a déjà été traitée ou ne peut pas être vérifiée.',
  subscription_payment_mismatch: 'Le montant ou la devise vérifiés ne correspondent pas à la facture.',
  subscription_active_plan_change_requires_review: 'Un changement d’offre en cours d’abonnement demande une révision commerciale.',
  subscription_review_note_required: 'Ajoutez une note de vérification ou de refus d’au moins 5 caractères.',
  not_authorized: 'Votre compte ne dispose pas de cet accès.',
  invalid_subscription_method: 'Vérifiez le bénéficiaire et le téléphone au format +509 ou l’adresse courriel.',
  subscription_method_unavailable: 'Ce moyen de paiement est indisponible pour la devise choisie.',
  invalid_subscription_reference: 'Saisissez une référence entre 1 et 160 caractères.',
 },
 ht: {
  title: 'Abònman AtechOS', admin: 'Jesyon abònman AtechOS',
  intro: 'Chwazi plan ak lajan ou. Montan chak fakti rete fiks.',
  reviewIntro: 'Verifye tranzaksyon an nan kont k ap resevwa lajan an anvan ou konfime peman an.',
  plan: 'Plan', attendance: 'Prezans', school: 'Lekòl', school_finance: 'Lekòl + Finans',
  currency: 'Lajan', period: 'Fakti', monthly: 'Chak mwa', yearly: 'Chak ane',
  method: 'Metòd peman', create: 'Kreye fakti mwen', loading: 'Ap chaje…',
  unavailable: 'Pa gen metòd peman konfigire pou lajan sa a.',
  expired: 'Ekspire', pending: 'Pou peye', submitted: 'Ap verifye', paid: 'Peman konfime',
  rejected: 'Peman refize', cancelled: 'Anile', expires: 'Valab jiska',
  beneficiary: 'Benefisyè', account: 'Kont k ap resevwa a', reference: 'Referans tranzaksyon an',
  referenceHint: 'Kopye referans ki sou resi sèvis peman an.',
  send: 'Soumèt pou verifikasyon', cancel: 'Anile fakti sa a',
  invoice: 'Fakti', empty: 'Poko gen fakti.', saved: 'Anrejistre.',
  error: 'Demann nan pa pase. Eseye ankò oswa kontakte AtechOS.',
  manual: 'Abònman an aktive apre AtechOS verifye peman li resevwa a.',
  amount: 'Montan verifye', note: 'Nòt verifikasyon oswa rezon refi a',
  checked: 'Mwen verifye montan, lajan ak referans lan nan kont k ap resevwa a.',
  approve: 'Konfime peman', reject: 'Refize', methods: 'Destinasyon peman',
  enabled: 'Disponib pou nouvo fakti', save: 'Anrejistre',
  subscription: 'Peryòd abònman', starts: 'Soti', ends: 'rive',
  subscription_invoice_pending: 'Ou deja gen yon fakti ouvri. Fini li oswa anile li anvan ou kreye yon lòt.',
  subscription_quote_required: 'Si gen plis pase 150 elèv aktif, kontakte AtechOS pou yon devi.',
  subscription_reference_used: 'Yo deja soumèt referans sa a pou yon peman.',
  subscription_invoice_not_pending: 'Ou pa ka modifye fakti sa a ankò. Rafrechi lis la.',
  subscription_invoice_not_submitted: 'Fakti sa a deja trete oswa li poko ka verifye.',
  subscription_payment_mismatch: 'Montan oswa lajan ki verifye a pa koresponn ak fakti a.',
  subscription_active_plan_change_requires_review: 'Chanje plan pandan yon abònman aktif mande yon revizyon komèsyal.',
  subscription_review_note_required: 'Mete yon nòt verifikasyon oswa refi ki gen omwen 5 karaktè.',
  not_authorized: 'Kont ou pa gen aksè sa a.',
  invalid_subscription_method: 'Verifye benefisyè a ak telefòn nan fòma +509 oswa imel la.',
  subscription_method_unavailable: 'Metòd peman sa a pa disponib pou lajan ou chwazi a.',
  invalid_subscription_reference: 'Mete yon referans ki gen ant 1 ak 160 karaktè.',
 },
 en: {
  title: 'AtechOS subscription', admin: 'AtechOS subscription management',
  intro: 'Choose your plan and currency. Each invoice keeps its original amount.',
  reviewIntro: 'Check the transaction in the receiving account before confirming payment.',
  plan: 'Plan', attendance: 'Attendance', school: 'School', school_finance: 'School + Finance',
  currency: 'Currency', period: 'Billing', monthly: 'Monthly', yearly: 'Yearly',
  method: 'Payment method', create: 'Create my invoice', loading: 'Loading…',
  unavailable: 'No payment method is configured for this currency.',
  expired: 'Expired', pending: 'Awaiting payment', submitted: 'Under review', paid: 'Payment confirmed',
  rejected: 'Payment rejected', cancelled: 'Cancelled', expires: 'Valid until',
  beneficiary: 'Recipient', account: 'Receiving account', reference: 'Transaction reference',
  referenceHint: 'Copy the reference from the payment provider’s receipt.',
  send: 'Submit for review', cancel: 'Cancel this invoice',
  invoice: 'Invoice', empty: 'No invoices yet.', saved: 'Saved.',
  error: 'The request failed. Try again or contact AtechOS.',
  manual: 'The subscription is activated after AtechOS verifies the received payment.',
  amount: 'Verified amount', note: 'Verification note or reason for rejection',
  checked: 'I checked the amount, currency and reference in the receiving account.',
  approve: 'Confirm payment', reject: 'Reject', methods: 'Payment destinations',
  enabled: 'Available for new invoices', save: 'Save',
  subscription: 'Subscription period', starts: 'From', ends: 'to',
  subscription_invoice_pending: 'An invoice is already open. Complete or cancel it before creating another.',
  subscription_quote_required: 'Contact AtechOS for a quote above 150 active students.',
  subscription_reference_used: 'This reference has already been submitted for a payment.',
  subscription_invoice_not_pending: 'This invoice can no longer be changed. Refresh the list.',
  subscription_invoice_not_submitted: 'This invoice has already been reviewed or cannot be reviewed yet.',
  subscription_payment_mismatch: 'The verified amount or currency does not match the invoice.',
  subscription_active_plan_change_requires_review: 'Changing a plan during an active subscription requires a commercial review.',
  subscription_review_note_required: 'Add a verification or rejection note of at least 5 characters.',
  not_authorized: 'Your account does not have this access.',
  invalid_subscription_method: 'Check the recipient and the +509 phone number or email address.',
  subscription_method_unavailable: 'This payment method is unavailable for the selected currency.',
  invalid_subscription_reference: 'Enter a reference between 1 and 160 characters.',
 },
}
const field = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600'
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50'
const secondary = 'min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50'

export default function SchoolSubscriptionBilling({ operator = false }: { operator?: boolean }) {
 const locale = useLocale()
 const text = copy[locale === 'ht' ? 'ht' : locale === 'en' ? 'en' : 'fr']
 const [workspace, setWorkspace] = useState<Workspace | null>(null)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [notice, setNotice] = useState('')
 const [currency, setCurrency] = useState('HTG')
 const Heading = operator ? 'h1' : 'h2'

 async function load() {
  const { data, error } = await createClient().rpc(operator ? 'subscription_billing_admin_workspace' : 'school_subscription_billing_workspace')
  if (error) throw error
  setWorkspace(data as Workspace)
 }
 function showError(cause: unknown) {
  const message = cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : ''
  setError(text[message as keyof typeof text] ?? text.error)
 }
 useEffect(() => {
  let active = true
  Promise.resolve(createClient().rpc(operator ? 'subscription_billing_admin_workspace' : 'school_subscription_billing_workspace')).then(({ data, error }) => {
   if (!active) return
   if (error) showError(error)
   else setWorkspace(data as Workspace)
  }).catch(cause => { if (active) showError(cause) })
  return () => { active = false }
 // The workspace permission is rechecked by every RPC.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [operator])

 async function act(rpc: string, args: Record<string, unknown>) {
  if (busy) return
  setBusy(true)
  setError('')
  setNotice('')
  try {
   const { error } = await createClient().rpc(rpc, args)
   if (error) throw error
   await load()
   setNotice(text.saved)
  } catch (cause) { showError(cause) }
  finally { setBusy(false) }
 }
 function createInvoice(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const values = new FormData(event.currentTarget)
  void act('create_school_subscription_invoice', {
   p_plan: values.get('plan'), p_currency: currency,
   p_billing_period: values.get('period'), p_method: values.get('method'),
  })
 }
 const methods = workspace?.methods.filter(method => method.currency === currency && method.enabled) ?? []
 const expired = (invoice: Invoice) => invoice.status === 'pending' && Date.parse(invoice.expires_at) <= Date.now()
 const openInvoice = workspace?.invoices.some(invoice => invoice.status === 'pending' || invoice.status === 'submitted')

 return <section aria-labelledby="subscription-billing-title" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
  <header className="flex items-start gap-3">
   <span className="rounded-xl bg-blue-50 p-3 text-blue-700"><CreditCard aria-hidden="true" size={22}/></span>
   <div><Heading id="subscription-billing-title" className="text-xl font-semibold text-slate-950">{operator ? text.admin : text.title}</Heading>
    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{operator ? text.reviewIntro : text.intro}</p></div>
  </header>
  {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
  {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
  {!workspace && !error && <p role="status">{text.loading}</p>}
  {workspace?.subscription && <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-950">
   <strong>{text.subscription}</strong> · {text[workspace.subscription.plan]}<br/>
   {text.starts} {schoolDateTime(workspace.subscription.starts_at, locale)} {text.ends} {schoolDateTime(workspace.subscription.ends_at, locale)}
  </p>}
  {workspace && !operator && !openInvoice && <form onSubmit={createInvoice} className="grid gap-4 sm:grid-cols-2">
   <label className="grid gap-1.5 text-sm font-medium">{text.plan}
    <select name="plan" defaultValue={workspace.subscription?.plan ?? 'attendance'} className={field} disabled={busy}>{schoolPlanIds.map(plan => <option key={plan} value={plan}>{text[plan]}</option>)}</select>
   </label>
   <label className="grid gap-1.5 text-sm font-medium">{text.currency}
    <select value={currency} onChange={event => setCurrency(event.target.value)} className={field} disabled={busy}><option>HTG</option><option>USD</option></select>
   </label>
   <label className="grid gap-1.5 text-sm font-medium">{text.period}
    <select name="period" className={field} disabled={busy}><option value="monthly">{text.monthly}</option><option value="yearly">{text.yearly}</option></select>
   </label>
   <label className="grid gap-1.5 text-sm font-medium">{text.method}
    <select name="method" key={currency} className={field} required disabled={busy || !methods.length}>
     {methods.map(method => <option key={method.method} value={method.method}>{methodNames[method.method]}</option>)}
    </select>
   </label>
   {!methods.length && <p className="text-sm text-amber-900 sm:col-span-2">{text.unavailable}</p>}
   <button className={primary} disabled={busy || !methods.length}><Receipt size={18} aria-hidden="true"/>{text.create}</button>
  </form>}
  {workspace && <div className="space-y-4">
   {!workspace.invoices.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{text.empty}</p>}
   {workspace.invoices.map(invoice => <article key={invoice.id} className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><h3 className="font-semibold text-slate-950">{text.invoice} {invoice.id.slice(0,8).toUpperCase()}</h3>
      <p className="mt-1 text-sm text-slate-600">{text[invoice.plan]} · {invoice.billing_period === 'yearly' ? text.yearly : text.monthly}</p>
      {operator && <p className="mt-1 break-all text-sm text-slate-600">{invoice.school_name || invoice.school_id}</p>}</div>
     <div className="text-right"><p className="text-xl font-bold text-slate-950">{new Intl.NumberFormat(locale, { style: 'currency', currency: invoice.currency }).format(invoice.amount)}</p>
      <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${invoice.status === 'paid' ? 'bg-emerald-50 text-emerald-900' : invoice.status === 'rejected' ? 'bg-red-50 text-red-900' : 'bg-slate-100 text-slate-700'}`}>{text[(expired(invoice) ? 'expired' : invoice.status) as keyof typeof text] ?? invoice.status}</span></div>
    </div>
    <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
     <div><dt className="text-slate-500">{text.method}</dt><dd className="mt-1 font-medium">{methodNames[invoice.method]}</dd></div>
     <div><dt className="text-slate-500">{text.beneficiary}</dt><dd className="mt-1 break-words font-medium">{invoice.destination.recipient}</dd></div>
     <div><dt className="text-slate-500">{text.account}</dt><dd className="mt-1 break-all font-medium">{invoice.destination.account}</dd></div>
     <div><dt className="text-slate-500">{text.expires}</dt><dd className="mt-1">{schoolDateTime(invoice.expires_at, locale)}</dd></div>
    </dl>
    {invoice.reference && <p className="break-all text-sm"><strong>{text.reference}</strong> · {invoice.reference}</p>}
    {invoice.review_note && <p className="break-words text-sm text-slate-700">{invoice.review_note}</p>}
    {!operator && invoice.status === 'pending' && !expired(invoice) && <form onSubmit={event => {
     event.preventDefault()
     void act('submit_school_subscription_payment', { p_invoice: invoice.id, p_reference: new FormData(event.currentTarget).get('reference') })
    }} className="space-y-3">
     <label className="grid gap-1.5 text-sm font-medium">{text.reference}
      <input name="reference" required maxLength={160} className={field} disabled={busy}/>
      <span className="font-normal text-slate-500">{text.referenceHint}</span>
     </label>
     <div className="flex flex-wrap gap-2">
      <button className={primary} disabled={busy}>{text.send}</button>
      <button type="button" className={secondary} disabled={busy} onClick={() => void act('cancel_school_subscription_invoice', { p_invoice: invoice.id })}>{text.cancel}</button>
     </div>
    </form>}
    {!operator && expired(invoice) && <button type="button" className={secondary} disabled={busy} onClick={() => void act('cancel_school_subscription_invoice', { p_invoice: invoice.id })}>{text.cancel}</button>}
    {operator && invoice.status === 'submitted' && <form onSubmit={event => {
     event.preventDefault()
     const approve = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'approve'
     const values = new FormData(event.currentTarget)
     void act('review_school_subscription_payment', {
      p_invoice: invoice.id, p_approve: approve,
      p_verified_amount: approve ? Number(values.get('amount')) : null,
      p_currency: invoice.currency, p_note: values.get('note'),
     })
    }} className="space-y-3">
     <label className="grid gap-1.5 text-sm font-medium">{text.amount} · {invoice.currency}
      <input name="amount" type="number" min="0.01" step="0.01" required className={field} disabled={busy}/>
     </label>
     <label className="grid gap-1.5 text-sm font-medium">{text.note}
      <textarea name="note" required minLength={5} maxLength={1200} className={field} disabled={busy}/>
     </label>
     <label className="flex items-start gap-2 text-sm leading-6"><input type="checkbox" required className="mt-1.5 size-4" disabled={busy}/>{text.checked}</label>
     <div className="flex flex-wrap gap-2">
      <button value="approve" className={primary} disabled={busy}><ShieldCheck size={18} aria-hidden="true"/>{text.approve}</button>
      <button value="reject" formNoValidate className={secondary} disabled={busy}>{text.reject}</button>
     </div>
    </form>}
   </article>)}
  </div>}
  {workspace && operator && <section className="space-y-3 border-t border-slate-200 pt-5" aria-labelledby="subscription-payment-methods">
   <h3 id="subscription-payment-methods" className="flex items-center gap-2 font-semibold"><Settings2 size={18} aria-hidden="true"/>{text.methods}</h3>
   {Object.entries(methodNames).map(([id, name]) => {
    const method = workspace.methods.find(method => method.method === id)
    return <form key={id + (method?.account ?? '') + (method?.enabled ?? false)} onSubmit={event => {
     event.preventDefault()
     const values = new FormData(event.currentTarget)
     void act('save_subscription_payment_method', { p_method: id, p_recipient: values.get('recipient'), p_account: values.get('account'), p_enabled: values.has('enabled') })
    }} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
     <h4 className="font-semibold sm:col-span-2">{name} · {id === 'moncash' || id === 'natcash' ? 'HTG' : 'USD'}</h4>
     <label className="grid gap-1.5 text-sm">{text.beneficiary}<input name="recipient" required maxLength={160} defaultValue={method?.recipient ?? ''} className={field} disabled={busy}/></label>
     <label className="grid gap-1.5 text-sm">{text.account}<input name="account" required type={id === 'paypal' || id === 'wise' ? 'email' : 'tel'} defaultValue={method?.account ?? ''} className={field} disabled={busy}/></label>
     <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={method?.enabled ?? false} disabled={busy}/>{text.enabled}</label>
     <button className={secondary} disabled={busy}>{text.save}</button>
    </form>
   })}
  </section>}
  {!operator && <p className="text-sm leading-6 text-slate-500">{text.manual}</p>}
 </section>
}
