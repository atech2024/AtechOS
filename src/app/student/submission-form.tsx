'use client'
import {useState} from 'react'
import {submitAssignment} from './submit-actions'
export default function SubmissionForm({id}:{id:string}){
 const [text,setText]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 return <form className="mt-4 space-y-2" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{const r=await submitAssignment(id,text);setMessage(r.error||'Devoir remis.')}catch{setMessage('Remise impossible. Réessayez.')}finally{setBusy(false)}}}><label className="block">Réponse / lien vers votre travail<textarea required maxLength={20000} value={text} onChange={e=>setText(e.target.value)} className="block w-full rounded border p-3"/></label><button disabled={busy} className="rounded bg-blue-600 p-3 text-white">Remettre le devoir</button>{message&&<p role="status">{message}</p>}</form>
}
