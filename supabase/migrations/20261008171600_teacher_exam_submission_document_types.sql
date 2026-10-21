-- Limit private exam attachments to the document formats requested by the school.
update storage.buckets
set allowed_mime_types = array[
 'application/pdf',
 'application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id='teacher-exam-files';

do $$
begin
 if not exists(
  select 1 from storage.buckets
  where id='teacher-exam-files' and public=false and file_size_limit=26214400
   and allowed_mime_types=array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
   ]
 ) then
  raise exception 'exam_document_bucket_not_ready';
 end if;
end $$;
