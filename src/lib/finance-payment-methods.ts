export type FinancePaymentMethodKey = 'moncash'|'natcash'|'paypal'|'zelle'|'bank_transfer_htg'|'bank_transfer_usd'
export type FinancePaymentMethod = {
  enabled: boolean
  account_name?: string
  phone?: string
  email?: string
  bank_name?: string
  account_number?: string
  branch?: string
  max_htg?: number | null
}
export type FinancePaymentMethods = Record<FinancePaymentMethodKey, FinancePaymentMethod>

export const FINANCE_PAYMENT_METHODS: {key:FinancePaymentMethodKey;title:string;paymentMethod:string;fields:('account_name'|'phone'|'email'|'bank_name'|'account_number'|'branch'|'max_htg')[]}[] = [
  {key:'moncash',title:'MonCash',paymentMethod:'MonCash',fields:['account_name','phone','max_htg']},
  {key:'natcash',title:'NatCash',paymentMethod:'NatCash',fields:['account_name','phone','max_htg']},
  {key:'paypal',title:'PayPal',paymentMethod:'PayPal',fields:['account_name','email']},
  {key:'zelle',title:'Zelle',paymentMethod:'Zelle',fields:['account_name','email','phone']},
  {key:'bank_transfer_htg',title:'Bank transfer HTG',paymentMethod:'Bank transfer HTG',fields:['bank_name','account_name','account_number','branch']},
  {key:'bank_transfer_usd',title:'Bank transfer USD',paymentMethod:'Bank transfer USD',fields:['bank_name','account_name','account_number','branch']},
]

export function familyPaymentMethodsForCurrency(methods:FinancePaymentMethods|undefined|null,chargeCurrency:string|undefined|null){
  return FINANCE_PAYMENT_METHODS.filter(item=>{
    if(!methods?.[item.key]?.enabled)return false
    const tenderCurrency=item.key.endsWith('_usd')||item.key==='paypal'||item.key==='zelle'?'USD':'HTG'
    return tenderCurrency==='USD'?chargeCurrency==='USD'||chargeCurrency==='HTG':chargeCurrency==='HTG'
  })
}

export const EMPTY_FINANCE_PAYMENT_METHODS:FinancePaymentMethods={
  moncash:{enabled:false},natcash:{enabled:false},paypal:{enabled:false},zelle:{enabled:false},
  bank_transfer_htg:{enabled:false},bank_transfer_usd:{enabled:false},
}

export function paymentMethodFieldLabel(field:string){
  const labels:Record<string,string>={account_name:'Account holder / name',phone:'Phone number',email:'Receiving email',bank_name:'Bank name',account_number:'Account number',branch:'Branch / agency',max_htg:'Maximum amount per payment (HTG)'}
  return labels[field]||field
}

export type FinanceBankOption={name:string;code:string}
export const HAITI_BANKS:FinanceBankOption[]=[
 {name:'Banque Nationale de Crédit',code:'BNC'},
 {name:'Banque Populaire Haïtienne',code:'BPH'},
 {name:'Banque de l’Union Haïtienne S.A.',code:'BUH'},
 {name:'Capital Bank S.A.',code:'CAP'},
 {name:'Citibank N.A. (Haïti)',code:'CITI'},
 {name:'SOGEBANK',code:'SOGE'},
 {name:'SOGEBEL',code:'SOGE'},
 {name:'Unibank',code:'UNI'},
 {name:'Banque Nationale de Développement Agricole',code:'BNDA'},
]
export const US_BANKS:FinanceBankOption[]=[
 {name:'JPMorgan Chase Bank',code:'CHASE'},
 {name:'Bank of America',code:'BOA'},
 {name:'Wells Fargo',code:'WF'},
 {name:'Citibank',code:'CITI'},
 {name:'U.S. Bank',code:'USB'},
 {name:'PNC Bank',code:'PNC'},
 {name:'Capital One',code:'COF'},
 {name:'Truist Bank',code:'TRUIST'},
 {name:'TD Bank',code:'TD'},
 {name:'Regions Bank',code:'REG'},
]
export function financeBanksForMethod(key:FinancePaymentMethodKey){return key==='bank_transfer_htg'?HAITI_BANKS:[...HAITI_BANKS,...US_BANKS]}
export function financePaymentTitle(method:string,config?:FinancePaymentMethods){const item=FINANCE_PAYMENT_METHODS.find(entry=>entry.paymentMethod===method);if(!item)return method;const bank=config?.[item.key]?.bank_name;return item.key.startsWith('bank_transfer_')&&bank?bank:item.title}
export function financePaymentMonogram(method:string,bankName?:string){
 const item=FINANCE_PAYMENT_METHODS.find(entry=>entry.paymentMethod===method)
 const bank=bankName||''
 if(item?.key.startsWith('bank_transfer_')&&bank){const selected=[...HAITI_BANKS,...US_BANKS].find(entry=>entry.name===bank);return selected?.code||bank.trim().split(/\\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase().slice(0,4)}
 const map:Record<string,string>={moncash:'MC',natcash:'NC',paypal:'P',zelle:'Z',bank_transfer_htg:'HTG',bank_transfer_usd:'USD'}
 return item?map[item.key]||item.title.slice(0,3).toUpperCase():method.slice(0,3).toUpperCase()
}
