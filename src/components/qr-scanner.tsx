'use client'
import { T } from '@/components/translation-provider'
import { Camera, CameraOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function QRScanner({ onRead, keepActive = false }: { onRead: (code: string) => void; keepActive?: boolean }) {
 const video=useRef<HTMLVideoElement>(null),controls=useRef<{stop:()=>void}|null>(null),mounted=useRef(true),generation=useRef(0),lastRead=useRef<{value:string;at:number}|null>(null)
 const [active,setActive]=useState(false),[error,setError]=useState('')
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;controls.current?.stop();controls.current=null}},[])
 async function start() {
  const current=++generation.current;setError('');setActive(true)
  try {const {BrowserQRCodeReader}=await import('@zxing/browser');if(!mounted.current||current!==generation.current)return;const reader=new BrowserQRCodeReader();const handle=await reader.decodeFromConstraints({video:{facingMode:'environment'},audio:false},video.current!, (result,_error,control)=>{if(!mounted.current||current!==generation.current){control.stop();return}if(result){const value=result.getText().trim(),now=Date.now(),previous=lastRead.current;if(previous?.value===value&&now-previous.at<10000)return;lastRead.current={value,at:now};if(!keepActive){generation.current++;control.stop();controls.current=null;setActive(false)}onRead(value)}});if(!mounted.current||current!==generation.current)handle.stop();else controls.current=handle}
  catch {if(mounted.current&&current===generation.current){setActive(false);setError('Camera unavailable. Allow camera access or enter the AtechOS ID manually.')}}
 }
 function stop(){generation.current++;controls.current?.stop();controls.current=null;setActive(false)}
 return <div className="space-y-3">
  <div className="flex flex-wrap items-center gap-2">
   {!active?<button type="button" onClick={start} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#056cd3] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0757a8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#056cd3] focus-visible:ring-offset-2"><Camera size={17} aria-hidden="true"/><T text="Scan QR with camera"/></button>:<button type="button" onClick={stop} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#056cd3] focus-visible:ring-offset-2"><CameraOff size={17} aria-hidden="true"/><T text="Stop camera"/></button>}
   {active&&<span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800"><span className="size-2 rounded-full bg-emerald-500" aria-hidden="true"/><T text="Camera active. Scan a badge; it stays on for the next person."/></span>}
  </div>
  {active&&<video ref={video} muted playsInline aria-label="Live camera view for scanning student badges" className="aspect-video w-full rounded-xl bg-slate-950 object-cover shadow-inner"/>}
  {error&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"><T text={error}/></p>}
 </div>
}
