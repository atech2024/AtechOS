import type {Locale} from '@/lib/i18n'

const dateLocales:Record<Locale,string>={fr:'fr-HT',ht:'ht-HT',en:'en-US'}

export function formatHaitiDateTime(value:string,locale:Locale='fr'){
 const date=new Date(value)
 if(Number.isNaN(date.getTime()))return '—'
 return new Intl.DateTimeFormat(dateLocales[locale],{dateStyle:'short',timeStyle:'short',timeZone:'America/Port-au-Prince'}).format(date)
}
