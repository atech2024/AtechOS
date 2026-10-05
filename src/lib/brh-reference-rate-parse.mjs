const months={janvier:'01',fevrier:'02','février':'02',mars:'03',avril:'04',mai:'05',juin:'06',juillet:'07',aout:'08','août':'08',septembre:'09',octobre:'10',novembre:'11',decembre:'12','décembre':'12'}
const BRH_URL='https://www.brh.ht/politique-monetaire/taux-de-change/'

export function parseBrhReferenceRate(html){
 const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#x27;|&#39;|&apos;/gi,"'").replace(/&eacute;|&#233;/gi,'é').replace(/&ocirc;|&#244;/gi,'ô').replace(/&ucirc;|&#251;/gi,'û').replace(/&egrave;|&#232;/gi,'è').replace(/\s+/g,' ').trim()
 const label=text.search(/taux\s+de\s+r[eé]f[eé]rence/i)
 if(label<0)throw new Error('brh_reference_rate_not_found')
 const before=text.slice(Math.max(0,label-260),label),rateMatch=before.match(/(?:^|#\s*|\s)(\d{2,3}(?:[.,]\d{2,6}))(?:\s*)$/)
 if(!rateMatch)throw new Error('brh_reference_rate_not_found')
 const dateMatches=[...before.matchAll(/(\d{1,2})\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\s+(20\d{2})/gi)]
 const dateMatch=dateMatches.at(-1)
 if(!dateMatch)throw new Error('brh_reference_date_not_found')
 const month=months[dateMatch[2].toLocaleLowerCase('fr')]
 if(!month)throw new Error('brh_reference_date_not_found')
 const rate=Number(rateMatch[1].replace(',','.')),effectiveDate=`${dateMatch[3]}-${month}-${dateMatch[1].padStart(2,'0')}`
 if(!Number.isFinite(rate)||rate<=0)throw new Error('invalid_brh_reference_rate')
 return {rate,effectiveDate,sourceUrl:BRH_URL}
}
