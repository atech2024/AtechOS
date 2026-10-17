import type {createClient} from '@/lib/supabase/client'

const BUCKET='assignment-files'
const MAX_ATTACHMENT_BYTES=50*1024*1024

export function privateAssignmentAttachmentError(message:string){
 if(/no such key|object not found/i.test(message))return 'Assignment attachment is no longer available. Ask the teacher to upload it again.'
 return 'Unable to prepare the private assignment link. Please try again or contact the school.'
}

export async function replaceAssignmentAttachment(
 db:ReturnType<typeof createClient>,
 schoolId:string,
 assignmentId:string,
 file:File,
){
 if(file.size>MAX_ATTACHMENT_BYTES)throw new Error('Attachment must be 50 MB or smaller.')
 const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_')
 const path=`${schoolId}/${assignmentId}/${Date.now()}-${safeName}`
 const {data,error}=await db.storage.from(BUCKET).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false})
 if(error)throw error
 if(!data?.path)throw new Error('The uploaded attachment path is unavailable.')
 const {error:updateError}=await db.rpc('update_assignment_attachment',{p_assignment_id:assignmentId,p_attachment_url:data.path})
 if(updateError)throw updateError
 return data.path
}

