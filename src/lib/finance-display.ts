export type PaymentCurrencySnapshot = {
  amount: number
  currency_code: string
  applied_currency_code?: string | null
  status: string
  exchange_rate_snapshot?: number | null
}

/** Returns the recorded USD-to-HTG conversion only after the school validates it. */
export function convertedPaymentValue(payment: PaymentCurrencySnapshot): number | null {
  if (payment.status !== 'validated' || payment.currency_code !== 'USD' || payment.applied_currency_code !== 'HTG') return null
  const amount = Number(payment.amount)
  const rate = Number(payment.exchange_rate_snapshot)
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate) || rate <= 0) return null
  return Math.round((amount * rate + Number.EPSILON) * 100) / 100
}
