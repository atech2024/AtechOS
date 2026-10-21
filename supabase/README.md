# School-platform upgrade

The four migrations in `migrations/` were applied to the linked Supabase project on 2026-09-22. The source SQL files remain beside this document as readable references.

The live order was foundations, RPC repairs, secure workflows, then the student-RPC RLS correction. The pre-change catalog is in `audit/schema-before.json`. Existing school, user, student and badge identifiers were preserved.

The migration version numbers match the versions recorded by Supabase. The isolated authorization test in `verification.sql` passed after application and rolls back its fixtures.

## Invitation delivery

The current implementation creates a private link for manual sharing. It does not contact an email provider and must never display “email sent.” The token is stored only as a digest in the database; the plaintext link is displayed once when created. Links expire after seven days, replacement links cancel matching pending invitations, and acceptance requires a confirmed matching email address.

This is independent of Supabase account-confirmation email delivery. A manually shared invitation does not bypass email verification. Production signup and confirmation must be tested with a real receiving mailbox before release; custom SMTP is not configured yet.

No service-role key is required by the invitation application code. Database RPCs validate the current authenticated user and membership. New school staff must choose their own passwords through Supabase Auth.

## Release gates still pending

- A real mailbox test for invitation/account confirmation delivery.
- Completion of the curriculum and full three-language user-interface work.
- Deployed-route verification after the application changes are merged and deployed.

Do not interpret a successful Next.js build or unauthenticated route test as verification of these database workflows.

