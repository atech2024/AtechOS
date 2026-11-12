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
const unibankGuidance=exports.findFinanceBank('Unibank S.A.')?.accountNumberGuidance
assert.deepEqual({...unibankGuidance},{format:'xxx - xxxx - xxxxxx',appliesTo:'current account only',sourceUrl:'https://www.unibankhaiti.com/contact2/lst_documents_souscription.php/bootstrap3/js/jqueryfileupload/phpjs/jquery/colorbox/phpimages/index.php'})
assert.equal(Object.hasOwn(unibankGuidance,'pattern'),false)
assert.equal(exports.FINANCE_BANKS.filter(bank=>bank.accountNumberGuidance).length,1)
assert.equal(exports.findFinanceBank('Banque Nationale de Crédit (BNC)')?.accountNumberGuidance,undefined)
assert.equal(exports.findFinanceBank('unknown bank'),undefined)
console.log('Finance bank catalog checks passed.')
