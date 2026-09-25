# Homework and attendance workflows

## Student work
- Assignments show subject and the name of the account that published them.
- In Assignments, open **Suivre les remises** to mark physical work received. Server time records receipt; unreceived work becomes missing after the deadline. Work marked received after the deadline is late.
- Enable **Autoriser la remise en ligne** per assignment after setting its deadline. Students can submit text or a link to their work, only for their own current class before the deadline. This does not upload student files; teacher attachments remain supported separately.
- Student bulletins show only published grades. Administrators, directors, secretaries and surveillants review and publish from Publication des bulletins. Saving grades alone does not publish a bulletin. Existing unpublished grades are not automatically released.
- Multiple assessments remain supported. The selector shows existing assessments plus the next unused control slot, within school limits. Previous scores remain intact.

## Attendance (supersedes the previous staff read-only workflow)
- Kiosk requires student ID/QR and PIN. Haiti local time determines the operation: 00:00 through 07:45:59 present; 07:46 through 08:00:59 late; 08:01 through 12:59:59 blocked; 13:00 through 23:59:59 checkout.
- Morning repeat scans never check out. Afternoon checkout requires a prior check-in. Repeated checkout does not create another event.
- School administrators, directors, secretaries and surveillants can mark today's attendance for an active current enrollment. Each change records a STAFF event with the actual account ID, name and role. Kiosk events identify the student and KIOS source. Historical events cannot be edited/deleted by API users; existing pre-migration attendance has no invented actor history.
- Attendance remains inaccessible through direct table writes or the old mutation RPCs. Only the new validated staff and student operations write records.

Validation: production build/typecheck; HTTP route checks; `supabase/assignment-attendance-verification.sql` rollback fixtures covering deadline/submission isolation, role attribution, audit immutability and schedule boundaries. `supabase/teacher-roles-verification.sql` retains family/student/role regression tests. No real school records used as fixtures.

## Publication review and student overview
- Publication filters: academic year, period, category, class, subject, teacher, publication status and student name/AtechOS ID. All means all matching rows. Confirmation publishes only the displayed draft IDs; invalid or foreign-school IDs abort the entire request.
- Administration sets teacher grade-entry deadlines per period and category, with optional exam start/end dates. Teachers cannot insert, edit, move or delete grades after the deadline; authorized administration can resolve exceptions. Historical grades remain publishable after their author's role changes.
- The student identity card keeps photo, name, class, academic year, AtechOS ID and QR visible; check-in/out use Haiti time. Year and period selectors filter published bulletins, attendance counts and announced exams. Missing attendance records are never counted as absences.
- Student photos use a validated student session and a short-lived signed link for that student's own storage path. No service key is sent to Vercel or the browser. Students without a photo see initials.
- Install the publication_review_student_profile migration and deploy student-photo-link with its custom student-session authentication before releasing the portal.
- Verification: production build; 31 HTTP checks; 6 attachment and 6 photo authorization checks; publication-profile, teacher-role/family and homework/attendance rollback fixtures. Real grades are not published by deployment.

## Shared school report cards
- Students, linked parents and authorized administration use the same server-calculated report. Columns distinguish subject, period and Note / 10 from the general average. The printable carnet includes school/student identity, class/year, exam dates, subject points, totals, status and class position.
- Active subjects assigned to the class are required. Missing grades or an unpublished assessment make the report incomplete; no general average/status of passing is invented. Published assessment detail remains available. Inactive subjects do not count.
- Subject earned/possible points sum the existing teacher-entered score/max_score, multiplied by assessment_weight / 100 (default 100). General average = total earned / total possible * 10. Multiple assessments and their existing weights remain intact.
- Report status: below 6 non-admitted; 6 to below 9 admitted; 9+ excellent; 3 or below calls for a parent meeting and director review of departure risk. This is a report alert: no message is sent and no student is removed automatically. Existing year-progression decisions remain director-reviewed and outside this change.
- Rank is computed on the server within the same class and period, using unrounded averages; ties share a competition rank. No classmates' marks or identities are returned. Rank remains pending until the class reports are complete.
- Parent report selectors filter academic year/period and the selected child's recorded attendance graph. Departed students retain old-year access under the existing cutoff. Real school grades are not changed or published by this migration.
- Tests: report-cards-verification.sql rollback fixtures cover weighted points, boundaries, missing/draft/inactive subjects, multiple assessments, tied rank, school/family isolation, exam dates and attendance scope. tests/report-card.mjs checks the printable view and key states.
