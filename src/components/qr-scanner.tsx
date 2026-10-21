'use client'
import { T } from '@/components/translation-provider'
import { Camera, CameraOff, SwitchCamera } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type FacingMode = 'environment' | 'user'

export default function QRScanner({ onRead, keepActive = false }: { onRead: (code: string) => void; keepActive?: boolean }) {
 const video=useRef<HTMLVideoElement>(null),controls=useRef<{stop:()=>void}|null>(null),mounted=useRef(true),generation=useRef(0),lastRead=useRef<{value:string;at:number}|null>(null)
 const [active,setActive]=useState(false),[error,setError]=useState(''),[facingMode,setFacingMode]=useState<FacingMode>('environment')
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;controls.current?.stop();controls.current=null}},[])
 async function start(mode:FacingMode=facingMode) {
  const current=++generation.current;setError('');setActive(true)
  try {const {BrowserQRCodeReader}=await import('@zxing/browser');if(!mounted.current||current!==generation.current)return;const reader=new BrowserQRCodeReader();const handle=await reader.decodeFromConstraints({video:{facingMode:{ideal:mode}},audio:false},video.current!, (result,_error,control)=>{if(!mounted.current||current!==generation.current){control.stop();return}if(result){const value=result.getText().trim(),now=Date.now(),previous=lastRead.current;if(previous?.value===value&&now-previous.at<10000)return;lastRead.current={value,at:now};if(!keepActive){generation.current++;control.stop();controls.current=null;setActive(false)}onRead(value)}});if(!mounted.current||current!==generation.current)handle.stop();else controls.current=handle}
  catch {if(mounted.current&&current===generation.current){setActive(false);setError('Camera unavailable. Allow camera access or enter the AtechOS ID manually.')}}
 }
 function stop(){generation.current++;controls.current?.stop();controls.current=null;setActive(false)}
 function chooseCamera(mode:FacingMode){if(mode===facingMode)return;controls.current?.stop();controls.current=null;setFacingMode(mode);void start(mode)}
 return <div className="space-y-3">
  <div className="flex flex-wrap items-center gap-2">
   {!active?<button type="button" onClick={()=>void start()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#056cd3] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0757a8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#056cd3] focus-visible:ring-offset-2"><Camera size={17} aria-hidden="true"/><T text="Scan QR with camera"/></button>:<>
    <button type="button" onClick={stop} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#056cd3] focus-visible:ring-offset-2"><CameraOff size={17} aria-hidden="true"/><T text="Stop camera"/></button>
    <span id="camera-facing-label" className="sr-only"><T text="Camera facing"/></span><div className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white p-1" role="group" aria-labelledby="camera-facing-label">
     <button type="button" aria-pressed={facingMode==='environment'} onClick={()=>chooseCamera('environment')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 aria-pressed:bg-[#e9f3ff] aria-pressed:text-[#0757a8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#056cd3] sm:px-3"><SwitchCamera size={15} aria-hidden="true"/><T text="Back camera"/></button>
     <button type="button" aria-pressed={facingMode==='user'} onClick={()=>chooseCamera('user')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 aria-pressed:bg-[#e9f3ff] aria-pressed:text-[#0757a8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#056cd3] sm:px-3"><Camera size={15} aria-hidden="true"/><T text="Front camera"/></button>
    </div>
    <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-800"><span className="size-2 rounded-full bg-emerald-500" aria-hidden="true"/><T text="Camera active. Scan a badge; it stays on for the next person."/></span>
   </>}
  </div>
  {active&&<video ref={video} muted playsInline aria-label="Live camera view for scanning student badges" className="aspect-video w-full rounded-xl bg-slate-950 object-cover shadow-inner"/>}
  {error&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"><T text={error}/></p>}
 </div>
}
