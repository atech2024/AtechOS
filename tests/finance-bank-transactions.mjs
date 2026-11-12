import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const helperSource=readFileSync('src/lib/finance-bank-transactions.ts','utf8')
const helperExports={}
vm.runInNewContext(ts.transpileModule(helperSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:helperExports})
const {isBankTransferPaymentMethod,bankReferenceLabelKey,bankTransactionTypeLabelKey}=helperExports

assert.equal(isBankTransferPaymentMethod('Bank transfer HTG'),true)
assert.equal(isBankTransferPaymentMethod('Bank transfer USD'),true)
assert.equal(isBankTransferPaymentMethod('Virement bancaire'),true)
assert.equal(isBankTransferPaymentMethod('bank_transfer_htg'),true)
assert.equal(isBankTransferPaymentMethod('MonCash'),false)
assert.equal(bankReferenceLabelKey('transfer'),'Bank transfer reference')
assert.equal(bankReferenceLabelKey('branch_deposit'),'Deposit receipt number')
assert.equal(bankReferenceLabelKey(null),null)
assert.equal(bankTransactionTypeLabelKey('transfer'),'Bank transfer')
assert.equal(bankTransactionTypeLabelKey('branch_deposit'),'Branch deposit')

const family=readFileSync('src/components/family-finance-panel.tsx','utf8')
const staff=readFileSync('src/app/dashboard/finance/workspace.tsx','utf8')
const receipt=readFileSync('src/components/finance-payment-receipt.tsx','utf8')
const migration=readFileSync('supabase/migrations/20261017154500_finance_bank_transaction_type.sql','utf8')
const ledgerMigration=readFileSync('supabase/migrations/20261005220000_finance_payment_ledger_refund_totals.sql','utf8')
assert.match(family,/p_bank_transaction_type:bankPayment\?bankTransactionType:null/)
assert.match(staff,/p_bank_transaction_type: isBankTransferPaymentMethod\(recordedMethod\) \? bankTransactionType : null/)
assert.match(staff,/payment\.bank_transaction_type/)
assert.match(receipt,/bank_transaction_type/)
assert.match(migration,/bank_transaction_type text/)
assert.match(migration,/bank_transaction_type_required/)
assert.match(ledgerMigration,/public\.finance_payment_ledger/)
assert.match(ledgerMigration,/p\.\*/)
assert.match(migration,/finance_payment_receipt/)
assert.doesNotMatch(helperSource,/\\d\{\d,\}/)

console.log('PASS bank payment type and reference labels distinguish bank transfers from branch deposits without assuming a bank-specific reference format.')
