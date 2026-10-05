const months={janvier:'01',fevrier:'02','février':'02',mars:'03',avril:'04',mai:'05',juin:'06',juillet:'07',aout:'08','août':'08',septembre:'09',octobre:'10',novembre:'11',decembre:'12','décembre':'12'}
const BRH_URL='https://www.brh.ht/taux-du-jour/'
const DATE_PATTERN='(\\d{1,2})\\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\\s+(20\\d{2})'

function decodeHtml(value){
 return value
  .replace(/&nbsp;|&#160;|&#xA0;/gi,' ')
  .replace(/&amp;/gi,'&')
  .replace(/&eacute;|&#233;|&#xE9;/gi,'é')
  .replace(/&egrave;|&#232;|&#xE8;/gi,'è')
  .replace(/&ocirc;|&#244;|&#xF4;/gi,'ô')
  .replace(/&ucirc;|&#251;|&#xFB;/gi,'û')
  .replace(/&ndash;|&mdash;/gi,'-')
  .replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi,(_,code)=>String.fromCodePoint(Number.parseInt(code,16)))
}

function htmlText(html){
 return decodeHtml(html
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<\/(?:tr|p|h[1-6]|div|li|section|main|article|td|th|header|footer)\s*>/gi,'\n')
  .replace(/<br\s*\/?>/gi,'\n')
  .replace(/<[^>]+>/g,' '))
  .replace(/[\t\f\v ]+/g,' ')
  .replace(/ *\n+ */g,'\n')
  .trim()
}

export function parseBrhReferenceRate(html){
 const text=htmlText(html)
 const labelPattern=/taux\s+de\s+r[eé]f[eé]rence/i
 const label=text.match(labelPattern)
 if(!label)throw new Error('brh_reference_rate_not_found')

 // On the daily page, the official reference value follows its row label.
 // Search only after that label so market buy/sell values cannot be mistaken for it.
 const afterLabel=text.slice(label.index+label[0].length,label.index+label[0].length+180)
 const rateMatch=afterLabel.match(/(?:^|[\s|#])(\d{2,3}(?:[.,]\d{2,6}))(?:$|[\s|])/)
 if(!rateMatch)throw new Error('brh_reference_rate_not_found')

 const datePattern=new RegExp(DATE_PATTERN,'gi')
 const dayHeading=new RegExp(`taux\\s+du\\s+jour\\s*:?\\s*${DATE_PATTERN}`,'i').exec(text)
 const beforeLabel=text.slice(0,label.index)
 const priorDates=[...beforeLabel.matchAll(datePattern)]
 const dateMatch=dayHeading||priorDates.at(-1)
 if(!dateMatch)throw new Error('brh_reference_date_not_found')
 const month=months[dateMatch[2].toLocaleLowerCase('fr')]
 if(!month)throw new Error('brh_reference_date_not_found')

 const rate=Number(rateMatch[1].replace(',','.'))
 const effectiveDate=`${dateMatch[3]}-${month}-${dateMatch[1].padStart(2,'0')}`
 if(!Number.isFinite(rate)||rate<=0)throw new Error('invalid_brh_reference_rate')
 return {rate,effectiveDate,sourceUrl:BRH_URL}
}
