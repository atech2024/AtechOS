'use client'
/* eslint-disable @next/next/no-img-element -- The preview is a generated local SVG data URI, not an optimizable remote image. */

import {useMemo,useState} from 'react'
import {BookOpen,Printer,RefreshCw,Palette,CheckCircle2} from 'lucide-react'
import {activityTypes,generateWorksheet,worksheetLevels,worksheetPrintHTML,type ActivityType,type WorksheetTheme} from '@/lib/preschool-worksheets'

export default function PreschoolWorksheetGenerator({schoolName}:{schoolName:string}){
 const [kind,setKind]=useState<ActivityType>('count'),[level,setLevel]=useState('PS2'),[theme,setTheme]=useState<WorksheetTheme>('animals'),[count,setCount]=useState(6),[letter,setLetter]=useState('A'),[color,setColor]=useState(true),[seed,setSeed]=useState(1),[correction,setCorrection]=useState(false),[notice,setNotice]=useState('')
 const worksheet=useMemo(()=>generateWorksheet({schoolName,kind,level,theme,count,letter,color,seed}),[schoolName,kind,level,theme,count,letter,color,seed])
 const preview='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(worksheet.svg)
 function print(){
  setNotice('')
  const frame=document.createElement('iframe');frame.title='Fiche AtechOS prête à imprimer';frame.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0'
  frame.onload=()=>{
   const win=frame.contentWindow
   if(!win){setNotice('L’impression est indisponible. Réessayez dans un autre navigateur.');frame.remove();return}
   win.addEventListener('afterprint',()=>frame.remove(),{once:true})
   win.focus();win.print()
  }
  frame.srcdoc=worksheetPrintHTML(worksheet,correction);document.body.appendChild(frame)
  setNotice('Dans la fenêtre d’impression, choisissez votre imprimante ou « Enregistrer au format PDF ».')
 }
 const control='mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700'
 return <section lang="fr" aria-label="Générateur de fiches pédagogiques" className="space-y-5">
  <div className="grid gap-5 rounded-2xl bg-[#081a35] p-5 text-white md:grid-cols-[1fr_auto] md:p-6"><div><h3 className="text-2xl font-bold">De jolies fiches, pour leurs premiers déclics.</h3><p className="mt-2 max-w-2xl text-base leading-relaxed text-blue-100">Des chats curieux, des pommes à compter, des fusées à découvrir… Préparez une activité originale avec le nom de votre école et AtechOS.</p><p className="mt-3 flex items-center gap-2 text-sm text-blue-100"><CheckCircle2 size={17} aria-hidden="true"/><span className="break-words">{schoolName||'Nom de l’école indisponible'}</span></p></div><BookOpen size={54} className="hidden self-center text-amber-300 md:block" aria-hidden="true"/></div>
  <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
   <form onSubmit={e=>e.preventDefault()} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
    <div><h4 className="text-lg font-bold text-slate-950">Préparer ma fiche</h4><p className="mt-1 text-sm text-slate-600">L’aperçu se met à jour avec vos choix.</p></div>
    <label className="block text-sm font-semibold text-slate-800">Type d’exercice<select className={control} value={kind} onChange={e=>setKind(e.target.value as ActivityType)}>{activityTypes.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold text-slate-800">Niveau<select className={control} value={level} onChange={e=>setLevel(e.target.value)}>{worksheetLevels.map(l=><option key={l}>{l}</option>)}</select></label><label className="block text-sm font-semibold text-slate-800">Exercices<select className={control} value={count} onChange={e=>setCount(Number(e.target.value))}><option value={4}>4 exercices</option><option value={6}>6 exercices</option></select></label></div>
    <p className="text-sm text-slate-600">PS1 : petite section · PS2 : moyenne section · PS3 : grande section. Les niveaux sont indicatifs.</p>
    <fieldset><legend className="text-sm font-semibold text-slate-800">Le monde de ma fiche</legend><div className="mt-2 grid grid-cols-3 gap-2">{([['animals','Les chats'],['fruit','Les pommes'],['space','Les fusées']] as const).map(([value,label])=><label key={value} className={`cursor-pointer rounded-lg border p-2 text-center text-sm ${theme===value?'border-blue-700 bg-blue-50 text-blue-900':'border-slate-300 text-slate-700'}`}><input type="radio" className="mr-1 accent-blue-700" name="worksheet-theme" value={value} checked={theme===value} onChange={()=>setTheme(value)}/>{label}</label>)}</div></fieldset>
    {kind==='letters'&&<label className="block text-sm font-semibold text-slate-800">Lettre à travailler<select className={control} value={letter} onChange={e=>setLetter(e.target.value)}>{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l=><option key={l}>{l}</option>)}</select></label>}
    <div className="space-y-3"><label className="flex items-center gap-2 text-sm text-slate-800"><input type="checkbox" className="h-4 w-4 accent-blue-700" checked={color} onChange={e=>setColor(e.target.checked)}/><Palette size={16} aria-hidden="true"/>Des dessins en couleur</label><label className="flex items-center gap-2 text-sm text-slate-800"><input type="checkbox" className="h-4 w-4 accent-blue-700" checked={correction} onChange={e=>setCorrection(e.target.checked)}/>Ajouter la page adulte / le corrigé</label></div>
    <button type="button" onClick={()=>{setSeed(s=>s+1);setNotice('Une nouvelle variante est prête.')}} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"><RefreshCw size={17} aria-hidden="true"/>Générer une autre variante</button>
    <button type="button" onClick={print} disabled={!schoolName.trim()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"><Printer size={18} aria-hidden="true"/>Imprimer / Enregistrer en PDF</button>
    {!schoolName.trim()&&<p role="alert" className="text-sm text-red-700">Le nom de l’école doit être disponible avant d’imprimer.</p>}
    <p className="text-sm text-slate-600">Format A4 · {correction?'2 pages : activité et accompagnement':'1 page : activité enfant'}. Décochez la couleur pour une fiche à colorier.</p><p role="status" aria-live="polite" className="text-sm text-blue-800">{notice}</p>
   </form>
   <div className="min-w-0 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-slate-900">Aperçu de la fiche</h4><span className="text-sm text-slate-600">{activityTypes.find(a=>a.id===kind)?.description}</span></div><div className="rounded-2xl border border-slate-200 bg-slate-100 p-3 sm:p-6"><img className="mx-auto h-auto w-full max-w-[595px] bg-white shadow-sm" src={preview} alt={`${worksheet.title} · ${schoolName} · AtechOS`} width={595} height={842}/></div>
    {correction&&<details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-slate-800">Voir le corrigé / les pistes d’observation</summary><ol className="mt-3 list-decimal space-y-2 pl-6 text-sm text-slate-700">{worksheet.answers.map((answer,i)=><li key={i}>{answer}</li>)}</ol></details>}
   </div>
  </div>
  <p className="text-sm leading-relaxed text-slate-600">Choisissez une activité selon les besoins de l’enfant, sans imposer de résultat. Les dessins et exercices sont originaux. Aucun nom d’enfant n’est enregistré. Ces fiches n’ont pas encore été validées par un professionnel de l’éducation.</p>
 </section>
}
