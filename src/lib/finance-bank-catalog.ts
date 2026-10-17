export type FinanceBankCountry='HT'|'US'
export type FinanceBank={name:string;country:FinanceBankCountry;mark:string;color:string}

// Haitian institutions listed by the BRH: https://www.brh.ht/supervision-bancaire/liste-des-banques/
export const HAITIAN_BANKS:FinanceBank[]=[
 {name:'Banque Nationale de Crédit (BNC)',country:'HT',mark:'BNC',color:'#087b45'},
 {name:'Banque Populaire Haïtienne (BPH)',country:'HT',mark:'BPH',color:'#1f66b1'},
 {name:'Banque de l’Union Haïtienne (BUH)',country:'HT',mark:'BUH',color:'#c71932'},
 {name:'Capital Bank S.A.',country:'HT',mark:'CAP',color:'#183a72'},
 {name:'Citibank N.A. (Haïti)',country:'HT',mark:'CITI',color:'#056dae'},
 {name:'Société Générale Haïtienne de Banque (SOGEBANK)',country:'HT',mark:'SG',color:'#e31b23'},
 {name:'Société Générale Haïtienne de Banque d’Épargne et de Logement (SOGEBEL)',country:'HT',mark:'SGB',color:'#e31b23'},
 {name:'Unibank S.A.',country:'HT',mark:'UNI',color:'#f05a28'},
 {name:'Banque Nationale de Développement Agricole (BNDA)',country:'HT',mark:'BNDA',color:'#387c2b'},
]

// Popular U.S. choices based on FDIC deposit-market data; this list is intentionally not exhaustive.
export const POPULAR_US_BANKS:FinanceBank[]=[
 {name:'JPMorgan Chase Bank, N.A.',country:'US',mark:'CHASE',color:'#117aca'},
 {name:'Bank of America, N.A.',country:'US',mark:'BofA',color:'#e31837'},
 {name:'Wells Fargo Bank, N.A.',country:'US',mark:'WF',color:'#d71e28'},
 {name:'Citibank, N.A. (États-Unis)',country:'US',mark:'CITI',color:'#056dae'},
 {name:'U.S. Bank, N.A.',country:'US',mark:'US',color:'#0c2f6b'},
 {name:'PNC Bank, N.A.',country:'US',mark:'PNC',color:'#f58025'},
 {name:'Truist Bank',country:'US',mark:'TRUIST',color:'#4b2e83'},
 {name:'Capital One, N.A.',country:'US',mark:'C1',color:'#004977'},
 {name:'TD Bank, N.A.',country:'US',mark:'TD',color:'#54a51c'},
 {name:'Citizens Bank, N.A.',country:'US',mark:'CIT',color:'#007a53'},
]

export const FINANCE_BANKS=[...HAITIAN_BANKS,...POPULAR_US_BANKS]
function normalizeBankName(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
export function findFinanceBank(name:string|undefined|null){if(!name)return undefined;const normalized=normalizeBankName(name);return FINANCE_BANKS.find(bank=>normalizeBankName(bank.name)===normalized||normalizeBankName(bank.mark)===normalized)}
export function financeBanksForPaymentMethod(key:string){return key==='bank_transfer_usd'?FINANCE_BANKS:HAITIAN_BANKS}
