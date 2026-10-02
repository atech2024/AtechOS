# Deployment and verification notes

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

## Historical initial deployment checklist (2026-09-22)

1. Merge the fix PR, then deploy that commit in the intended existing Vercel project. Do not create another duplicate project. Verify the deployed commit SHA in Vercel.
2. Set NEXT_PUBLIC_SUPABASE_URL to https://twmnhbthtiorjippixwz.supabase.co and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to this project's publishable key for Production and any Preview environment used for testing. Never use a service-role or secret key in NEXT_PUBLIC variables.
3. Build command: npm run build; framework: Next.js; root: repository root. Rebuild after changing public variables, since they are embedded at build time.
4. For automatic school-calendar and exam-reference discovery, add `SUPABASE_SERVICE_ROLE_KEY` (server-only; never prefix it with `NEXT_PUBLIC_`) and a random `CRON_SECRET` of at least 32 characters to Production Environment Variables, then redeploy. Vercel calls `/api/cron/official-calendar-sources` daily at 11:15 UTC. The checker reads MENFP/Government pages and HaitiLibre education archive copies, stores document links, and extracts candidate exam-period and official-exam dates when it can read source text. Candidates are unverified proposals only: no closure, grading period, or class exam is created or published automatically. Staff must verify the linked source and enter/approve dates in the appropriate calendar workflow. Until the variables and source-registry migrations are installed, automatic discovery remains inactive. Vercel Cron runs against production deployments and does not retry failed runs.

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
- Create the next academic year, activate its classes, then open Academic progression. Suggestions require the configured number of published controls for each assigned subject and applicable period. Missing grades or multiple matching destination classes require manual review. No class changes occur until an administrator/director confirms. The full confirmed list is applied atomically.
- Physical student badges print front and back at portrait CR80 dimensions (53.98 × 85.60 mm), with the student's photo, name, class, AtechOS ID, school identity, and a private revocable badge QR. The back includes bilingual usage guidance and QR links to the student and parent portals. The private badge QR is not the public AtechOS ID.
- At `/kiosk`, scanning the private badge QR does not require a PIN. Typing the public AtechOS ID as a fallback requires the student's private 6–12 digit PIN. The server selects the student's single active class in the current academic year; kiosk use creates no student portal session. Five failed typed-ID/PIN attempts lock that credential for 15 minutes. Repeated morning scans never check the student out; an afternoon checkout requires a prior check-in. Test physical camera behavior on the actual kiosk device before relying on it at the school.
- Attendance times use Haiti time: 00:00–07:45 check-in, 07:46–08:00 late, 08:01–12:59 blocked, and 13:00–23:59 checkout. Authorized school administrators, directors, secretaries, and attendance supervisors may record an attributed staff exception; teachers do not receive this permission. Direct attendance table writes and legacy mutation RPCs are revoked. Kiosk events are labeled KIOS; staff events preserve the actor account and role.
- Automatic absence is processed at 09:00 Haiti time on an open school day inside the current academic year. GUARD reason and meeting deadlines count open school days only; closures approved by school staff are excluded. Holiday and online MENFP dates remain suggestions until staff confirm them. GUARD may suspend student login and kiosk use after an overdue family-meeting deadline; linked parents keep their historical published-bulletin access.
- Teachers cannot read AtechOS IDs or NISU values through student-record, class roster, assignment roster, kiosk, or staff scan responses. Existing student AtechOS IDs are stable; editing an existing student does not expose class selection. Authorized class changes use the director-reviewed Academic progression workflow.
- Censeur (Sansè) is an inviteable school role with academic-review permissions; it does not grant school-administrator membership. Teachers see only their assigned subjects and their own assignments. Student and parent portals show only the student's or linked children's published bulletins; historical published bulletins remain available after departure under the existing year cutoff.
- Current verification includes `npm test`, `npm run typecheck`, `npm run build`, plus rollback-only database fixtures such as `supabase/assignment-attendance-verification.sql`, `supabase/teacher-roles-verification.sql`, and `supabase/guard-foundations-verification.sql`. The fixtures cover QR/PIN kiosk paths, attendance attribution, GUARD deadlines, role privacy, and disabled legacy APIs. They do not use real school records.
- English, French and Haitian Creole translations are wired to the saved language selector for principal navigation, labels and the new workflows. School-entered names/content are kept as entered; some legacy explanatory text remains in its original language.

Deploy the `student-assignment-link` Edge Function from `supabase/functions/student-assignment-link/index.ts`. Its platform JWT check is disabled intentionally: the handler validates the custom student session before authorizing an assignment and signing its stored attachment path for 60 seconds. It uses Supabase's built-in server environment keys; no service key is added to Vercel or browser code.

Verification: `npm run build`, `npm test`, `npm run typecheck`, `node tests/student-edge.mjs`, and the rollback-only Supabase SQL fixtures documented above. Current regression checks cover family isolation, NISU privacy, teacher request review, student activation/PIN/session expiry, private badge QR scans, promotion completeness/atomicity, and archive cutoffs. Never use real student records as fixtures.

Supabase advisor notices for SECURITY DEFINER APIs are expected and must be reviewed against each function's explicit authorization. The two private credential/session tables intentionally have no API policies or direct grants. Leaked-password protection for ordinary Supabase email accounts remains disabled; see https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. Resend email delivery still requires a verified sender; private invitation links remain available without one.
