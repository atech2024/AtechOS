import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source=readFileSync('src/lib/finance-bank-catalog.ts','utf8')
const exports={}
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
vm.runInNewContext(compiled,{exports})
assert.equal(exports.HAITIAN_BANKS.length,9)
assert.equal(exports.POPULAR_US_BANKS.length,10)
assert.equal(exports.financeBanksForPaymentMethod('bank_transfer_htg').length,9)
assert.equal(exports.financeBanksForPaymentMethod('bank_transfer_usd').length,19)
assert.equal(exports.findFinanceBank('Unibank S.A.')?.mark,'UNI')
assert.equal(exports.findFinanceBank('unknown bank'),undefined)
console.log('Finance bank catalog checks passed.')
