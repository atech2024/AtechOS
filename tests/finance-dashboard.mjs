import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync('src/lib/finance-dashboard.ts', 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText
const module = { exports: {} }
vm.runInNewContext(compiled, {
  module,
  exports: module.exports,
  Intl,
  Date,
  Map,
  Number,
  String,
  Math
})
const {
  financeChargeStatus,
  financeDaysOverdue,
  financeMonthlyRevenue,
  financePaymentMethodShare,
  financePaymentMonth,
  financePaymentValueInCurrency
} = module.exports

const payment = (overrides = {}) => ({
  id: 'p1',
  amount: 100,
  currency_code: 'USD',
  applied_amount: 13200,
  applied_currency_code: 'HTG',
  payment_method: 'MonCash',
  paid_at: '2026-02-01T02:00:00Z',
  status: 'validated',
  student_name: 'Test Student',
  class_name: 'Class 1',
  charge_description: 'Tuition',
  ...overrides
})

assert.equal(financePaymentMonth('2026-02-01T02:00:00Z'), '2026-01', 'month boundaries use Haiti local time')
assert.equal(financePaymentValueInCurrency(payment(), 'HTG'), 13200, 'use the amount applied to the fee')
assert.equal(financePaymentValueInCurrency(payment(), 'USD'), null, 'never treat a converted payment as USD applied')
assert.equal(financePaymentValueInCurrency(payment({ applied_amount: null, applied_currency_code: null }), 'USD'), 100, 'use the paid amount when no applied amount exists and currencies match')

const revenue = financeMonthlyRevenue([
  payment(),
  payment({ id: 'p2', paid_at: '2026-09-10T15:00:00Z', applied_amount: 500, applied_currency_code: 'HTG' }),
  payment({ id: 'pending', paid_at: '2026-09-10T15:00:00Z', status: 'pending', applied_amount: 700 }),
  payment({ id: 'other-year', paid_at: '2025-09-10T15:00:00Z', applied_amount: 900 })
], 'HTG', 2026)
assert.equal(revenue.length, 12)
assert.equal(revenue.find(item => item.month === '2026-01').amount, 13200)
assert.equal(revenue.find(item => item.month === '2026-09').amount, 500)
assert.equal(revenue.reduce((sum, item) => sum + item.amount, 0), 13700, 'exclude pending payments and other years')

const methodShare = financePaymentMethodShare([
  payment(),
  payment({ id: 'p2', payment_method: 'Bank transfer' }),
  payment({ id: 'p3', status: 'pending', payment_method: 'Cash' })
]).map(item => ({ method: item.method, count: item.count, percent: item.percent }))
assert.deepEqual(JSON.parse(JSON.stringify(methodShare)), [
  { method: 'Bank transfer', count: 1, percent: 50 },
  { method: 'MonCash', count: 1, percent: 50 }
], 'method distribution counts validated payments only')

const charge = overrides => ({
  id: 'c1',
  student_name: 'Test Student',
  class_name: 'Class 1',
  description: 'Tuition',
  amount: 100,
  adjusted_amount: 0,
  paid_amount: 0,
  currency_code: 'HTG',
  due_date: '2026-10-07',
  ...overrides
})
assert.deepEqual(JSON.parse(JSON.stringify(financeChargeStatus([
  charge({ id: 'paid', paid_amount: 100 }),
  charge({ id: 'late', due_date: '2026-10-07' }),
  charge({ id: 'today', due_date: '2026-10-08' }),
  charge({ id: 'reduced', adjusted_amount: 100 })
], '2026-10-08'))), { paid: 2, overdue: 1, upcoming: 1, total: 4 })
assert.equal(financeDaysOverdue('2026-10-07', '2026-10-08'), 1)
assert.equal(financeDaysOverdue('2026-10-09', '2026-10-08'), 0)

console.log('Finance dashboard calculations passed.')
