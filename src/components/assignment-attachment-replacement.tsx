'use client'
import {useState} from 'react'
import {T} from '@/components/translation-provider'
import {createClient} from '@/lib/supabase/client'
import {replaceAssignmentAttachment} from '@/lib/assignment-attachments'

type Props={schoolId:string;assignmentId:string}

export default function AssignmentAttachmentReplacement({schoolId,assignmentId}:Props){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false)
 async function onChange(input:HTMLInputElement){
  const file=input.files?.[0]
  if(!file)return
  if(file.size>50*1024*1024){setError('Attachment must be 50 MB or smaller.');input.value='';return}
  setBusy(true);setError('');setSuccess(false)
  try{
   await replaceAssignmentAttachment(createClient(),schoolId,assignmentId,file)
   setSuccess(true)
  }catch{
   setError('Could not replace the attachment. Verify your access and try again.')
  }finally{
   input.value='';setBusy(false)
  }
 }
 return <div className="inline-flex flex-col items-start gap-1">
  <label className="cursor-pointer text-sm font-semibold text-blue-700 underline focus-within:outline focus-within:outline-2 focus-within:outline-offset-2">
   <T text={busy?'Uploading replacement...':'Replace attachment'}/>
   <input type="file" disabled={busy} className="sr-only" onChange={e=>void onChange(e.currentTarget)}/>
  </label>
  {error&&<p role="alert" className="text-sm text-red-700"><T text={error}/></p>}
  {success&&<p role="status" className="text-sm text-green-700"><T text="Attachment replaced."/></p>}
 </div>
}
