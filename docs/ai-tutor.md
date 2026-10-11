# AI Tutor: operation and deployment

The frontend stays on GitHub Pages. The existing Supabase project provides Auth,
Postgres and the `ai-tutor` Edge Function. No additional backend host is needed.
Implementation is local; no remote migration, secret or deployment has been performed.

## Behavior

“Explain with AI” appears after submission in immediate-feedback mode and in the
results review for delayed feedback. It never prevents Next, completion or progress
saving. Explanations are generated on demand and shared across authenticated users.
Two accepted contextual follow-ups are allowed for each
`(authenticated user, existing quiz UUID, subject ID, question ID)`.
Reviewing the same encounter retains its allowance and conversation. A new quiz
UUID gets a fresh allowance. Suggested prompts use the same follow-up action.

The quiz already assigns a UUID at start but saves `quiz_sessions` and
`question_attempts` only at completion. Tutor encounters reuse that UUID without
inserting incomplete sessions into progress or changing the completed-quiz RPC.
There is intentionally no foreign key to a not-yet-persisted completed session.
Like the existing quiz, this is a study tool: clients can start new quizzes, not a
server-verified examination. Per-user rate limits also apply across new quiz UUIDs.

The server reads its bundled, generated question bank, never client-supplied answers.
The bank hash includes question, original answer options, current answer index,
subject, missing-figure flag and prompt version. Corrections require regenerating
and deploying the server bundle as well as the frontend. Existing JSON corrections
are preserved; AI never modifies bank data or scoring.

Missing-figure questions conservatively return `missing_figure` without an OpenAI
request. Other warnings (`ambiguous`, `possible_question_bank_error`) are validated,
cached and displayed as verification warnings. This implementation supplies no figure
images and performs no live regulatory research. Training materials remain necessary
for verification. Scope enforcement is model-based; it is not a perfect adversarial
classifier. Out-of-scope responses use a fixed refusal and do not consume a follow-up,
but their requests still count toward the hourly rate limit.

## Database and security

Apply `supabase/migrations/202610110001_ai_tutor.sql` after the existing progress
migration. This is additive and does not alter existing progress tables or policies.

| New resource | Purpose and access |
| --- | --- |
| `ai_explanations` | Shared cache keyed by subject, question and content/version hash. No browser grants or client RLS policies. |
| `ai_tutor_encounters` | Explanation snapshot, up to two question/answer pairs, server counter and request lease. Authenticated SELECT uses `auth.uid() = user_id`; clients cannot insert/update/delete. |
| `ai_tutor_requests` | Per-user request IDs, request fingerprints, replay results and hourly rate accounting. No browser grants. |
| `begin_ai_tutor` | Service-role-only RPC: atomic admission, rate limit, idempotency, cache lookup, encounter/counter checks and lease reservation. |
| `finish_ai_tutor` | Service-role-only RPC: validates lease ownership/expiry and atomically commits cache or accepted follow-up and result. |

All new tables have RLS. The Edge Function verifies each Bearer token using Supabase
Auth `getUser(token)` and derives the user UUID from that result. Its service-role
client is used only server-side for the protected cache/state RPCs. It does not expose
a generic database or AI proxy. Unrecognized request fields (including a forged user
ID or counter) are rejected. Direct authenticated execution of either RPC is denied.

`verify_jwt = false` in the function configuration deliberately disables the gateway's
legacy JWT check to support existing publishable-key projects. Authentication is
mandatory in the handler itself, before any database or OpenAI work. Do not remove it.
The CORS origin allowlist is additional browser protection, not authentication.

Database row/advisory locks protect initial admission. A 120-second lease prevents
cross-instance duplicate generation and simultaneous follow-ups; the OpenAI request
has a 45-second timeout. Crashed requests can be retried with a new request UUID once
the lease expires. Completed request UUIDs replay their saved result; reusing one with
a different payload is rejected. Failure responses are also saved, so an explicit UI
retry uses a new UUID. Rare failures after an upstream response but before its database
commit can cause another paid call; exactly-once execution across an external API and
Postgres is not guaranteed.

Limits: 30 admitted requests per authenticated user per rolling hour (including cache
hits, failed generations and unrelated follow-ups), two accepted follow-ups per
encounter, 500 characters per follow-up, 4 KiB per request and 1,200 output tokens per
OpenAI request. No user/question text or provider secrets are logged by the handler.
Responses use `Cache-Control: no-store`; React renders model output as text.

Request/cache/encounter history currently has no automated retention policy. Consider
scheduled deletion of old request records and obsolete cache versions as usage grows;
retain request records for at least the rate-limit/retry window. Account deletion
cascades user-specific tutor data; the shared question cache contains no user messages.

## Configuration

Server-only secrets/settings, set through Supabase Edge Function Secrets:

| Name | Value |
| --- | --- |
| `OPENAI_API_KEY` | Required for non-figure explanations and live follow-ups. Never use a `VITE_` variable. |
| `OPENAI_EXPLANATION_MODEL` | Optional; defaults to `gpt-4o-mini`. Select a model supporting Responses API strict JSON Schema outputs. |
| `PPL_EXPLANATION_PROMPT_VERSION` | Optional; defaults to `1`. Increment when changing explanation strategy or when a model change should invalidate cached explanations. |
| `AI_ALLOWED_ORIGINS` | Comma-separated origins, e.g. `http://localhost:5173,https://dzonioroz.github.io`. Origins contain no path or trailing slash. |

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted/local Edge
Functions. Never copy the service-role key to frontend configuration. The frontend
continues to use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

