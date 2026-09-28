'use client'
import {useCallback,useEffect,useState} from 'react'
import Link from 'next/link'
import {createClient} from '@/lib/supabase/client'
import {schoolDateTime} from '@/lib/school-date'
import {T,useLocale} from '@/components/translation-provider'
import {translate} from '@/lib/translations'

type Vote={actor_id:string;actor_name:string;actor_role:string;decision:string;comment:string|null;created_at:string}
type Event={id:string;actor_name:string;actor_role:string;action:string;created_at:string;detail:{comment?:string;reason?:string;old?:{enabled:boolean;role:string};new?:{enabled:boolean;role:string}}}
type Request={id:string;target_name:string;requester:string;kind:string;reason:string;payload:{role:string|null};status:string;required_approvals:number;approval_count:number;can_vote:boolean;can_cancel:boolean;votes:Vote[];events:Event[];created_at:string}
type Workspace={owner:boolean;teachers:{id:string;name:string;enabled:boolean}[];requests:Request[]}
const statuses:Record<string,string>={pending:'Pending approval',applied:'Applied',rejected:'Rejected',cancelled:'Cancelled',executing:'Applying'}
const actions:Record<string,string>={requested:'Requested',approve:'Approved',reject:'Rejected',cancelled:'Cancelled',applied:'Applied'}
const errors:Record<string,string>={already_voted:'You have already voted on this request.',request_closed:'This request is closed.',approval_already_pending:'A request is already pending for this teacher.',target_changed_create_new_request:'Access has changed. Cancel this request and create a new one.',reason_required:'Provide a reason of at least three characters.'}
export default function ApprovalsPage(){
 const locale=useLocale(),t=(text:string)=>translate(text,locale)
 const [data,setData]=useState<Workspace|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true)
 const [teacher,setTeacher]=useState(''),[action,setAction]=useState('disable'),[role,setRole]=useState('director'),[reason,setReason]=useState(''),[comments,setComments]=useState<Record<string,string>>({})
 const load=useCallback(async()=>{try{const r=await createClient().rpc('school_approval_workspace');if(r.error)throw r.error;setData(r.data)}catch{setData(null);setError('Unable to load approvals. Verify your access.')}finally{setLoading(false)}},[])
 useEffect(()=>{void load()},[load])
 function failed(e:unknown){const code=e&&typeof e==='object'&&'message'in e?String(e.message):'';setError(errors[code]||'Action refused. Reload the records and verify your access and selection.')}
 async function decide(id:string,decision:string){if(!window.confirm(t('Confirm this access decision? The second approval applies the change.')))return;setBusy(true);setError('');try{const r=await createClient().rpc('review_school_approval',{p_request:id,p_decision:decision,p_comment:comments[id]||null});if(r.error)throw r.error;await load()}catch(e){failed(e)}finally{setBusy(false)}}
 return <main className="mx-auto max-w-6xl space-y-6 p-6">
  <Link href="/dashboard"><T text="← Dashboard"/></Link><h1 className="text-3xl font-bold"><T text="Access approvals"/></h1>
  <p><T text="Changing or disabling teacher access requires two different authorized approvers. A request alone never changes access."/></p>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700"><T text={error}/></p>}
  {loading&&<p><T text="Loading..."/></p>}
  {data&&<><form className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();if(!window.confirm(t('Create this approval request? Access remains unchanged until two approvals.')))return;setBusy(true);setError('');try{const r=await createClient().rpc('request_teacher_access_change',{p_member:teacher,p_action:action,p_reason:reason,p_role:action==='role'?role:null});if(r.error)throw r.error;setReason('');await load()}catch(e){failed(e)}finally{setBusy(false)}}}>
   <h2 className="text-xl font-semibold sm:col-span-2"><T text="Request teacher access change"/></h2>
   <label><T text="Teacher"/><select required disabled={busy} value={teacher} onChange={e=>setTeacher(e.target.value)} className="mt-1 block w-full rounded border p-2"><option value=""><T text="Choose"/></option>{data.teachers.map(x=><option key={x.id} value={x.id}>{x.name} · {t(x.enabled?'Active':'Inactive')}</option>)}</select></label>
   <label><T text="Action"/><select disabled={busy} value={action} onChange={e=>setAction(e.target.value)} className="mt-1 block w-full rounded border p-2"><option value="disable"><T text="Disable teacher access"/></option><option value="role"><T text="Change role"/></option></select></label>
   {action==='role'&&<label><T text="New role"/><select value={role} disabled={busy} onChange={e=>setRole(e.target.value)} className="mt-1 block w-full rounded border p-2">{[...(data.owner?['school_admin']:[]),'director','censeur','secretary','accountant','surveillant','parent','student'].map(r=><option value={r} key={r}>{r==='censeur'?t('Academic reviewer'):r}</option>)}</select></label>}
   <label className="sm:col-span-2"><T text="Reason"/><textarea required minLength={3} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 block w-full rounded border p-2"/></label>
   <button disabled={busy||!teacher||reason.trim().length<3} className="rounded-xl bg-blue-600 p-3 text-white disabled:opacity-40"><T text="Create approval request"/></button>
  </form>
  <h2 className="text-xl font-semibold"><T text="Requests and decisions"/></h2>
  {!data.requests.length&&<p><T text="No approval requests."/></p>}
  {data.requests.map(r=><article key={r.id} className="space-y-3 rounded-2xl border bg-white p-5">
   <div className="flex flex-wrap justify-between gap-3"><h3 className="text-lg font-semibold">{r.target_name}</h3><span className="rounded-full bg-blue-50 px-3 py-1 text-sm"><T text={statuses[r.status]||r.status}/></span></div>
   <p><T text={r.kind==='teacher_disable'?'Disable teacher access':'Change role'}/>{r.kind==='teacher_role'&&<> → {r.payload.role==='censeur'?t('Academic reviewer'):r.payload.role}</>}</p>
   <p>{r.reason}</p><p className="text-sm text-slate-600">{r.requester} · {schoolDateTime(r.created_at)}</p>
   <p><T text="Approvals received"/>: {r.approval_count}/{r.required_approvals}{r.status==='pending'&&<> · <T text="Remaining"/>: {Math.max(0,r.required_approvals-r.approval_count)}</>}</p>
   {r.status==='pending'&&(r.can_vote||r.can_cancel)&&<div className="space-y-3"><label><T text="Comment or rejection reason"/><textarea value={comments[r.id]||''} onChange={e=>setComments(v=>({...v,[r.id]:e.target.value}))} maxLength={2000} className="mt-1 block w-full rounded border p-2"/></label><div className="flex flex-wrap gap-3">{r.can_vote&&<><button disabled={busy} onClick={()=>decide(r.id,'approve')} className="rounded bg-emerald-700 px-4 py-2 text-white"><T text="Approve"/></button><button disabled={busy||(comments[r.id]||'').trim().length<3} onClick={()=>decide(r.id,'reject')} className="rounded border border-red-300 px-4 py-2 text-red-700 disabled:opacity-40"><T text="Reject"/></button></>}{r.can_cancel&&<button disabled={busy||(comments[r.id]||'').trim().length<3} onClick={()=>decide(r.id,'cancel')} className="rounded border px-4 py-2 disabled:opacity-40"><T text="Cancel request"/></button>}</div></div>}
   <details className="rounded border p-3"><summary><T text="Decision history"/></summary>{r.votes.map(v=><p key={v.actor_id} className="mt-2">{v.actor_name} ({v.actor_role}) · <T text={actions[v.decision]||v.decision}/> · {schoolDateTime(v.created_at)} · {v.comment}</p>)}{r.events.map(e=><div key={e.id} className="mt-2 border-t pt-2 text-sm"><p>{e.actor_name} ({e.actor_role}) · <T text={actions[e.action]||e.action}/> · {schoolDateTime(e.created_at)}</p><p>{e.detail.comment||e.detail.reason}</p>{e.detail.old&&e.detail.new&&<p>{e.detail.old.role} / <T text={e.detail.old.enabled?'Active':'Inactive'}/> → {e.detail.new.role} / <T text={e.detail.new.enabled?'Active':'Inactive'}/></p>}</div>)}</details>
  </article>)}</>}
 </main>
}
