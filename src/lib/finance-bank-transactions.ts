export type BankTransactionType = 'transfer' | 'branch_deposit'

const bankTransferMethods = new Set([
  'bank transfer',
  'bank transfer htg',
  'bank transfer usd',
  'virement',
  'virement bancaire',
  'virement htg',
  'virement usd',
])

export function isBankTransferPaymentMethod(method: string | null | undefined): boolean {
  const normalized = String(method ?? '').trim().toLocaleLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  return bankTransferMethods.has(normalized)
}

export function bankTransactionTypeLabelKey(type: string | null | undefined): string | null {
  if (type === 'transfer') return 'Bank transfer'
  if (type === 'branch_deposit') return 'Branch deposit'
  return null
}

export function bankReferenceLabelKey(type: string | null | undefined): string | null {
  if (type === 'transfer') return 'Bank transfer reference'
  if (type === 'branch_deposit') return 'Deposit receipt number'
  return null
}
