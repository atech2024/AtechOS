'use client'
import Image from 'next/image'
import {QRCodeSVG} from 'qrcode.react'
import {schoolTime} from '@/lib/school-date'
import {T,useLocale} from '@/components/translation-provider'
import {translate} from '@/lib/translations'
import {LogIn,LogOut,ShieldCheck} from 'lucide-react'
type Identity={first_name:string;last_name:string;atechos_id:string;class_name?:string|null;academic_year?:string|null;photo_available?:boolean}
export default function StudentIdentityCard({student,attendance,qr}:{student:Identity;qr?:string|null;attendance?:{check_in_at:string|null;check_out_at:string|null}|null}){
 const time=schoolTime
 const locale=useLocale()
 return <section className="student-identity-card my-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-label={translate('Student portal',locale)}>
  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
   <div className="flex h-28 w-24 shrink-0 items-center justify-center self-start overflow-hidden rounded-2xl bg-[#e9f3ff] text-3xl font-bold text-[#0757a8] ring-1 ring-[#d5e7fa] sm:h-32 sm:w-28">{student.photo_available?<Image unoptimized src="/student/photo" alt={`${student.first_name} ${student.last_name}`} width={112} height={128} className="h-full w-full object-cover"/>:<span aria-hidden="true">{student.first_name[0]}{student.last_name[0]}</span>}</div>
   <div className="min-w-0 flex-1"><h2 className="break-words font-serif text-2xl font-medium leading-tight tracking-[-.025em] text-[#081a35] sm:text-[30px]">{student.first_name} {student.last_name}</h2><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700"><p><T text="Class"/> : <strong>{student.class_name||'—'}</strong></p><p><T text="Academic year"/> : <strong>{student.academic_year||'—'}</strong></p></div><p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#f1f6fc] px-3 py-2 font-mono text-sm font-semibold text-[#164c81]"><ShieldCheck size={16} aria-hidden="true"/>{student.atechos_id}</p></div>
   <div className="flex w-fit flex-col items-center rounded-2xl border border-slate-200 bg-white p-3 sm:ml-auto">{qr?<QRCodeSVG value={qr} size={104} aria-label={translate('Student badge QR code',locale)}/>:<p className="max-w-28 text-center text-xs leading-5 text-slate-600"><T text="Ask the school to issue your badge QR."/></p>}<p className="mt-2 text-center text-xs font-medium text-slate-600">AtechOS ID</p></div>
  </div>
  <div className="mt-5 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
   <div className="student-attendance-entry flex min-h-[88px] items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm"><LogIn size={21} strokeWidth={2.2} aria-hidden="true"/></span><div><p className="text-sm font-semibold text-emerald-950"><T text="Check-in"/></p><p className="mt-1 text-xs text-emerald-800"><T text="Attendance today"/></p></div><strong className="ml-auto text-xl tabular-nums text-emerald-950">{time(attendance?.check_in_at)}</strong></div>
   <div className="student-attendance-exit flex min-h-[88px] items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-600 text-white shadow-sm"><LogOut size={21} strokeWidth={2.2} aria-hidden="true"/></span><div><p className="text-sm font-semibold text-rose-950"><T text="Check-out"/></p><p className="mt-1 text-xs text-rose-800"><T text="Attendance today"/></p></div><strong className="ml-auto text-xl tabular-nums text-rose-950">{time(attendance?.check_out_at)}</strong></div>
  </div>
 </section>
}
