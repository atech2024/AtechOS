export type OfficialCalendarSourceName='MENFP'|'Haitian Government'

export const OFFICIAL_CALENDAR_PAGES:[{source:OfficialCalendarSourceName;url:string},...{source:OfficialCalendarSourceName;url:string}[]]=[
 {source:'MENFP',url:'https://www.menfp.gouv.ht/'},
 {source:'Haitian Government',url:'https://communication.gouv.ht/institution/education/'},
 {source:'Haitian Government',url:'https://communication.gouv.ht/ds/circulaire/'},
 {source:'Haitian Government',url:'https://communication.gouv.ht/communiques/'},
]

export const OFFICIAL_CALENDAR_HOSTS=new Set(['menfp.gouv.ht','www.menfp.gouv.ht','communication.gouv.ht'])

export type OfficialCalendarLink={url:string;source:OfficialCalendarSourceName;label:string;school_year:string|null}

export function discoverOfficialCalendarLinks(html:string,base:string,source:OfficialCalendarSourceName):OfficialCalendarLink[]{
 const found=new Map<string,OfficialCalendarLink>()
 for(const match of html.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)){
  const href=match[2].replaceAll('&amp;','&'),anchor=match[3].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
  try{
   const url=new URL(href,base);url.hash=''
   if(url.protocol!=='https:'||!OFFICIAL_CALENDAR_HOSTS.has(url.hostname))continue
   const haystack=`${url.pathname} ${url.search} ${anchor}`
   if(!/(?:calendrier|calendar|calandriye)/i.test(haystack)||!/(?:20\d{2}(?:[_\-/ –—]?20\d{2})?|\.pdf(?:$|\?)|scolaire)/i.test(haystack))continue
   const year=haystack.match(/(20\d{2})\s*[_\-/ –—]\s*(20\d{2})/)
   const label=anchor&&/(?:calendrier|calendar|calandriye)/i.test(anchor)?anchor:`${source} school calendar${year?` ${year[1]}–${year[2]}`:''}`
   found.set(url.toString(),{url:url.toString(),source,label:label.slice(0,240),school_year:year?`${year[1]}/${year[2]}`:null})
  }catch{}
 }
 return [...found.values()]
}