The function uses Deno's native fetch with the OpenAI Responses API, strict structured
`text.format`, `store: false`, validation and bounded output. No OpenAI SDK or frontend
runtime dependency is added. See the [official OpenAI structured output documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## Local development

Install the Supabase CLI and Docker using your normal tooling. From the repo root:

```sh
npm ci
npm run ai:bank
supabase start
supabase migration up --local
cp supabase/functions/.env.example supabase/functions/.env.local
```

Edit the ignored `supabase/functions/.env.local` with a development OpenAI key and
local allowed origin. In another terminal:

```sh
supabase functions serve ai-tutor --env-file supabase/functions/.env.local
```

Use `supabase status` to obtain the local URL and public/anon key and put only those
public values in frontend `.env.local`. Start the frontend:

```sh
npm run dev
```

Register/sign into a local Supabase user, submit an answer and request an explanation.
Supabase Auth and the function must use the same local project. Local Auth testing
redirects can be configured in `supabase/config.toml` if testing email recovery flows.
No production secrets belong in either frontend env files or GitHub Pages settings.

## Production deployment to the existing Supabase project

1. In the existing project's SQL editor run **only** the new migration
   `supabase/migrations/202610110001_ai_tutor.sql` once. The existing progress migration
   must already be applied. The new migration creates its tables, indexes, RLS policy
   and RPC grants in one transaction. Review it before execution.
2. Alternatively, if this project's migrations are already tracked by Supabase CLI:

   ```sh
   supabase login
   supabase link --project-ref YOUR_EXISTING_PROJECT_REF
   supabase migration list
   supabase db push --dry-run
   supabase db push
   ```

   Ensure the dry run lists only expected pending migrations. If the original progress
   migration was applied in SQL Editor and is not tracked, use step 1; do not replay
   it or reset the production database. Avoid mixing manual and CLI migration history
   without reconciling it first.
3. Copy the server example to the ignored `.env.local` path, edit it with the production
   key, model, prompt version and Pages origin, then set the hosted function secrets:

   ```sh
   cp supabase/functions/.env.example supabase/functions/.env.local
   # Edit this file before continuing; never commit it.
   supabase login
   supabase secrets set --project-ref YOUR_EXISTING_PROJECT_REF --env-file supabase/functions/.env.local
   npm run ai:bank
   npm run ai:bank:check
   supabase functions deploy ai-tutor --project-ref YOUR_EXISTING_PROJECT_REF
   ```

   `supabase/config.toml` supplies the function's gateway setting. Review the deployed
   function's configuration and verify an anonymous POST returns 401. See the
   [Supabase CLI reference](https://supabase.com/docs/reference/cli/introduction) and
   [function authentication documentation](https://supabase.com/docs/guides/functions/auth).
4. Verify locally before publishing the frontend:

   ```sh
   npm test
   npm run build
   ```

   Commit the reviewed implementation and generated bank, then push to `main` or run
   the existing **Deploy to GitHub Pages** workflow. That workflow runs tests and builds
   with the existing two public Supabase repository variables. No new GitHub secret is
   needed for AI; the OpenAI key stays in Supabase. No push/deployment was performed by
   this implementation.
5. In production, sign into two accounts and verify cache reuse, two accepted
   follow-ups, rejection of a third, reset in a new quiz, warnings and uninterrupted
   completion/synchronization while the function is unavailable. Check Supabase
   function logs and OpenAI usage for expected request volume.

Whenever question JSON changes, run `npm run ai:bank`, commit the generated bundle,
and deploy the Edge Function before publishing the matching frontend. Tests/build fail
if the server bundle differs from current source banks. Increment the prompt version
to force regeneration when changing instructions; changing the model alone intentionally
does not invalidate a valid explanation.

## Verification and changed files

`npm test` runs the actual progress and tutor SQL migrations in PGlite (embedded
PostgreSQL) with test Auth roles/users, exercises the handler against those RPCs, and
runs React UI/progress/auth regression tests. With Deno installed, run the Edge Function checks:

```sh
deno check --config supabase/functions/ai-tutor/deno.json supabase/functions/ai-tutor/index.ts
deno lint --config supabase/functions/ai-tutor/deno.json supabase/functions/ai-tutor
```

OpenAI output is mocked, so the suite
spends no API credit. It covers unauthenticated and tampered requests, unknown questions,
shared cache hits/misses, correction/version invalidation, follow-up context and limits,
new encounters, refusal accounting, warnings, provider/validation failure and retry,
overlapping requests, replay, RLS and RPC grants, rate limits, suggestions, and quiz
completion independent of AI. `@electric-sql/pglite` is the only added project dependency
and is development-only. Existing optional live Supabase security tests still require
configured disposable test accounts and otherwise skip. PGlite's single connection
exercises overlapping provider requests and database leases; deployed multi-instance
behavior and gateway/auth integration still require the production smoke checks above.

Local verification result: **51 tests passed**, with one optional live Supabase
security test skipped because its credentials were not configured. Production build,
Deno type check, Edge Function lint and `git diff --check` passed. Vite reports its
large-bundle advisory for the static quiz/question-bank bundle. Live Supabase/OpenAI
requests and remote deployments have not been performed.

Created files:

- `src/AiTutor.jsx`
- `scripts/sync-ai-bank.mjs`
- `supabase/config.toml`
- `supabase/functions/.env.example`
- `supabase/functions/_shared/question-bank.json` (generated)
- `supabase/functions/ai-tutor/core.js`
- `supabase/functions/ai-tutor/index.ts`
- `supabase/functions/ai-tutor/deno.json` and `deno.lock` (pinned Deno dependencies)
- `supabase/migrations/202610110001_ai_tutor.sql`
- `tests/ai-tutor.test.js`
- `tests/ai-tutor.ui.jsx`
- `docs/ai-tutor.md`

Modified files: `src/main.jsx`, `src/style.css`, `package.json`, `package-lock.json`,
`tests/quiz.ui.jsx`, and `README.md`. No source question JSON was modified.
