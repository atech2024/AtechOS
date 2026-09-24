# Homework and attendance workflows

## Student work
- Assignments show subject and the name of the account that published them.
- In Assignments, open **Suivre les remises** to mark physical work received. Server time records receipt; unreceived work becomes missing after the deadline. Work marked received after the deadline is late.
- Enable **Autoriser la remise en ligne** per assignment after setting its deadline. Students can submit text or a link to their work, only for their own current class before the deadline. This does not upload student files; teacher attachments remain supported separately.
- Student bulletins show only published grades. Administrators/directors publish a class and period from Grades. Saving grades alone does not publish a bulletin. Existing unpublished grades are not automatically released.
- Multiple assessments remain supported. The selector shows existing assessments plus the next unused control slot, within school limits. Previous scores remain intact.

## Attendance (supersedes the previous staff read-only workflow)
- Kiosk requires student ID/QR and PIN. Haiti local time determines the operation: 00:00 through 07:45:59 present; 07:46 through 08:00:59 late; 08:01 through 12:59:59 blocked; 13:00 through 23:59:59 checkout.
- Morning repeat scans never check out. Afternoon checkout requires a prior check-in. Repeated checkout does not create another event.
- School administrators, directors, secretaries and surveillants can mark today's attendance for an active current enrollment. Each change records a STAFF event with the actual account ID, name and role. Kiosk events identify the student and KIOS source. Historical events cannot be edited/deleted by API users; existing pre-migration attendance has no invented actor history.
- Attendance remains inaccessible through direct table writes or the old mutation RPCs. Only the new validated staff and student operations write records.

Validation: production build/typecheck; HTTP route checks; `supabase/assignment-attendance-verification.sql` rollback fixtures covering deadline/submission isolation, role attribution, audit immutability and schedule boundaries. `supabase/teacher-roles-verification.sql` retains family/student/role regression tests. No real school records used as fixtures.
