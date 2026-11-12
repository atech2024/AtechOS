export function financePaymentDisplayStatus(status: string, amount: number, refundedAmount: number): string {
  const total = Number.isFinite(amount) ? amount : 0
  const refunded = Number.isFinite(refundedAmount) ? refundedAmount : 0
  if (refunded > 0 && refunded >= total - 0.005) return 'refunded'
  if (refunded > 0) return 'partially_refunded'
  return status
}
