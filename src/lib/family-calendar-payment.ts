export type FamilyCalendarPayment = {
  paid_at: string | null
  status: string
}

// A submitted payment is not money received until school staff validate it.
export function isConfirmedFamilyCalendarPayment(payment: FamilyCalendarPayment): boolean {
  return payment.status === 'validated' && Boolean(payment.paid_at)
}
