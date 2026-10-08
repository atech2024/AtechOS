# Deployment and verification notes

## Current rollout status (2026-10-03)

On Supabase project `twmnhbthtiorjippixwz`, all ten migrations pending after the earlier Preview checks, from `20261002151506_enforce_enabled_school_section_for_classes.sql` through `20261003162629_confirm_official_exam_dates.sql`, were applied in order. The postflight migration list includes all ten. Read-only checks also confirmed the single-current-year index, the published-only student report call, and the RLS/policy boundary for confirmed official exam dates. See [BUILD-ROADMAP.md](docs/BUILD-ROADMAP.md) for the exact migration list and checks.

PR #60 was still a draft at this checkpoint. Its isolated Supabase SQL workflow and Vercel Preview succeeded for commit `9686802`, but an authenticated role-by-role UI check and Vercel Production commit/environment verification are still outstanding. Applied database migrations alone do not prove that the frontend has been released or that the end-to-end flows work in production. The older dated findings and actions below describe their original review points; verify current Vercel environment variables without exposing their values before deploying.

## Findings (2026-09-22 UTC)

Reviewed main commit 991d3bf and seven preceding commits. The public /signup and /login pages on both atech-os-4mbo.vercel.app and atech-os-kog7.vercel.app returned their actual forms, not the homepage. /signin returned 404 on both. GitHub's commit status records the latest 4mbo deployment as cancelled and kog7 as successful. Numerous Vercel projects are linked to this repository. The connected Vercel tool returned no projects, so current environment settings and build logs could not be verified.

Supabase project twmnhbthtiorjippixwz is ACTIVE_HEALTHY. create_school_onboarding exists with the seven parameters used by the form, checks auth.uid(), and prevents existing school members from creating another school. get_my_school_id scopes its lookup to auth.uid(). All 21 public tables have RLS enabled. This does not prove every policy and RPC is secure: the security advisor reports 27 authenticated SECURITY DEFINER entry points needing individual review. No production database data or schema was changed.

## Changes

- /signin redirects to /login.
- Signup confirmation uses /auth/callback to exchange a PKCE code for a cookie session, then continues through onboarding. Missing/invalid codes show a recoverable error page; arbitrary next URLs are not accepted.
- Dashboard and onboarding server layouts verify the user and school membership. All nested dashboard pages are covered. Middleware redirects unauthenticated requests and fails closed when configuration is missing.
- Existing members skip onboarding; users without a school are sent to setup from the dashboard.
- Auth/setup forms handle thrown errors and always clear their loading state.
- Homepage CSS now defines its navigation/cards/footer and uses modules-grid rather than overriding every Tailwind grid.
- Restored working ESLint configuration and build-time linting; fixed four existing lint errors. Remaining hook/image warnings are not suppressed.
- Added a dependency lockfile, pinned Supabase packages, and production HTTP smoke tests.

## Vercel actions

1. Merge the fix PR, then deploy that commit in the intended existing Vercel project. Do not create another duplicate project. Verify the deployed commit SHA in Vercel.
2. Set NEXT_PUBLIC_SUPABASE_URL to https://twmnhbthtiorjippixwz.supabase.co and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to this project's publishable key for Production and any Preview environment used for testing. Never use a service-role or secret key in NEXT_PUBLIC variables.
3. Build command: npm run build; framework: Next.js; root: repository root. Rebuild after changing public variables, since they are embedded at build time.
4. For automatic school-calendar and exam-reference discovery, verify `SUPABASE_SERVICE_ROLE_KEY` (server-only; never prefix it with `NEXT_PUBLIC_`) and a random `CRON_SECRET` of at least 32 characters in Production Environment Variables, then redeploy if either variable changed. Vercel calls `/api/cron/official-calendar-sources` daily at 11:15 UTC. The checker reads MENFP/Government pages and HaitiLibre education archive copies, stores document links with a school-calendar or exam-reference label, and never creates closures, exam periods, or class exam appointments automatically. Staff must verify every document and manually enter/approve dates. Automatic discovery requires both the variables and source-registry migrations; the live cron run has not been verified here. Vercel Cron runs against production deployments and does not retry failed runs.

## Supabase actions

In Authentication > URL Configuration, set Site URL to the chosen production origin. Add its exact /auth/callback URL to Redirect URLs; add the exact preview callback URL when testing previews. For example, if retaining 4mbo, use https://atech-os-4mbo.vercel.app/auth/callback.

Use the standard confirmation email link {{ .ConfirmationURL }} for this PKCE callback flow. Open confirmation in the same browser that performed signup so its verifier cookie is available. Do not point confirmation directly at /onboarding. Previously issued links should not be used to validate the new flow.

