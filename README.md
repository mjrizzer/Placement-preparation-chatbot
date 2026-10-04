# AI Placement Prep

### Start the whole project

```sh
npm install
npm run local
```

This starts the local database when needed, applies migrations, and starts the website at **http://localhost:3000**. Keep that terminal open. Starting only the website while PostgreSQL is stopped causes login to fail. Existing accounts are preserved in `.local-db`.

Open **http://localhost:3000/demo** for a short presentation walkthrough with preset questions. It needs no login or paid API credentials. It explicitly labels sample answers and saves sample code without executing it. Signed-in interviews also work without a key using the offline bank described below. AI generation and sandbox execution require their configured services.

## Simple project version

The main interface now focuses on a small student project: a dashboard, short AI/HR interviews, aptitude, coding, DSA, and result history. Sessions default to five questions. Advanced tools are omitted from the main navigation.

- Switching browser tabs automatically submits the active answer or code. Blank answers receive zero. Failed network/provider requests show an error and retain the draft for retry.
- Coding questions disable the editor context menu, copy/cut/paste shortcuts, clipboard events, and drag-and-drop. These are browser-level practice rules, not tamper-proof proctoring.
- Local database setup is required. AI/sandbox configuration is optional for basic offline interviews.

The remaining documentation describes the underlying services retained from the original version.

A full-stack placement preparation application built with Next.js App Router, TypeScript, React, PostgreSQL, Prisma, OpenAI structured outputs/embeddings, and an isolated Judge0 code execution adapter.

**No API key is needed for basic interviews.** When `OPENAI_API_KEY` is empty, Technical, HR, DSA, Aptitude, Logical Reasoning and Verbal sessions use an original built-in beginner question bank. Questions already seen by a student are excluded; when the finite bank is exhausted, choose another mode. Feedback uses exact answers for objective questions and keyword estimates for descriptive answers, not AI assessment. History, reports and seven-day study plans are saved normally. Difficulty selection and adaptive AI follow-ups apply only with a configured API key. Coding execution still requires a configured sandbox, and coding generation requires AI. With a valid key, the original personalized AI generation and semantic duplicate checks are used.

## Run locally

Requires Node.js 22.13+ (Node 24 recommended), npm, and PostgreSQL 17+.

```sh
npm install
node scripts/setup-env.mjs
```

The setup script creates a private `.env` with a randomly generated local database password. Existing configuration is preserved. No environment files, personal records, database contents, API credentials, or local recordings are included in the repository. Prisma schema and migrations contain only the structure needed to install the application.

Start PostgreSQL using either:

```sh
docker compose up -d db
```

or the included development-only embedded PostgreSQL runner:

```sh
npm run db:local
```

Keep the runner terminal open. It listens only on `127.0.0.1:5432`, stores files in `.local-db`, and creates `placement` and `placement_test`. It must run as a normal operating-system user. Docker is the preferred alternative on systems that prohibit the embedded binaries. Never expose the development credentials publicly.

In another terminal:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://localhost:3000**. Create an account, complete your profile, then start a practice session. Monaco assets are copied from the installed dependency before `dev` and `build`; fonts and the editor are served locally.

The seed contains only topic/category metadata. All question fixtures are restricted to the test directory.

## Environment variables

| Variable                 | Purpose                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | PostgreSQL connection URL; use TLS and a dedicated account in production.                                                       |
| `APP_URL`                | Exact public origin, e.g. `https://prep.example.com`; required for origin checks.                                               |
| `OPENAI_API_KEY`         | Server-only OpenAI API key, never a `NEXT_PUBLIC_` variable.                                                                    |
| `OPENAI_MODEL`           | Model supporting structured Chat Completions; example: `gpt-4.1-mini`.                                                          |
| `OPENAI_EMBEDDING_MODEL` | Embedding model, initially `text-embedding-3-small`.                                                                            |
| `JUDGE0_URL`             | Trusted Judge0 CE-compatible service base URL. Required for coding generation, execution, and the coding section of mock tests. |
| `JUDGE0_API_KEY`         | Sandbox access token; blank only for a secured internal service.                                                                |
| `JUDGE0_AUTH_HEADER`     | Default `X-Auth-Token`; use `X-RapidAPI-Key` for RapidAPI.                                                                      |
| `JUDGE0_RAPIDAPI_HOST`   | Optional subscription host for RapidAPI.                                                                                        |
| `JUDGE0_LANGUAGE_IDS`    | JSON object overriding Judge0 compiler IDs, e.g. `{"Python":71}`.                                                               |
| `TRUST_PROXY`            | `true` only when a trusted ingress overwrites `x-forwarded-for`; otherwise auth also uses a conservative global rate bucket.    |
| `TEST_DATABASE_URL`      | Separate disposable PostgreSQL database named `placement_test`. Never point this at production.                                 |
| `LIVE_AI_TESTS`          | `true` to opt into billable live AI integration checks.                                                                         |
| `LIVE_SANDBOX_TESTS`     | `true` to opt into live Judge0 execution checks.                                                                                |

