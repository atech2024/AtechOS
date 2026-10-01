# Free migration checks

The GitHub Actions workflow runs an isolated Supabase stack on a hosted runner. It copies selected attendance/GUARD and preschool relocation migrations under review into a temporary test project, applies them over a synthetic schema baseline, and runs rollback-only SQL fixtures.

`verification.sql` checks relocation RPCs, linked-parent notice scope, pickup closure/audit, table grants, and kiosk ID response. `guard-verification.sql` exercises open-school-day deadlines, 09:00 absences, parent reason scope, the weekly three-lateness threshold, meeting notifications, and student kiosk/portal suspension and restoration. Fixtures use synthetic IDs and roll back. The workflow does not clone production data or replay the full AtechOS migration history. The repository's current migration history starts from a pre-existing schema, so a complete clean replay needs a separately prepared full schema baseline.

No Supabase project ref, access token, database password, `supabase link`, or remote push is used. On GitHub's standard hosted runners this does not create a hosted Supabase branch or incur Supabase branch compute charges.
