export const launchStudentLimit = 150
export const schoolPlanIds = ['attendance', 'school', 'school_finance'] as const
export type SchoolPlanId = typeof schoolPlanIds[number]
export type BillingCurrency = 'HTG' | 'USD'
export type BillingPeriod = 'monthly' | 'yearly'

const monthlyPrices = {
  attendance: { HTG: 1950, USD: 15 },
  school: { HTG: 3250, USD: 25 },
  school_finance: { HTG: 4550, USD: 35 },
} satisfies Record<SchoolPlanId, Record<BillingCurrency, number>>

export function getLaunchPrice(plan: SchoolPlanId, currency: BillingCurrency, period: BillingPeriod, activeStudents: number) {
  if (!Number.isSafeInteger(activeStudents) || activeStudents < 0 || activeStudents > launchStudentLimit) return null
  return monthlyPrices[plan][currency] * (period === 'yearly' ? 10 : 1)
}
