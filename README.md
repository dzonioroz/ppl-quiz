# PPL Question Bank

React 19 / Vite static quiz app with Supabase email/password authentication and per-user cloud progress. The nine JSON banks remain local static assets. Existing feedback modes, shuffled questions and choices, figure notes, explanations and answer review are preserved.

## Local setup

1. Create a Supabase project yourself. This implementation does not create resources or deploy anything.
2. Apply `supabase/migrations/202610080001_progress.sql` using the Supabase SQL editor, or your established migration tooling. Run it once; it creates tables, policies and the save RPC in a transaction.
3. Enable Email authentication and choose your email confirmation policy. Configure SMTP for production email delivery. Registration with confirmation enabled tells users to check their email. A database trigger creates profiles even before email confirmation and backfills existing users.
4. In Authentication → URL Configuration, set the site URL to `https://dzonioroz.github.io/ppl-quiz/`. Allow **exact** redirects `http://localhost:5173/ppl-quiz/` and `https://dzonioroz.github.io/ppl-quiz/` (adapt the origin for your site). Reset and confirmation links return to the application root; no server-side routes are needed. The app handles Supabase's `PASSWORD_RECOVERY` event and prompts for a new password. See [Supabase password recovery documentation](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).
5. Copy `.env.example` to `.env.local`. Obtain the project URL and **publishable** key from the project Connect/API settings. A legacy anon key also works. Never use a secret or service-role key. These frontend values are public by design; RLS provides isolation.
6. Run `npm ci` and `npm run dev`, then open `http://localhost:5173/ppl-quiz/`. Missing configuration displays setup guidance.

Use Node.js 22.13+ (or a compatible supported version). `.env.local` and other local env files are ignored. Do not commit credentials.

## GitHub Pages

The existing `/ppl-quiz/` Vite base and static Pages workflow are retained. Under repository **Settings → Secrets and variables → Actions → Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The workflow injects them during the build and runs tests first. Select GitHub Actions as the Pages source. A rebuild is required after changing variables. No custom backend is needed. Publishing or pushing remains a separate manual action.

## Persistence and security

`AuthGate` replaces the old shared-password gate. Supabase restores browser sessions. `useCloudProgress` queries confirmed history on sign-in and opening setup/progress, with pagination, and synchronizes pending saves on sign-in, online events or manual retry. No polling is used.

A completed quiz receives one stable client UUID. `save_completed_quiz` is SECURITY INVOKER, derives ownership from `auth.uid()` and rejects payloads queued for another account even if a token changes mid-request, validates timestamps, subjects, mode, totals, scores and attempt shapes, and inserts the session and all attempts atomically. Concurrent retries serialize by session ID; identical retries return the existing ID, and changed payloads are rejected. `saved_payload` retains the canonical retry payload in addition to normalized attempts. Clients cannot update/delete history. RLS protects every table; the composite session/owner foreign key prevents attaching attempts to another account. Profile creation is the only narrowly scoped SECURITY DEFINER function, with an empty search path and no client execution grant.

The SQL supports JSON numeric indexes and index arrays; the current banks all use single-answer indexes. Stored indexes refer to the original JSON answers, never shuffled positions. Question identity is `(subject_id, question_id)`. Session subject `all` supports the existing mixed-subject quizzes; subject quiz counts include mixed sessions containing that subject. `Communication` retains the repository's display name and `communication` file identifier.

Pending results are stored separately for each authenticated UUID in localStorage. Confirmed cloud data remains authoritative. Failed saves stay queued; successful saves remove only the matching session. If storage is blocked/full, results remain in memory and the UI explicitly asks users to keep the page open. Clearing browser data can remove unsynchronized results. Unfinished quizzes are not synchronized. Old `ppl-history`/`ppl-quizzes` storage is left untouched but is not imported because the shared-password data has no identifiable owner.

Latest attempts determine incorrect practice, ordered by answer timestamp with session/attempt IDs as deterministic tie breakers. Correct practice removes a question; a later incorrect answer restores it. Removed/renamed question IDs are ignored for revision. Attempt-based accuracy counts every attempt, including removed questions. Client clock timestamps determine latest ordering; badly skewed device clocks can affect ordering. Scores are a study aid computed client-side, not an examination anti-cheat system.

## Verification

- `npm test`: authentication UI tests (mocked SDK) and unit/regression tests for aggregation, latest attempts, payloads, queue isolation/retries, bank structure and randomization. Integration tests skip without their env configuration.
- `npm run build`: static production build.
- `npm run test:security`: optional real Supabase integration tests. Use a **disposable** project with the migration applied and two existing, confirmed users. Set `TEST_SUPABASE_URL`, `TEST_SUPABASE_KEY` (publishable/anon), `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD` in your shell without committing them. Tests insert clearly identified history; authenticated users cannot delete it, so clean up the disposable test accounts/project administratively afterward. No administrative key is required by the test.

Manual browser checks after configuration:

1. Register A and B, confirm email if required, test invalid login, logout and refresh session restoration.
2. Request a reset email, open it on local and Pages URLs, and update the password. Test expired links show an error.
3. Complete regular quizzes in both feedback modes; verify answer review and score. Test quiz sizes larger than the bank and mixed subjects.
4. Disconnect networking, finish a quiz and verify pending status. Reload, reconnect, retry and verify one saved session with all attempts. Switch accounts and verify A's pending results are never uploaded under B.
5. Sign into A on another device and check history, nine subject statistics and incorrect practice. Answer a revision question correctly, then incorrectly later, and verify eligibility changes after confirmed synchronization.
6. Run the two-account security suite. Confirm anonymous reads, cross-user reads/writes and forged foreign keys fail.

Automated tests do not by themselves verify live email delivery, deployed redirects, browser flows or cross-device sync. Those require a configured project and manual/browser integration checks.

## Question data

`scripts/extract.py` reproduces banks from PDFs in `upload/`. Original response order supplies `correctAnswer`; explanations remain existing placeholders. The 61 figure questions retain their missing-figure notes. No answer content or answer keys are changed by the authentication feature.
