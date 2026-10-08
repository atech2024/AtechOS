'use client'
import {useCallback,useEffect,useMemo,useState,type ChangeEvent, type FormEvent} from 'react'
import {createClient} from '@/lib/supabase/client'
import {T,useLocale} from '@/components/translation-provider'
import {translate} from '@/lib/translations'
import {schoolDateTime} from '@/lib/school-date'

type Period={id:string;name:string;academic_year_id:string;start_date:string;end_date:string;sections:string[]}
type ClassItem={id:string;name:string;academic_year_id:string;section:string}
type SubjectItem={class_id:string;subject_id:string;subject_name:string;teacher_id:string}
type Teacher={id:string;name:string}
type Submission={id:string;academic_year_id:string;period_id:string;period_name:string;class_id:string;class_name:string;subject_id:string;subject_name:string;teacher_id:string;teacher_name:string;submitted_by_name:string;submitted_at:string;entry_channel:'teacher_portal'|'direction';file_path:string|null;file_source:'teacher_upload'|'office_usb'|null;file_uploaded_at:string|null}
type Workspace={school_id:string;can_manage:boolean;periods:Period[];classes:ClassItem[];subjects:SubjectItem[];teachers:Teacher[];submissions:Submission[]}
const MAX_FILE_SIZE=25*1024*1024
const EXAM_FILE_TYPES:Record<string,string>={
 '.pdf':'application/pdf',
 '.doc':'application/msword',
 '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}
export function examFileMimeType(file:Pick<File,'name'|'type'>){
 const extension=file.name.toLowerCase().match(/\\.[^.]+$/)?.[0],expected=extension?EXAM_FILE_TYPES[extension]:undefined
 return expected&&(!file.type||file.type.toLowerCase()===expected)?expected:''
}
export function isAllowedExamFile(file:Pick<File,'name'|'type'|'size'>){return Boolean(examFileMimeType(file))&&file.size>0&&file.size<=MAX_FILE_SIZE}
export function defaultExamPeriod(periods:Period[],today:string){
 const active=periods.filter(p=>p.start_date<=p.end_date).sort((a,b)=>a.start_date.localeCompare(b.start_date)||a.name.localeCompare(b.name))
 return active.find(p=>p.start_date<=today&&p.end_date>=today)?.id||active.find(p=>p.start_date>=today)?.id||active.at(-1)?.id||''
}
function safeFileName(name:string){return name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,180)||'exam-file'}
function haitiToday(){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`}
const errorLabels:Record<string,string>={not_authorized:'Access denied.',teacher_required:'Choose a teacher.',teacher_exam_scope_invalid:'The teacher is not assigned to this class and subject, or the period is not active.',exam_file_already_attached:'An exam file is already attached.',invalid_exam_file_path:'The uploaded exam file could not be verified.',duplicate_key:'This exam has already been registered for this period.'}

export default function TeacherExamSubmissions(){
 const locale=useLocale(),t=(v:string)=>translate(v,locale),db=useMemo(()=>createClient(),[])
 const [workspace,setWorkspace]=useState<Workspace|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 const [error,setError]=useState(''),[message,setMessage]=useState('')
 const [periodId,setPeriodId]=useState(''),[classId,setClassId]=useState(''),[subjectId,setSubjectId]=useState(''),[teacherId,setTeacherId]=useState('')
 const [file,setFile]=useState<File|null>(null)
 const today=haitiToday()
 const manager=workspace?.can_manage===true
 const periods=workspace?.periods||[],classes=workspace?.classes||[],subjects=workspace?.subjects||[],teachers=workspace?.teachers||[],submissions=workspace?.submissions||[]
 const selectedPeriod=periods.find(p=>p.id===periodId)
 const eligibleClasses=classes.filter(c=>(!selectedPeriod||(selectedPeriod.academic_year_id===c.academic_year_id&&selectedPeriod.sections.includes(c.section)))&&(!manager||!teacherId||subjects.some(s=>s.class_id===c.id&&s.teacher_id===teacherId)))
 const eligibleSubjects=subjects.filter(s=>s.class_id===classId&&(!manager||!teacherId||s.teacher_id===teacherId))
 const chosenSubject=eligibleSubjects.find(s=>s.subject_id===subjectId)
 const activePeriod=periods.find(p=>p.id===periodId)
 const visibleSubmissions=submissions.filter(s=>!periodId||s.period_id===periodId)

 const load=useCallback(async()=>{
  setLoading(true);setError('')
  const {data,error}=await db.rpc('teacher_exam_submission_workspace')
  if(error){setError(error.message);setWorkspace(null)}else{
   const result=data as Workspace
   setWorkspace(result)
   setPeriodId(current=>current||defaultExamPeriod(result.periods||[],today))
  }
  setLoading(false)
 },[db,today])
 useEffect(()=>{void load()},[load])

 function selectPeriod(value:string){setPeriodId(value);setClassId('');setSubjectId('')}
 function selectClass(value:string){setClassId(value);setSubjectId('')}
 function onFile(event:ChangeEvent<HTMLInputElement>){const next=event.target.files?.[0]||null;setError('');if(next&&!isAllowedExamFile(next)){setFile(null);event.target.value='';setError(t('File must be PDF, DOC or DOCX and no larger than 25 MB.'));return}setFile(next)}
 async function uploadFile(submissionId:string,next:File,staff:boolean){
  const path=`${workspace!.school_id}/${submissionId}/${Date.now()}-${safeFileName(next.name)}`
  const {error:uploadError}=await db.storage.from('teacher-exam-files').upload(path,next,{contentType:examFileMimeType(next),upsert:false})
  if(uploadError)throw uploadError
  const {error:attachError}=await db.rpc('attach_teacher_exam_file',{p_submission_id:submissionId,p_storage_path:path})
  if(attachError){await db.storage.from('teacher-exam-files').remove([path]);throw attachError}
  return staff
 }
 async function save(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setMessage('')
  if(!activePeriod||!classId||!subjectId||!chosenSubject||(manager&&!teacherId)){setError(t('Choose an active period, class, subject and teacher.'));setBusy(false);return}
  const {data,error:submitError}=await db.rpc('create_teacher_exam_submission',{p_class_id:classId,p_subject_id:subjectId,p_period_id:periodId,p_teacher_id:manager?teacherId:null})
  if(submitError){setError(t(submitError.code==='23505'?'This exam has already been registered for this period.':errorLabels[submitError.message]||submitError.message));setBusy(false);return}
  if(file){
   try{await uploadFile(String(data),file,manager)}catch(uploadError){setError(t('The exam was recorded, but the file could not be uploaded. You can attach it from the register.'));setBusy(false);await load();return}
  }
  setMessage(t('Exam submission recorded.'))
  setClassId('');setSubjectId('');setFile(null)
  const input=document.getElementById('teacher-exam-file') as HTMLInputElement|null;if(input)input.value=''
  setBusy(false);await load()
 }
 async function attachExisting(id:string,next:File){
  if(!isAllowedExamFile(next)){setError(t('File must be PDF, Word, an image or audio and no larger than 25 MB.'));return}
  setBusy(true);setError('');setMessage('')
  try{await uploadFile(id,next,true);setMessage(t('Exam file attached to the register.'));await load()}
  catch(e){setError(t((e as {message?:string})?.message||'Unable to upload the exam file.'))}
  finally{setBusy(false)}
 }
 async function openFile(path:string){
  const {data,error}=await db.storage.from('teacher-exam-files').createSignedUrl(path,60)
  if(error||!data?.signedUrl){setError(t('Unable to open the private exam file.'));return}
  window.open(data.signedUrl,'_blank','noopener,noreferrer')
 }
 return <main className="mx-auto max-w-6xl p-5 md:p-8">
  <header className="mb-6"><h1 className="text-3xl font-bold"><T text="Exam submissions"/></h1><p className="mt-2 text-slate-600"><T text="Submit exam papers by active period, class and subject. Direction receives a printable register."/></p></header>
  {error&&<p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{errorLabels[error]?t(errorLabels[error]):error}</p>}
  {message&&<p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">{message}</p>}
  {loading?<p><T text="Loading..."/></p>:!periods.length?<section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold"><T text="No active exam period"/></h2><p className="mt-2 text-slate-600"><T text="The school must activate an exam period for the current academic year before submissions can be recorded."/></p></section>:<>
   <form onSubmit={save} className="mb-8 rounded-2xl border bg-white p-5 shadow-sm print:hidden">
    <h2 className="mb-4 text-xl font-semibold"><T text={manager?'Register an exam received':'Submit an exam'}/></h2>
    <div className="grid gap-4 md:grid-cols-2">
     <label className="grid gap-1 text-sm font-medium"><T text="Exam period"/><select className="rounded-lg border p-3" value={periodId} onChange={e=>selectPeriod(e.target.value)} required><option value=""><T text="Choose a period"/></option>{periods.map(p=><option key={p.id} value={p.id}>{p.name} · {schoolDateTime(p.start_date+'T12:00:00',locale)} – {schoolDateTime(p.end_date+'T12:00:00',locale)}</option>)}</select></label>
     {manager&&<label className="grid gap-1 text-sm font-medium"><T text="Teacher"/><select className="rounded-lg border p-3" value={teacherId} onChange={e=>{setTeacherId(e.target.value);setClassId('');setSubjectId('')}} required><option value=""><T text="Choose a teacher"/></option>{teachers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
     <label className="grid gap-1 text-sm font-medium"><T text="Class"/><select className="rounded-lg border p-3" value={classId} onChange={e=>selectClass(e.target.value)} required disabled={!periodId||!eligibleClasses.length||(manager&&!teacherId)}><option value=""><T text={manager&&!teacherId?"Choose a teacher first to list their classes":periodId&&!eligibleClasses.length?"No class is included in this exam period.":"Choose a class"}/></option>{eligibleClasses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
     <label className="grid gap-1 text-sm font-medium"><T text="Subject"/><select className="rounded-lg border p-3" value={subjectId} onChange={e=>setSubjectId(e.target.value)} required disabled={!classId}><option value=""><T text="Choose a subject"/></option>{eligibleSubjects.map(x=><option key={x.subject_id} value={x.subject_id}>{x.subject_name}</option>)}</select></label>
     <label className="grid gap-1 text-sm font-medium md:col-span-2"><T text={manager?'Optional exam file received on USB':'Optional exam file'}/><input id="teacher-exam-file" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onFile} className="rounded-lg border p-3"/><span className="font-normal text-slate-500"><T text="PDF, DOC or DOCX · maximum 25 MB. The submission can be saved without a file."/></span></label>
    </div>
    <button disabled={busy} className="mt-5 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-60">{busy?<T text="Saving..."/>:<T text={manager?'Save received exam':'Submit exam'}/>}</button>
   </form>
   <section id="exam-submission-register" className="rounded-2xl border bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold"><T text={manager?'Exam receipt register':'My exam submissions'}/></h2><p className="text-sm text-slate-600"><T text="Each record shows the period, teacher, class, subject and receipt date."/></p></div><button type="button" onClick={()=>window.print()} className="rounded-lg border px-4 py-2 font-medium text-blue-800 print:hidden"><T text="Print register"/></button></div>
    <label className="mb-4 flex items-center gap-2 text-sm print:hidden"><T text="Exam period"/><select className="rounded-lg border p-2" value={periodId} onChange={e=>selectPeriod(e.target.value)}>{periods.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    {!visibleSubmissions.length?<p className="rounded-lg bg-slate-50 p-4 text-slate-600"><T text="No exam submissions for this period."/></p>:<div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="border-b text-slate-600">{(manager?['Exam period','Teacher','Class','Subject','Received by','Received on','File']:['Exam period','Class','Subject','Submitted on','File']).map(k=><th key={k} className="px-3 py-3 font-semibold"><T text={k}/></th>)}</tr></thead><tbody>{visibleSubmissions.map(s=><tr key={s.id} className="border-b align-top"><td className="px-3 py-3">{s.period_name}</td>{manager&&<td className="px-3 py-3">{s.teacher_name}</td>}<td className="px-3 py-3">{s.class_name}</td><td className="px-3 py-3">{s.subject_name}</td>{manager&&<td className="px-3 py-3">{s.submitted_by_name}</td>}<td className="px-3 py-3">{schoolDateTime(s.submitted_at,locale)}</td><td className="px-3 py-3">{s.file_path?<button type="button" className="text-blue-700 underline" onClick={()=>void openFile(s.file_path!)}><T text="Open exam file"/></button>:manager?<label className="cursor-pointer text-blue-700 underline print:hidden"><T text="Attach file from USB"/><input type="file" className="sr-only" accept=".pdf,.doc,.docx" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void attachExisting(s.id,f);e.currentTarget.value=''}}/></label>:<span className="text-slate-500"><T text="No file"/></span>}</td></tr>)}</tbody></table></div>}
   </section>
  </>}
 </main>
}
