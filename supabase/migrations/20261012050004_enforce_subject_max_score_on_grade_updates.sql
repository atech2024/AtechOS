-- The subject's configured maximum must remain authoritative after a grade is
-- created. In particular, reviewed correction publication updates max_score.
drop trigger if exists grades_subject_max_score_guard on public.grades;
create trigger grades_subject_max_score_guard
 before insert or update of subject_id,max_score on public.grades
 for each row execute function private.enforce_grade_subject_max_score();
