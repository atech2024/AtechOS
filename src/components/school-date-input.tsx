'use client'
import {useCallback,useEffect,useMemo,useRef,useState,type ChangeEvent,type InputHTMLAttributes} from 'react'
import {T,useLocale} from '@/components/translation-provider'
import {dateInputText,dateWithinRange,parseDateInput} from '@/lib/school-date'

const months={
 ht:['Janvye','Fevriye','Mas','Avril','Me','Jen','Jiyè','Out','Septanm','Oktòb','Novanm','Desanm'],
 fr:['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
 en:['January','February','March','April','May','June','July','August','September','October','November','December'],
}
const weekdays={ht:['Lendi','Madi','Mèkredi','Jedi','Vandredi','Samdi','Dimanch'],fr:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],en:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']}
const datePart=(value:string)=>value.split('T')[0]||''
const monthStart=(value:string)=>{const m=/^(\d{4})-(\d{2})/.exec(datePart(value));return m?`${m[1]}-${m[2]}-01`:''}
const asDate=(year:number,month:number,day:number)=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
const currentDate=()=>{const d=new Date();return asDate(d.getFullYear(),d.getMonth()+1,d.getDate())}
const dateWithin=dateWithinRange

export default function SchoolDateInput(props:InputHTMLAttributes<HTMLInputElement>){
 const {value,defaultValue,onChange,type,min,max,className,required,disabled,...rest}=props
 const datetime=type==='datetime-local',locale=useLocale(),labelRef=useRef<HTMLDivElement>(null)
 const initial=String(value??defaultValue??'')
 const format=useCallback((v:string)=>{const d=dateInputText(datePart(v));if(!datetime||!d)return d;const t=v.split('T')[1];if(!t)return d;const [h,m]=t.split(':').map(Number);return `${d} ${String(h%12||12).padStart(2,'0')}:${String(m||0).padStart(2,'0')} ${h>=12?'PM':'AM'}`},[datetime])
 const [text,setText]=useState(format(initial)),[iso,setIso]=useState(initial),[open,setOpen]=useState(false)
 const [view,setView]=useState(()=>monthStart(initial||String(min||'')||currentDate()))
 const minDay=typeof min==='string'?datePart(min):'',maxDay=typeof max==='string'?datePart(max):''
 useEffect(()=>{if(value!==undefined&&String(value)!==iso){const next=String(value);setIso(next);setText(format(next));if(next)setView(monthStart(next))}},[value,iso,format])
 useEffect(()=>{if(open){const close=(event:MouseEvent)=>{if(labelRef.current&&!labelRef.current.contains(event.target as Node))setOpen(false)};const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('mousedown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',key)}}},[open])
 useEffect(()=>{if(iso&&!dateWithin(datePart(iso),minDay,maxDay)){setIso('');setText('');onChange?.({target:{value:''},currentTarget:{value:''}} as ChangeEvent<HTMLInputElement>)}},[minDay,maxDay,iso,onChange])
 const match=/^(\d{4})-(\d{2})-01$/.exec(view),year=Number(match?.[1]||new Date().getFullYear()),month=Number(match?.[2]||new Date().getMonth()+1)
 const firstYear=minDay?Number(minDay.slice(0,4)):year-100,lastYear=maxDay?Number(maxDay.slice(0,4)):year+10
 const yearOptions=useMemo(()=>Array.from({length:Math.max(1,lastYear-firstYear+1)},(_,i)=>firstYear+i),[firstYear,lastYear])
 const offset=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7,days=new Date(Date.UTC(year,month,0)).getUTCDate()
 const dateCells=[...Array(offset).fill(''),...Array.from({length:days},(_,i)=>asDate(year,month,i+1))]
 while(dateCells.length%7)dateCells.push('')
 const textValue=locale==='ht'?'Chwazi dat':locale==='fr'?'Choisir une date':'Choose date'
 function emit(next:string,nextText=format(next)){
  setIso(next);setText(nextText)
  const display=labelRef.current?.querySelector('input')
  display?.setCustomValidity(next||!nextText?'':`Dat la dwe ant ${dateInputText(minDay)||'—'} ak ${dateInputText(maxDay)||'—'}.`)
  onChange?.({target:{value:next},currentTarget:{value:next}} as ChangeEvent<HTMLInputElement>)
 }
 function parse(raw:string){
  let next=parseDateInput(raw),valid=Boolean(next)
  if(datetime){const m=/^(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i.exec(raw);next='';valid=Boolean(m&&parseDateInput(m[1])&&+m[2]>=1&&+m[2]<=12&&+m[3]<60);if(valid&&m)next=`${parseDateInput(m[1])}T${String(+m[2]%12+(m[4].toUpperCase()==='PM'?12:0)).padStart(2,'0')}:${m[3]}`}
  const day=datePart(next);if(valid&&!dateWithin(day,minDay,maxDay))valid=false
  return valid?next:''
 }
 function choose(day:string){
  if(!dateWithin(day,minDay,maxDay))return
  let next=day
  if(datetime){const existing=/\d{2}\/\d{2}\/\d{4}\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i.exec(text);const hour=existing?+existing[1]:8,minute=existing?existing[2]:'00',ampm=existing?existing[3].toUpperCase():'AM';next=`${day}T${String(hour%12+(ampm==='PM'?12:0)).padStart(2,'0')}:${minute}`}
  emit(next,format(next));setView(monthStart(day));if(!datetime)setOpen(false)
 }
 function changeTime(part:'hour'|'minute'|'ampm',raw:string){
  const selected=datePart(iso)||parseDateInput(text.split(' ')[0])
  if(!selected)return
  const m=/\d{2}\/\d{2}\/\d{4}\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i.exec(text)
  let h=m?+m[1]:8,min=m?m[2]:'00',ap=m?m[3].toUpperCase():'AM'
  if(part==='hour')h=Number(raw);if(part==='minute')min=raw;if(part==='ampm')ap=raw
  const next=`${selected}T${String(h%12+(ap==='PM'?12:0)).padStart(2,'0')}:${min}`;emit(next,format(next))
 }
 function shiftMonth(delta:number){const d=new Date(Date.UTC(year,month-1+delta,1));setView(asDate(d.getUTCFullYear(),d.getUTCMonth()+1,1))}
 function setCalendarMonth(nextMonth:number){setView(asDate(year,nextMonth,1))}
 function setCalendarYear(nextYear:number){setView(asDate(nextYear,month,1))}
 return <div ref={labelRef} className="relative">
  <div className="flex items-center gap-2"><input {...rest} required={required} type="text" inputMode="text" autoComplete="off" placeholder={datetime?'DD/MM/YYYY hh:mm AM/PM':'DD/MM/YYYY'} className={className} value={text} aria-haspopup="dialog" onClick={()=>setOpen(true)} onChange={e=>{const raw=e.target.value;setText(raw);const next=parse(raw);setIso(next);e.target.setCustomValidity(raw&&!next?`Format attendu : ${datetime?'DD/MM/YYYY hh:mm AM/PM':'DD/MM/YYYY'}${minDay||maxDay?' · date dans l’année/période scolaire':''}`:'');onChange?.({target:{value:next},currentTarget:{value:next}} as ChangeEvent<HTMLInputElement>)}}/>
   <button type="button" disabled={disabled} aria-label={textValue} title={textValue} onClick={()=>setOpen(v=>!v)} className="shrink-0 rounded border border-slate-300 bg-white px-3 py-2 text-lg disabled:opacity-40" aria-haspopup="dialog" aria-expanded={open}>▦</button>
  </div>
  {open&&<div role="dialog" aria-label={textValue} className="absolute left-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-300 bg-white p-4 text-slate-900 shadow-xl">
   <div className="mb-3 flex items-center justify-between gap-2"><button type="button" aria-label={locale==='ht'?'Mwa anvan an':locale==='fr'?'Mois précédent':'Previous month'} onClick={()=>shiftMonth(-1)} disabled={Boolean(minDay&&asDate(year,month,1)<=monthStart(minDay))} className="rounded border px-2 py-1 disabled:opacity-40">‹</button><div className="flex gap-2"><select aria-label={locale==='ht'?'Mwa':locale==='fr'?'Mois':'Month'} value={month} onChange={e=>setCalendarMonth(Number(e.target.value))} className="max-w-36 rounded border p-2">{months[locale].map((name,i)=><option key={name} value={i+1}>{name}</option>)}</select><select aria-label={locale==='ht'?'Ane':locale==='fr'?'Année':'Year'} value={year} onChange={e=>setCalendarYear(Number(e.target.value))} className="rounded border p-2">{yearOptions.map(y=><option key={y} value={y}>{y}</option>)}</select></div><button type="button" aria-label={locale==='ht'?'Mwa apre a':locale==='fr'?'Mois suivant':'Next month'} onClick={()=>shiftMonth(1)} disabled={Boolean(maxDay&&asDate(year,month,days)>=`${maxDay.slice(0,7)}-${maxDay.slice(-2)}`)} className="rounded border px-2 py-1 disabled:opacity-40">›</button></div>
   <div className="grid grid-cols-7 text-center text-xs text-slate-500">{weekdays[locale].map(day=><span key={day} className="py-1">{day}</span>)}</div>
   <div className="grid grid-cols-7 gap-1">{dateCells.map((day,i)=>day?<button type="button" key={day} disabled={!dateWithin(day,minDay,maxDay)} aria-pressed={datePart(iso)===day} onClick={()=>choose(day)} className={`rounded p-2 text-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-30 ${datePart(iso)===day?'bg-blue-600 font-bold text-white hover:bg-blue-700':''}`}>{Number(day.slice(-2))}</button>:<span key={`empty-${i}`}/>)}</div>
   {datetime&&<div className="mt-4 border-t pt-3"><p className="mb-2 text-sm font-semibold"><T text="Time in Haiti"/></p><div className="flex items-center gap-2"><label className="text-xs"><T text="Hour"/><select disabled={!datePart(iso)} value={( /\d{2}\/\d{2}\/\d{4}\s+(\d{1,2}):/i.exec(text)?.[1])||'08'} onChange={e=>changeTime('hour',e.target.value)} className="mt-1 block rounded border p-2">{Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')).map(h=><option key={h}>{h}</option>)}</select></label><span>:</span><label className="text-xs"><T text="Minute"/><select disabled={!datePart(iso)} value={/\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:(\d{2})/i.exec(text)?.[1]||'00'} onChange={e=>changeTime('minute',e.target.value)} className="mt-1 block rounded border p-2">{Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m}>{m}</option>)}</select></label><label className="text-xs"><T text="AM / PM"/><select disabled={!datePart(iso)} value={/\b(AM|PM)$/i.exec(text)?.[1]?.toUpperCase()||'AM'} onChange={e=>changeTime('ampm',e.target.value)} className="mt-1 block rounded border p-2"><option>AM</option><option>PM</option></select></label></div></div>}
   <button type="button" onClick={()=>setOpen(false)} className="mt-3 w-full rounded border p-2"><T text="Close calendar"/></button>
   {(minDay||maxDay)&&<p className="mt-2 text-xs text-slate-500"><T text="Dates are limited to the selected school year or period."/></p>}
  </div>}
 </div>
}
