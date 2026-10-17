import {findFinanceBank} from '@/lib/finance-bank-catalog'

const METHOD_BRANDS:Record<string,{mark:string;color:string}>={
 moncash:{mark:'M',color:'#e2222b'},natcash:{mark:'N',color:'#1769aa'},paypal:{mark:'P',color:'#003087'},zelle:{mark:'Z',color:'#6d1ed4'},
 bank_transfer:{mark:'↗',color:'#24558a'},cash:{mark:'$',color:'#16804a'},check:{mark:'✓',color:'#475569'},
}
function methodBrand(method:string){const key=method.trim().toLowerCase().replace(/[\s-]+/g,'_');if(key.startsWith('bank_transfer')||key==='virement'||key==='virement_bancaire')return METHOD_BRANDS.bank_transfer;return METHOD_BRANDS[key]||{mark:method.trim().slice(0,3).toUpperCase()||'PAY',color:'#475569'}}
export function PaymentMethodLogo({method,bankName,className=''}:{method:string;bankName?:string|null;className?:string}){
 const bank=findFinanceBank(bankName),brand=bank||methodBrand(method)
 return <span title={bank?.name||method} aria-label={bank?.name||method} className={'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-[10px] font-extrabold tracking-tight text-white shadow-sm '+className} style={{backgroundColor:brand.color}}>{bank?.mark||brand.mark}</span>
}
