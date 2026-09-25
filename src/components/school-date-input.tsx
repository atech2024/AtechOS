'use client'
import {useEffect,useState,type InputHTMLAttributes,type ChangeEvent} from 'react'
import {dateInputText,parseDateInput} from '@/lib/school-date'
export default function SchoolDateInput(props:InputHTMLAttributes<HTMLInputElement>){
 const {value,defaultValue,name,onChange,type,...rest}=props;const datetime=type==='datetime-local';
 const format=(v:string)=>{if(!datetime)return dateInputText(v);const [d,t]=v.split('T');if(!t)return '';const [h,m]=t.split(':').map(Number);return `${dateInputText(d)} ${String(h%12||12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`}
 const [text,setText]=useState(format(String(value??defaultValue??''))),[iso,setIso]=useState(String(value??defaultValue??''));
 useEffect(()=>{if(value!==undefined&&String(value)!==iso){setIso(String(value));setText(format(String(value)))}},[value])
 return <><input {...rest} type="text" inputMode="text" placeholder={datetime?'JJ/MM/AAAA hh:mm AM/PM':'JJ/MM/AAAA'} name={undefined} value={text} onChange={e=>{const text=e.target.value;setText(text);let v=parseDateInput(text);if(datetime){const m=/^(\d{2}\/\d{2}\/\d{4}) (\d{1,2}):(\d{2}) (AM|PM)$/i.exec(text);v='';if(m&&parseDateInput(m[1])&&+m[2]>=1&&+m[2]<=12&&+m[3]<60)v=`${parseDateInput(m[1])}T${String(+m[2]%12+(m[4].toUpperCase()==='PM'?12:0)).padStart(2,'0')}:${m[3]}`}setIso(v);e.target.setCustomValidity(text&&!v?'Format attendu : '+(datetime?'JJ/MM/AAAA hh:mm AM/PM':'JJ/MM/AAAA'):'');onChange?.({...e,target:{...e.target,value:v},currentTarget:{...e.currentTarget,value:v}} as ChangeEvent<HTMLInputElement>)}}/><input type="hidden" name={name} value={iso}/></>
}
