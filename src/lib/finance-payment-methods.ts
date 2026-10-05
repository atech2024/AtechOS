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
