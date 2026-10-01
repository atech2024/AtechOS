# Free migration checks

The GitHub Actions workflow runs an isolated Supabase stack on a hosted runner. It copies only the two pending migrations under review into a temporary test project, applies them over a synthetic schema baseline, and runs `verification.sql` inside a transaction that rolls back.

This checks the relocation RPCs, linked-parent notice scope, pickup closure/audit, table grants, and kiosk ID response against the schema those migrations need. It does not clone production data or replay the full AtechOS migration history. The repository's current migration history starts from a pre-existing schema, so a complete clean replay needs a separately prepared full schema baseline.

No Supabase project ref, access token, database password, `supabase link`, or remote push is used. On GitHub's standard hosted runners this does not create a hosted Supabase branch or incur Supabase branch compute charges.
