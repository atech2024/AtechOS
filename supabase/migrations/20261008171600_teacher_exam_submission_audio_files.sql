-- Extend the private exam-file bucket to accept supported audio attachments.
-- Keep existing document/image formats and the current 25 MiB limit.
update storage.buckets
set allowed_mime_types = array[
 'application/pdf',
 'application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'image/jpeg',
 'image/png',
 'image/webp',
 'audio/mpeg',
 'audio/wav',
 'audio/mp4',
 'audio/aac',
 'audio/ogg',
 'audio/webm',
 'audio/flac'
]
where id='teacher-exam-files' and public=false and file_size_limit=26214400;

do $$
begin
 if not exists(
  select 1 from storage.buckets
  where id='teacher-exam-files' and public=false and file_size_limit=26214400
   and 'audio/mpeg'=any(allowed_mime_types)
 ) then
  raise exception 'private_exam_audio_bucket_not_ready';
 end if;
end $$;
