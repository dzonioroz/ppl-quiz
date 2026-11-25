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

The existing `/ppl-quiz/` Vite base and static Pages workflow are retained. Under repository **Settings → Secrets and variables → Actions → Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The workflow injects them during the build and runs tests first. Select GitHub Actions as the Pages source. A rebuild is required after changing variables. No custom backend is needed. A push to `main` triggers the existing Pages workflow. See the rollout and rollback notes before publishing. [PWA implementation and rollout](docs/pwa.md)

## Install and study offline

1. Open the usual website and sign in online. In **Settings**, choose **Download for offline use** and wait for **Offline Ready**.
2. To install, choose **Install app** in Settings when offered. On iPhone or iPad, open Safari’s Share menu and select **Add to Home Screen**. Open the installed app online and check Settings because the browser and installed app may have separate storage.
3. All nine subjects, available question figures, both feedback modes, learning mode and local grading work offline. Select a saved quiz under **Unfinished quizzes** to resume. **Pause quiz** keeps your answers. **Discard quiz** removes that unfinished session.
4. **My Progress** includes locally saved results. Reconnect with the same account to sync automatically, or choose **Sync now**. A service error leaves the result pending. Previously requested AI explanations can be read when you encounter the same question offline. New explanations and follow-ups require connectivity.
5. **Remove downloaded figures** frees the downloadable figure caches and resets Offline Ready. The small app shell and bundled question bank remain cached. Notes and PDFs have their own download controls. Downloads never create figures missing from the source material.

Browser storage can be evicted or cleared, including pending progress and cached explanations. The app requests persistent storage where supported. A previously signed-in account can study locally offline if its session expires. Uploads still require a current Supabase session belonging to that account. If logout requires a connection, reconnect to finish it. Signing out retains account-scoped drafts and pending changes for the same account. Browser storage is accessible to anyone with access to that browser profile.

If the download is interrupted, return to Settings and retry. If a quiz reports that another tab changed it, return to setup and reopen the newest saved version. When an update is offered, finish or pause the current quiz before reloading.

## Persistence and security

`AuthGate` replaces the old shared-password gate. Supabase restores browser sessions. `useCloudProgress` merges an IndexedDB history snapshot with locally completed results. It syncs at startup, sign-in, token refresh, reconnect, foreground, after local completion, and on manual request. Transient upload errors retry with backoff while the app is open.

A completed quiz receives one stable client UUID. `save_completed_quiz` is SECURITY INVOKER, derives ownership from `auth.uid()` and rejects payloads queued for another account even if a token changes mid-request, validates timestamps, subjects, mode, totals, scores and attempt shapes, and inserts the session and all attempts atomically. Concurrent retries serialize by session ID; identical retries return the existing ID, and changed payloads are rejected. `saved_payload` retains the canonical retry payload in addition to normalized attempts. Clients cannot update/delete history. RLS protects every table; the composite session/owner foreign key prevents attaching attempts to another account. Profile creation is the only narrowly scoped SECURITY DEFINER function, with an empty search path and no client execution grant.

The SQL supports JSON numeric indexes and index arrays; the current banks all use single-answer indexes. Stored indexes refer to the original JSON answers, never shuffled positions. Question identity is `(subject_id, question_id)`. Session subject `all` supports the existing mixed-subject quizzes; subject quiz counts include mixed sessions containing that subject. `Communication` retains the repository's display name and `communication` file identifier.

Quiz drafts, queued completions, cached history, review marks and cached explanations are keyed by authenticated UUID in IndexedDB. Drafts preserve question text, shuffled choices, grading keys and figure references. A draft revision detects conflicting edits to the same quiz across tabs. Independently started quizzes use separate IDs. Finishing saves the quiz and queues its full RPC payload in one transaction. Existing account-scoped localStorage queues are imported when available. Legacy `ppl-history` and `ppl-quizzes` from the shared-password era remain untouched because they have no identifiable owner.

Review mark edits use the existing account/question upsert. For edits to the same mark on separate devices, the last accepted server write wins. A same-device edit that occurs during an upload stays queued until it is acknowledged. Quiz completions are append-only and deduplicated by session UUID.

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

## Interactive AI Tutor

After submitting an answer, use **Explain with AI** for a cached PPL explanation and
up to two contextual follow-ups per question encounter. With end-of-quiz feedback,
the tutor appears in answer review. Existing quiz scoring and progress saving continue
independently of AI availability.

The backend uses the existing Supabase Auth/Postgres project and the `ai-tutor` Edge
Function; only that function calls OpenAI. Apply the additive tutor migration and set
server-only secrets before enabling it in production. See [AI Tutor setup, security,
testing, exact deployment commands and implementation report](docs/ai-tutor.md).
After correcting question JSON, run `npm run ai:bank` and deploy the updated Edge
Function alongside the frontend; tests/build check that its bank is current.

## Notes library

The **Notes** navigation entry contains aircraft documents, readable normal and
emergency checklists, LYNS/LYZR charts, and a Lesson Notes empty state. PDFs use a
lazy-loaded viewer and a best-effort device cache. See [Notes library details,
source editions, privacy boundaries, and content updates](docs/notes.md).

### Question navigation and review marks

Submitted answers are locked within the active quiz. Use Previous / Next or expand
Questions to jump to a number; drafts and answer order are preserved. All questions
must be submitted before results can be saved. Leaving or reloading an unfinished
quiz still discards its answers.

Use **Mark for review** during a quiz or in its results, then choose **Practice
marked questions** to create a new quiz from those questions. Marks stay in place
until explicitly removed, regardless of answer correctness. Subject and count
filters apply as usual. Marked practice currently appears as Regular in quiz history.

Apply `supabase/migrations/202611060001_review_marks.sql` before deploying this
version. It adds account-isolated review marks without changing existing results.
Marks sync across devices on sign-in or **Refresh / retry sync**. Offline mark and
unmark changes are stored per account in the browser and retried on reconnect;
sync failures remain visible with a retry action.