The generated local `.env` is ignored by Git. No real service keys are included.

## Implemented experience

- Landing, registration/login, secure logout, password changes with session revocation.
- Student onboarding: college, degree, branch, graduation year, experience, target role, multiple languages, desired topics.
- Dashboard: readiness, category scores, streak, question/submission/session counts, progress chart, active sessions.
- Technical, HR, DSA, coding, quantitative, logical, aptitude, mixed, company simulation, resume, and full mock sessions.
- Interview conversations: one outstanding question, two progressive hints, answer evaluation, contextual follow-up generation, adaptive difficulty, persistent history, and a final report.
- Coding workspace: lazy-loaded Monaco, language selection, custom stdin, example runs, hidden-test submissions, output/errors, elapsed execution time, memory, and AI code feedback.
- Resume text extraction from text-based PDF/TXT; extracted text can be removed. Scanned-image OCR is not included.
- Analytics: daily performance, category/topic scores, improving/declining topics, persistent weaknesses, coding success, difficulty history.
- Automatically refreshed 7-day improvement plan after finishing each session, manual regeneration, and persisted task completion.
- Light/dark themes, responsive navigation, accessible controls, keyboard focus, loading/empty/error states.
- Optional browser question speech and browser speech recognition. Text entry remains fully functional without microphone permissions or voice support.

Swift is a profile preference, but not a supported executable language. The sandbox adapter supports C, C++, Java, Python, JavaScript, TypeScript, Go, Rust, C#, Kotlin, and PHP. The initial compiler IDs match common Judge0 CE installations; verify your provider's `/languages` response.

## Architecture

```text
Browser / React
  ├─ Landing + authentication
  └─ Student workspace + lazy Monaco/charts
       │ same-origin JSON / multipart requests
Next.js API routes
  ├─ Origin checks → validation → session ownership → rate limits
  ├─ Per-student operation lease (PostgreSQL)
  ├─ Interview orchestration
  │    ├─ Student context + question history
  │    ├─ Structured AI services
  │    ├─ Exact hash + embeddings + semantic adjudication
  │    └─ Atomic attempt/mistake/submission persistence
  ├─ Judge0 adapter → isolated external execution workers
  └─ PostgreSQL / Prisma
```

Key directories:

