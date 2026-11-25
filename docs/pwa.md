# PWA implementation and rollout

## Repository audit

The site is a React 19 single-page application built by Vite with npm. The GitHub Actions workflow publishes the `dist` artifact to GitHub Pages under `/ppl-quiz/`. The app uses in-page navigation, with login and password recovery returning to the root. The app had per-document caches and localStorage queues for completed quizzes and review marks. Quiz drafts, progress snapshots and question figures had no general offline support.

The nine public JSON banks and the question figure map are static imports. Vite emits the question bank with the application entry and available figures as hashed PNGs. The build generates a versioned resource manifest inside the worker. The bundle serves as the versioned public question store. Private data lives in IndexedDB. Download preparation checks the shell, figures and browser database access. PDF assets remain on the existing Notes download path.

The progress migration already supplies an authenticated `save_completed_quiz` RPC with a stable UUID, transactional inserts, duplicate-attempt constraints, exact retry comparison, per-session serialization and owner-based RLS. The review-mark table already has its account/question primary key and RLS. The AI Tutor edge function already owns authorization, explanation generation and follow-up limits. This change uses those contracts. No Supabase migration, function deployment, data backfill, or redirect change is required for an existing configured project.

## Changed areas

- `scripts/pwa-build.js`, `scripts/service-worker.js`, `vite.config.js`, `index.html` and `public/` generate and serve the app identity, icons, shell and figure downloads under the existing base.
- `src/offlineStore.js`, `src/useQuizDraft.js`, `src/main.jsx`, `src/QuestionFigure.jsx` and `src/progress.js` provide transactional local drafts, pinned questions and figures, stable completion payloads and preserved grading.
- `src/useCloudProgress.js`, `src/offlineProgress.js` and `src/useReviewMarks.js` migrate legacy queues, retain retryable operations, and reconcile confirmed and locally saved data. Web Locks serialize sync across tabs where available. The existing RPC protects completion idempotency independently of browser locking.
- `src/AuthGate.jsx`, `src/AiTutor.jsx`, `src/OfflineSettings.jsx` and `src/style.css` add local account continuity, account-scoped cached explanations, connectivity status, install controls and update handling. Existing Supabase session storage and server-side AI limits remain in use.
- Tests use `fake-indexeddb` as a development dependency. The app adds no runtime dependency.

## Local and release verification

Run `npm ci`, `npm test`, and `npm run build` with the same public Supabase settings as the current site. Use `npm run preview` and open `http://localhost:4173/ppl-quiz/`. Service workers run on HTTPS and localhost, and are emitted only by the production build. The project has no lint or type-check script.

The desktop Chrome smoke test uses a local mock API and a disposable browser profile. Run from the repository root with Node.js 22 or newer.

```sh
VITE_SUPABASE_URL=http://127.0.0.1:4318 VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_mock npm run build
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=4319 --user-data-dir="$(mktemp -d)" --no-first-run about:blank
# In a second terminal
node scripts/pwa-smoke.mjs
```

The smoke test covers scoped startup, an interrupted figure download and retry, cold offline reload, quiz and figure restoration, saved AI, pending history, idempotent reconnect, update deferral, and figure removal. Build again with the intended Supabase configuration after the mock check.

Before approving rollout, test login and recovery, the optional installation prompt, both feedback modes, and a download with available figures. Test airplane mode from a cold launch in both Safari on iOS and Chrome on Android, using a browser tab and an installed app. Check both contexts against the same account after reconnecting. Use a separate browser profile or disposable Supabase project for test records.

After an approved deployment, verify the existing HTTPS entry URL and `/ppl-quiz/sw.js` and `/ppl-quiz/manifest.webmanifest`. Check JavaScript and manifest MIME types, response headers, and the worker scope in browser developer tools. Check an update with a quiz open and a pending result. The worker checks asset URLs against its generated manifest, and navigation falls back to the static app shell only on the app root and its explicit index URL. Auth redirects keep their original URL parameters. The worker does not cache Supabase responses. The client registers with `updateViaCache: 'none'`.

## Updates and rollback

When a prepared installation receives an update, the new worker stages the shell and figures before it takes control. The page stays on the current release until the user reloads. It reuses unchanged cached figures and leaves the prior worker active if staging fails. The update prompt defers reload while a quiz is open or a quiz write is in flight. Other open tabs can continue using the cached hashed assets for their version. Older figure caches also support unfinished drafts that reference earlier figures. Explicit figure removal clears those caches. Old shell caches are retained conservatively, so asset storage can grow across releases.

Use a previous PWA-compatible release or rebuild a corrective release that retains the same IndexedDB database name, stores and completion sync adapter. Publish its matching shell and worker together at the same URL. For a rollback to code predating this feature, keep the offline storage and sync adapter in the rollback build so queued results can still be sent. Verify pending results survive the rollback in a second test browser profile. Clearing site data would delete pending changes. The server schema remains compatible with both versions.
