import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source=readFileSync('src/lib/finance-payment-methods.ts','utf8')
const exports={}
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports})
const {familyPaymentMethodsForCurrency}=exports
const displayExports={}
const displaySource=readFileSync('src/lib/finance-display.ts','utf8')
vm.runInNewContext(ts.transpileModule(displaySource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:displayExports})
const {convertedPaymentValue}=displayExports
const settings={moncash:{enabled:true},natcash:{enabled:false},paypal:{enabled:true},zelle:{enabled:true},bank_transfer_htg:{enabled:true},bank_transfer_usd:{enabled:true}}

assert.deepEqual(Array.from(familyPaymentMethodsForCurrency(settings,'HTG'),item=>item.key),['moncash','paypal','zelle','bank_transfer_htg','bank_transfer_usd'])
assert.deepEqual(Array.from(familyPaymentMethodsForCurrency(settings,'USD'),item=>item.key),['paypal','zelle','bank_transfer_usd'])
assert.deepEqual(Array.from(familyPaymentMethodsForCurrency(settings,'EUR')),[])
assert.deepEqual(Array.from(familyPaymentMethodsForCurrency(undefined,'HTG')),[])
assert.equal(convertedPaymentValue({amount:100,currency_code:'USD',applied_currency_code:'HTG',status:'validated',exchange_rate_snapshot:130.5583}),13055.83)
assert.equal(convertedPaymentValue({amount:75,currency_code:'USD',applied_currency_code:'HTG',status:'pending',exchange_rate_snapshot:130.5583}),null)
assert.equal(convertedPaymentValue({amount:75,currency_code:'USD',applied_currency_code:'HTG',status:'validated',exchange_rate_snapshot:null}),null)
assert.equal(convertedPaymentValue({amount:75,currency_code:'HTG',applied_currency_code:'HTG',status:'validated',exchange_rate_snapshot:130.5583}),null)

console.log('PASS family payment method visibility: enabled USD options remain available for HTG fees, while HTG-only options cannot pay USD fees.')
