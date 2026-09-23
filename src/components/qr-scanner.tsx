'use client'
import { T } from '@/components/translation-provider'
import { useEffect,useRef,useState } from 'react'
export default function QRScanner({onRead}:{onRead:(code:string)=>void}) {
 const video=useRef<HTMLVideoElement>(null),controls=useRef<{stop:()=>void}|null>(null),mounted=useRef(true),generation=useRef(0)
 const [active,setActive]=useState(false),[error,setError]=useState('')
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;controls.current?.stop()}},[])
 async function start() {
  const current=++generation.current;setError('');setActive(true)
  try {const {BrowserQRCodeReader}=await import('@zxing/browser');if(!mounted.current||current!==generation.current)return;const reader=new BrowserQRCodeReader();const handle=await reader.decodeFromConstraints({video:{facingMode:'environment'},audio:false},video.current!, (result,_error,control)=>{if(!mounted.current||current!==generation.current){control.stop();return}if(result){generation.current++;control.stop();controls.current=null;setActive(false);onRead(result.getText())}});if(!mounted.current||current!==generation.current)handle.stop();else controls.current=handle}
  catch {if(mounted.current&&current===generation.current){setActive(false);setError('Camera unavailable. Allow camera access or enter the AtechOS ID manually.')}}
 }
 return <div className="my-4"><button type="button" disabled={active} onClick={start} className="rounded border p-3"><T text="Scan QR with camera"/></button>{active && <button type="button" onClick={()=>{generation.current++;controls.current?.stop();setActive(false)}} className="ml-2 rounded border p-3"><T text="Stop camera"/></button>}<video ref={video} muted playsInline className={active?'mt-3 w-full rounded':'hidden'} />{error && <p role="alert">{error}</p>}</div>
}
