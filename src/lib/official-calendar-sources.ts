export type OfficialCalendarSourceName='MENFP'|'Haitian Government'|'HaitiLibre'

export const OFFICIAL_CALENDAR_PAGES:[{source:OfficialCalendarSourceName;url:string},...{source:OfficialCalendarSourceName;url:string}[]]=[
 {source:'MENFP',url:'https://www.menfp.gouv.ht/'},
 {source:'Haitian Government',url:'https://communication.gouv.ht/institution/education/'},
 {source:'Haitian Government',url:'https://communication.gouv.ht/ds/circulaire/'},
 {source:'Haitian Government',url:'https://communication.gouv.ht/communiques/'},
]

export const OFFICIAL_CALENDAR_HOSTS=new Set(['menfp.gouv.ht','www.menfp.gouv.ht','communication.gouv.ht'])
export const HAITILIBRE_EDUCATION_PAGE='https://www.haitilibre.com/cat-5-education-1.html'
const HAITILIBRE_HOSTS=new Set(['haitilibre.com','www.haitilibre.com','autodiscover.haitilibre.com'])

export type CalendarDocumentKind='school_calendar'|'exam_calendar'
export type OfficialCalendarLink={url:string;source:OfficialCalendarSourceName;label:string;school_year:string|null;kind:CalendarDocumentKind}

export type HaitiLibreCalendarArticle={url:string;school_year:string|null;label:string;kind:CalendarDocumentKind}

function anchors(html:string){
 const values:{href:string;text:string}[]=[]
 for(const match of html.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)){
  values.push({href:match[2].replaceAll('&amp;','&'),text:match[3].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()})
 }
 return values
}

export function discoverHaitiLibreCalendarArticles(html:string,base=HAITILIBRE_EDUCATION_PAGE):HaitiLibreCalendarArticle[]{
 const found=new Map<string,HaitiLibreCalendarArticle>()
 for(const anchor of anchors(html))try{
  const url=new URL(anchor.href,base)
  const haystack=`${url.pathname} ${anchor.text}`
  const year=haystack.match(/(20\d{2})[-_/](20\d{2})/i),singleYear=haystack.match(/(20\d{2})/i)
  const exam=/(?:exam|examen|période|periode)/i.test(haystack),kind:CalendarDocumentKind=exam?'exam_calendar':'school_calendar'
  if(url.protocol!=='https:'||!HAITILIBRE_HOSTS.has(url.hostname)||!/^\/article-\d+-/i.test(url.pathname)||(!exam&&!/(?:calendrier|calendar|calandriye)[-_]scolaire/i.test(haystack))||(!year&&!exam))continue
  const school_year=year?`${year[1]}/${year[2]}`:null
  const label=kind==='exam_calendar'?`Examens et périodes${year?` ${year[1]}–${year[2]}`:singleYear?` ${singleYear[1]}`:''} · source HaitiLibre à vérifier`:`Calendrier scolaire ${year![1]}–${year![2]} · copie publiée par HaitiLibre`
  found.set(url.toString(),{url:url.toString(),school_year,label,kind})
 }catch{}
 return [...found.values()].sort((a,b)=>(b.school_year||'').localeCompare(a.school_year||''))
}

export function discoverHaitiLibreCalendarPdf(html:string,base:string,schoolYear:string):OfficialCalendarLink|null{
 for(const anchor of anchors(html))try{
  const url=new URL(anchor.href,base),year=url.pathname.match(/(?:calendrier[-_]scolaire|calendrier[-_]examens|examens?[-_]scolaires?)[-_](20\d{2})[-_](20\d{2})\.pdf$/i)
  if(url.protocol==='https:'&&HAITILIBRE_HOSTS.has(url.hostname)&&year&&`${year[1]}/${year[2]}`===schoolYear){
   const kind:CalendarDocumentKind=/(?:exam|examen|période|periode)/i.test(`${url.pathname} ${anchor.text}`)?'exam_calendar':'school_calendar'
   const label=kind==='exam_calendar'?`Examens et périodes ${year[1]}–${year[2]} · source HaitiLibre à vérifier`:`Calendrier scolaire ${year[1]}–${year[2]} · copie publiée par HaitiLibre`
   return {url:url.toString(),source:'HaitiLibre',label,school_year:schoolYear,kind}
  }
 }catch{}
 return null
}

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
   const kind:CalendarDocumentKind=/(?:exam|examen|période|periode)/i.test(haystack)?'exam_calendar':'school_calendar'
   found.set(url.toString(),{url:url.toString(),source,label:label.slice(0,240),school_year:year?`${year[1]}/${year[2]}`:null,kind})
  }catch{}
 }
 return [...found.values()]
}
