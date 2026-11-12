export type FinanceDashboardPayment = {
  id: string
  amount: number
  applied_amount?: number | null
  applied_currency_code?: string | null
  currency_code: string
  payment_method: string
  paid_at: string
  status: string
  student_name: string
  class_name: string
  charge_description: string
}
export type FinanceDashboardCharge = {
  id: string
  student_name: string
  class_name: string
  description: string
  amount: number
  adjusted_amount: number
  paid_amount: number
  currency_code: string
  due_date: string
}
export type FinanceMonthlyRevenue = { month: string; amount: number }
export type FinancePaymentMethodShare = { method: string; count: number; percent: number }
export type FinanceChargeStatus = { paid: number; overdue: number; upcoming: number; total: number }

export function financePaymentMonth(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 7)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port-au-Prince', year: 'numeric', month: '2-digit' }).formatToParts(date)
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}`
}

export function financePaymentValueInCurrency(payment: FinanceDashboardPayment, currency: string) {
  if (payment.applied_amount != null && payment.applied_currency_code === currency) return Number(payment.applied_amount) || 0
  if (payment.applied_currency_code == null && payment.currency_code === currency) return Number(payment.amount) || 0
  return null
}

export function financeMonthlyRevenue(payments: FinanceDashboardPayment[], currency: string, year: number): FinanceMonthlyRevenue[] {
  const totals = new Map<string, number>()
  for (const payment of payments) {
    if (payment.status !== 'validated') continue
    const key = financePaymentMonth(payment.paid_at)
    if (Number(key.slice(0, 4)) !== year) continue
    const value = financePaymentValueInCurrency(payment, currency)
    if (value == null) continue
    totals.set(key, (totals.get(key) || 0) + value)
  }
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`
    return { month, amount: totals.get(month) || 0 }
  })
}

export function financePaymentMethodShare(payments: FinanceDashboardPayment[]): FinancePaymentMethodShare[] {
  const counts = new Map<string, number>()
  for (const payment of payments) {
    if (payment.status !== 'validated') continue
    const name = payment.payment_method.trim() || 'Autre'
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
  return [...counts.entries()]
    .map(([method, count]) => ({ method, count, percent: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.method.localeCompare(b.method))
}

export function financeChargeStatus(charges: FinanceDashboardCharge[], today: string): FinanceChargeStatus {
  const result: FinanceChargeStatus = { paid: 0, overdue: 0, upcoming: 0, total: charges.length }
  for (const charge of charges) {
    const remaining = Math.max(0, Number(charge.amount) - Number(charge.adjusted_amount) - Number(charge.paid_amount))
    if (remaining <= 0) result.paid++
    else if (charge.due_date < today) result.overdue++
    else result.upcoming++
  }
  return result
}

export function financeDaysOverdue(dueDate: string, today: string) {
  const due = Date.parse(`${dueDate}T00:00:00Z`)
  const current = Date.parse(`${today}T00:00:00Z`)
  if (!Number.isFinite(due) || !Number.isFinite(current)) return 0
  return Math.max(0, Math.floor((current - due) / 86400000))
}