After deployment, perform a new signup with a mailbox you control, confirm email, create a school, sign out/sign in, and verify a school member lands on dashboard while a new account lands on onboarding. Also verify a second school cannot read the first school's data. These real-account and email-delivery checks have NOT been completed by the automated smoke suite.

## Repeatable checks

Use Node 22 or 24, then run npm ci, npm run build, npm test, and npm run typecheck. npm test starts the production server and verifies public forms, alias redirects, protected paths without configuration, and invalid confirmation handling. It does not simulate a real Supabase login or email delivery.

References:
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
# Student access and school workflows — September 23, 2026

The student-access migration adds private hashed device sessions, one-use activation codes, optional hashed PINs, teacher requests, student departure records, and director-reviewed class progression. Existing student IDs and historical enrollments are preserved.

- School administration opens a student profile and issues an activation code. Give it privately to that student. It expires in 2 days and is consumed once. Reissuing it resets the PIN and all device sessions.
- Students use `/student/login` with AtechOS ID, full name, and either the activation code or their PIN. PINs have 6–12 digits. Five failed attempts lock that student login for 15 minutes. Browser sessions expire in 14 days; without a PIN, another device or a later login requires another school activation code.
- AtechOS ID and name are public identifiers on the badge; they are deliberately insufficient to authenticate. Student session cookies are HttpOnly, Secure in production, SameSite=Lax and restricted to `/student`.
- Family bulletins and parent activity use explicitly linked children even when a parent is also a teacher. Only published grades are returned. A departure preserves historical published bulletins through the chosen final academic year; it blocks new enrollment and current assignments.
- Teachers may request access from `/onboarding` using the school code shown in Teacher requests. Only the school's administrator/director may approve. Existing invitation links remain supported. Subject/class assignment is still a separate administration action.
- Create the next academic year, activate its classes, then open Academic progression. A suggestion requires at least one published grade for every active subject and applicable period; `controls_per_period` is the teacher-entry maximum, not a completion minimum. The average uses published points. Missing subject/period grades or multiple matching destination classes require manual review. The preview is read-only: class changes occur only after an administrator/director explicitly confirms the decisions, and the confirmed batch is applied atomically.
- Badges include the AtechOS ID and a QR encoding exactly that identifier. Open `/kiosk` on the shared device. Students scan/type their ID and enter their private 6–12 digit PIN; the server selects their single active class in the current academic year. No staff login or class selector is needed. Five wrong PIN attempts lock access for 15 minutes; immediate repeated scans are ignored for 60 seconds. The PIN is cleared after every attempt and the result disappears after 10 seconds. No student portal session is created on the kiosk. Physical camera scanning still needs a device test.
- School staff have read-only attendance access. Direct table writes and all four legacy attendance RPCs are revoked. `student_kiosk_scan` is the only public attendance write path; it checks the private PIN, active student status and current enrollment. Students without a PIN need a school-issued private activation/reset code and must choose a PIN during activation at `/student/login`. Never print the PIN on the badge or share it with staff. A public kiosk verifies credentials, not physical location.
- Run `supabase/kiosk-pin-verification.sql` and `supabase/teacher-roles-verification.sql` after the kiosk migration. They use rollback fixtures, including PIN lockout, check-in/out, duplicate scans, departed students, missing current classes, staff read-only access, and disabled legacy APIs.
- English, French and Haitian Creole translations are wired to the saved language selector for principal navigation, labels and the new workflows. School-entered names/content are kept as entered; some legacy explanatory text remains in its original language.

Deploy the `student-assignment-link` Edge Function from `supabase/functions/student-assignment-link/index.ts`. Its platform JWT check is disabled intentionally: the handler validates the custom student session before authorizing an assignment and signing its stored attachment path for 60 seconds. It uses Supabase's built-in server environment keys; no service key is added to Vercel or browser code.

Verification: `npm run build`, `npm test`, `node tests/student-edge.mjs`, and `supabase/access-verification.sql`. The SQL suite creates isolated fixtures and rolls them back; it checks family isolation, NISU privacy, teacher request review, student activation/PIN/session expiry, kiosk duplicates, promotion completeness/atomicity, and archive cutoffs. Never use real student records as fixtures.

Supabase advisor notices for SECURITY DEFINER APIs are expected and must be reviewed against each function's explicit authorization. The two private credential/session tables intentionally have no API policies or direct grants. Leaked-password protection for ordinary Supabase email accounts remains disabled; see https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. Resend email delivery still requires a verified sender; private invitation links remain available without one.
