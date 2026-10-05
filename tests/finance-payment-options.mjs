import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source=readFileSync('src/lib/finance-payment-methods.ts','utf8')
const exports={}
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports})
const {familyPaymentMethodsForCurrency}=exports
const settings={moncash:{enabled:true},natcash:{enabled:false},paypal:{enabled:true},zelle:{enabled:true},bank_transfer_htg:{enabled:true},bank_transfer_usd:{enabled:true}}

assert.deepEqual(Array.from(familyPaymentMethodsForCurrency(settings,'HTG'),item=>item.key),['moncash','paypal','zelle','bank_transfer_htg','bank_transfer_usd'])
assert.deepEqual(Array.from(familyPaymentMethodsForCurrency(settings,'USD'),item=>item.key),['paypal','zelle','bank_transfer_usd'])
assert.deepEqual(Array.from(familyPaymentMethodsForCurrency(settings,'EUR')),[])
assert.deepEqual(Array.from(familyPaymentMethodsForCurrency(undefined,'HTG')),[])

console.log('PASS family payment method visibility: enabled USD options remain available for HTG fees, while HTG-only options cannot pay USD fees.')