| Path                       | Responsibility                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app`                  | App Router pages, shared layout, design system CSS, server API entry point.                                                                                          |
| `src/components`           | Auth, shell, dashboard, practice setup, profile, plans, analytics, chat, code editor.                                                                                |
| `src/lib`                  | Typed schemas, topic catalog, authentication, authorization, rate limiting, database, scoring.                                                                       |
| `src/server/ai.ts`         | QuestionGenerator, AnswerEvaluator, InterviewAgent, MistakeAnalyzer, ImprovementPlanner, CodingProblemGenerator, AptitudeGenerator, DSAGenerator, ResumeInterviewer. |
| `src/server/questions.ts`  | Personalization, history scanning, uniqueness checks, coding reference validation, safe question DTO.                                                                |
| `src/server/interviews.ts` | Lifecycle, hints, submissions, feedback, reports, plans, analytics.                                                                                                  |
| `src/server/execution.ts`  | `CodeExecutor` abstraction and Judge0 implementation.                                                                                                                |
| `prisma`                   | Schema, initial migration, topic seed.                                                                                                                               |
| `tests`                    | Unit, AI-contract, API-boundary, execution-adapter, database, optional live-provider tests.                                                                          |
| `e2e`                      | Browser authentication, onboarding, responsive dashboard, session/history, sign-out/sign-in.                                                                         |

The database uses `User`, `Profile`, `AuthSession`, `InterviewSession`, `Question`, `QuestionAttempt`, `CodingSubmission`, `Mistake`, `ImprovementPlan`, `ImprovementTask`, `Topic`, `RateLimit`, and `OperationLock`. Question records are the authoritative question history; attempts store scores and feedback. Topic metrics are derived from attempts rather than duplicated into drifting tables. Foreign keys, cascading deletes, ownership predicates, exact question hashes, session positions, and one-attempt-per-question constraints enforce consistency.

## AI setup and behavior

Create an OpenAI project key with available billing, place it in the server environment, and select a model supporting structured outputs. Restart the app after changing `.env`. API requests use Zod-derived structured response schemas and validate outputs again before saving.

Source documentation: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings).

Generation receives the profile, selected role/language/mode/topic, recent questions, recent mistakes, weak/strong topic scores, session difficulty, and the previous evaluation's follow-up. Two out of every three positions prioritize weaknesses; the third explores a different topic or strength. Explicit topic choice remains the primary focus. Resume questions must use supplied resume facts. Company simulation never claims access to confidential or actual company interview questions.

Answers, resume text, and code are treated as untrusted input. The evaluator assesses accuracy, problem solving, reasoning, communication, completeness, complexity, code quality and edge cases; mistakes are categorized and stored. Confidence commentary is restricted to observable answer evidence. The AI can still make factual or scoring errors; generated assessments need evaluation against human-reviewed examples before a consequential deployment.

**Uniqueness:** normalized SHA-256 eliminates exact duplicates. Every prior question for that student is compared through same-model embedding cosine similarity, fetched in pages of 250. Similarity ≥ 0.94 rejects directly; candidates ≥ 0.65 enter a structured semantic adjudication against the nearest 12. The generator retries up to five times, then fails instead of returning a known duplicate. A database operation lease prevents concurrent generation from racing history checks. This is a conservative probabilistic system, not a mathematical guarantee of semantic novelty. Tune thresholds using a labeled paraphrase/application dataset for your roles and languages. At large per-student histories, replace the paged scan with a tenant-filtered pgvector nearest-neighbor index and retain exact-hash constraints. Changing the embedding model requires re-embedding historical questions; generation fails closed for mixed models.

**Scoring:** non-coding scores weight accuracy 30%, problem solving 25%, completeness 20%, reasoning 15%, and communication 10%. Coding scores weight sandbox pass rate 70% and the rubric 30%. Overall readiness is the mean of observed attempts, not a prediction or employment guarantee. Unassessed categories show “Not assessed.” Trends require four topic attempts; persistent weaknesses require three recent scores below 65. Streaks use UTC dates. Submission time is elapsed time since question creation, including time away from the page.

**Adaptive difficulty:** four consecutive scores ≥80 raise difficulty; two consecutive scores <45 lower it, bounded by easy/expert. The server owns the difficulty. Follow-up questions receive the same duplicate checks as other questions.

**Mock test:** 120 minutes, with the requested 20 quantitative, 15 logical, 10 verbal, 15 technical, 10 DSA, and 2 coding questions. Questions generate incrementally. The server enforces the deadline; unanswered questions remain visibly unanswered in the report. Ending early is supported. Reports use the average of answered questions and explicitly show completion counts.

## Code execution setup

Use a maintained Judge0 CE-compatible managed service, or operate Judge0 on **separate isolated worker hosts** following its deployment guidance. Do not deploy untrusted execution beside the web app or database. The app does not call `eval`, spawn compilers, or execute submitted/reference code locally.

1. Configure the trusted service URL/token and provider-specific header.
2. Verify available compiler IDs using the service's `/languages` endpoint. Override mappings with `JUDGE0_LANGUAGE_IDS` where necessary.
3. Ensure the worker enforces CPU/memory/process/file limits and disables network access. Protect the API with authentication and network policy.
4. Run `LIVE_SANDBOX_TESTS=true npm run test:live` (PowerShell: set `$env:LIVE_SANDBOX_TESTS='true'` first).

The adapter submits base64 source/stdin/expected output with asynchronous polling, a 2-second CPU limit, 5-second wall limit, 128 MB memory limit, 32 process/thread limit, and no network. It polls up to 30 times with request timeouts. Provider policy may impose different compiler requirements; validate each enabled language before launch.

Generated problems include a private Python reference solution. The service executes it against all examples and hidden tests before accepting the problem. This catches inconsistent output but cannot prove the AI reference is algorithmically correct. AI review and evaluation datasets remain necessary. Public responses omit reference code, private concepts/explanations before submission, and hidden test data. Hidden execution results expose only status/time/memory/pass state. AI post-submission explanations show the solution reasoning, not a hidden-test listing.

Monaco supports syntax highlighting and indentation across the enabled languages. Its built-in document formatting is available for JavaScript/TypeScript; additional language formatters require language-server integration.

Judge0 reference: [CE API documentation](https://ce.judge0.com/).

## Tests and validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

`npm test` includes database tests only when `TEST_DATABASE_URL` is set. Prepare the disposable `placement_test` database by applying the migration with `DATABASE_URL` temporarily pointed at it. The test suite refuses database names other than `placement_test`, creates isolated records, then deletes only those records. API keys and sandbox results are mocked in deterministic tests; production contains no mock provider.

Tests cover question privacy, exact/semantic duplicates and regeneration, history persistence, scoring, adaptive difficulty, owner isolation, server deadlines, progressive hints, operation concurrency, rate limits, sandbox request limits, failure handling, compilation errors, final submissions, mistakes, and plan tasks. Browser tests exercise actual local authentication and PostgreSQL, including missing-AI configuration handling. They assume live AI is disabled and create test accounts; run against a disposable development database.

Live provider tests are opt-in, billable, and skipped by default:

```sh
# POSIX shell
LIVE_AI_TESTS=true LIVE_SANDBOX_TESTS=true npm run test:live
```

```powershell
$env:LIVE_AI_TESTS = 'true'
$env:LIVE_SANDBOX_TESTS = 'true'
npm run test:live
```

Do not interpret deterministic-provider test success as validation of real model quality or sandbox availability. See `VALIDATION.md` for checks actually performed in this workspace.

## Production deployment

1. Provision PostgreSQL with TLS, backups, point-in-time recovery and a restricted application account.
2. Provision OpenAI and separate sandbox credentials. Add secrets through the host's secret manager.
3. Set `APP_URL` to the HTTPS origin and `NODE_ENV=production`. Secure session cookies require HTTPS.
4. Run `npm ci`, `npm run db:generate`, and `npm run db:migrate` as a controlled release step, followed by `npm run db:seed` with the deployment environment. The seed command can also be run as `npx tsx prisma/seed.ts` when environment variables are injected and no `.env` file exists.
5. Run `npm run build` and `npm start`. Route traffic through an HTTPS ingress with request-body limits (100 KB JSON; 3 MB multipart), request throttling and trusted forwarded-IP handling.
6. Use a long-lived Node hosting environment supporting up to 300-second requests. AI generation, semantic checking, reference validation and reports may exceed short serverless timeouts. For higher throughput, move these operations into a durable queue with polling/SSE and cancellation; keep the existing service interfaces.
7. Schedule `node --env-file=.env scripts/cleanup.mjs` daily for expired login sessions, rate buckets and operation leases (omit `--env-file` with injected secrets).
8. Monitor provider errors/latency/cost, database saturation and sandbox health. Set provider quotas and usage alerts; load-test before opening public registration.

Sessions use random 256-bit opaque cookies, SHA-256 token hashes in PostgreSQL, seven-day expiry, HttpOnly, SameSite=Lax, and Secure in production. Passwords use bcrypt cost 12. All private reads/writes apply user ownership; mutations require the configured exact origin. Zod validates inputs, Prisma parameterizes queries, React escapes user output, and headers restrict framing and resource loading. The CSP permits Monaco's worker/evaluation requirements; it is not a substitute for safe rendering. Server secrets never reach the client.

Account email verification, self-service forgotten-password email, OAuth, billing, a durable AI job queue, OCR, and language-server formatting beyond Monaco's built-in support are not included. Password changes are available to signed-in users. Email delivery would require its own provider and token lifecycle. These are explicit deployment/product extensions, not simulated controls.

## Generated TypeScript files

`next-env.d.ts` and `.next` are generated locally and are not committed. Do not combine imports from `.next/dev/types` and `.next/types` manually. Next.js chooses the correct paths for each command. Dependency installation generates the initial declarations; `npm run typecheck` refreshes route types before checking the project. If your editor reports missing generated declarations after switching branches, run `npm run typecheck`, then restart its TypeScript server if necessary.

## Gemini configuration

Gemini is supported for fresh interview questions, evaluations, reports, study plans, and question embeddings. Add your own key privately to the ignored `.env` file:

```dotenv
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

Restart `npm run local` after changing configuration. Gemini takes priority when both Gemini and OpenAI keys are set. With neither key, supported interviews use the offline question bank. The `/demo` page remains a preset sample; use a signed-in interview to generate AI questions. Never commit the key or use a `NEXT_PUBLIC_` variable for it. Model access and quota depend on your Google project. Judge0 is still required for code execution.

Gemini uses Zod 4's native JSON Schema conversion and validates returned JSON against the original contracts. The retired `text-embedding-004` default has been replaced. Existing question history created with a different online embedding model requires re-embedding before new AI questions can be generated; the app rejects incompatible vectors instead of comparing them.
