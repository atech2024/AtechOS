'use client'
import { T } from '@/components/translation-provider'
import { useState } from 'react'
type Data={students:{id:string;first_name:string;last_name:string;atechos_id:string}[];grades:{student_id:string;subject:string;period:string|null;year:string;score:number;max_score:number;weight:number}[]}
export default function FamilyBulletins({data,studentMode=false,hideSelectors=false}:{data:Data;studentMode?:boolean;hideSelectors?:boolean}) {
 const [id,setId]=useState(data.students[0]?.id || '')
 const [year,setYear]=useState('')
 const student=data.students.find(s=>s.id===id)
 const own=data.grades.filter(g=>g.student_id===id)
 const years=Array.from(new Set(own.map(g=>g.year)))
 const selectedYear=years.includes(year)?year:years[0] || ''
 const rows=own.filter(g=>g.year===selectedYear)
 const groups=Array.from(new Set(rows.map(g=>JSON.stringify([g.subject,g.period]))))
 return <main className="mx-auto max-w-5xl p-6"><h1 className="text-3xl font-bold"><T text={studentMode?"Bulletins":"Family bulletins"}/></h1><p className="my-3 print:hidden"><T text={studentMode?"Only your published grades appear here.":"Only your linked children and their published grades appear here."}/></p>{!hideSelectors&&<div className="my-5 flex flex-wrap gap-4 print:hidden"><label><T text={studentMode?"Student":"Child"}/><select value={id} onChange={e=>setId(e.target.value)} className="ml-2 rounded border p-3">{data.students.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}</select></label><label><T text="Academic year"/><select value={selectedYear} onChange={e=>setYear(e.target.value)} className="ml-2 rounded border p-3">{years.map(y=><option key={y}>{y}</option>)}</select></label><button disabled={!rows.length} onClick={()=>window.print()} className="rounded border p-3"><T text="Print / Save PDF"/></button></div>}{hideSelectors&&<button disabled={!rows.length} onClick={()=>window.print()} className="my-3 rounded border p-3 print:hidden"><T text="Print / Save PDF"/></button>}{student && <h2 className="my-4 text-xl font-semibold">{student.first_name} {student.last_name} · {student.atechos_id} · {selectedYear}</h2>}{rows.length ? <table className="w-full text-left"><thead><tr><th><T text="Subject"/></th><th><T text="Period"/></th><th><T text="Average / 10"/></th></tr></thead><tbody>{groups.map(key=>{const [subject,period]=JSON.parse(key);const grades=rows.filter(g=>g.subject===subject && g.period===period);const weight=grades.reduce((n,g)=>n+Number(g.weight||100),0);const average=grades.reduce((n,g)=>n+Number(g.score)/Number(g.max_score)*10*Number(g.weight||100),0)/weight;return <tr key={key} className="border-t"><td className="py-3">{subject}</td><td>{period || '—'}</td><td>{average.toFixed(2)}</td></tr>})}</tbody></table>:<p><T text="No published bulletin available."/></p>}</main>
}
