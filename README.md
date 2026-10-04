# Placement Prep

A placement practice app for students. It includes interview questions, aptitude and DSA practice, answer history, and a study plan based on saved results.

Built with Next.js, TypeScript, PostgreSQL and Prisma.

## Run it locally

Install Node.js 22.13 or later, then run:

```sh
git clone https://github.com/mjrizzer/Placement-preparation-chatbot.git
cd Placement-preparation-chatbot
npm ci
npm run local
```

Keep the terminal running and open http://localhost:3000. The local launcher creates a private `.env`, starts the included PostgreSQL instance when needed, and applies database migrations. Accounts and results stay in `.local-db` between restarts. If embedded PostgreSQL cannot run on your system, use `docker compose up -d db` after `node scripts/setup-env.mjs`.

A localhost link works only on the computer running the app. Opening this GitHub repository does not start or host the website.

For a quick look without an account, visit http://localhost:3000/demo. That page is a preset walkthrough. Create an account to save actual practice sessions.

## Practice without an API key

Technical, HR, DSA, Aptitude, Logical Reasoning and Verbal practice use the built-in beginner question bank when no AI service is configured. Mixed practice rotates through the supported subjects.

To always use the bank, even if a key has already been configured, add this to your private `.env` and restart the app:

```dotenv
PRACTICE_MODE=standard
```

Objective questions use exact answer matching, so follow the requested format. Descriptive answers receive a keyword estimate and a sample answer to compare against. These checks do not judge reasoning or communication quality. Previously seen questions are excluded; when a subject runs out, choose another subject. Questions are not silently repeated.

The bank includes an additional 60 questions across six subjects. Its content is in `src/server/offline.ts` and `src/server/question-bank.ts`.

## Optional AI questions

Leave `PRACTICE_MODE` unset to allow configured AI services. Gemini takes priority over OpenAI when both keys are present. Store your own key only in the ignored `.env` or your hosting service's secret settings:

```dotenv
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

Restart the app after configuration changes. No API key is included in this repository.

If question generation or similarity checks fail in a supported subject, the session switches to the built-in bank and shows a notice. The rest of that session stays on bank questions. Provider failures during non-coding answer feedback, reports or plans use basic local feedback instead. Database and validation errors are still reported; they are not hidden as AI failures.

Coding, resume-specific questions, company simulations and full mock tests need their configured services. Coding execution also needs a separate Judge0-compatible sandbox; adding an AI key does not run code. Changing embedding models for existing online question history requires re-embedding before AI duplicate comparisons can continue.

## Project layout

| Directory        | Contents                                              |
| ---------------- | ----------------------------------------------------- |
| `src/app`        | Pages and API routes                                  |
| `src/components` | Forms, interview screens and dashboard                |
| `src/server`     | Question bank, AI adapters, scoring and session logic |
| `src/lib`        | Validation, authentication and database helpers       |
| `prisma`         | Database schema, migrations and topic seed            |
| `tests`          | Unit and integration checks                           |
| `e2e`            | Browser tests                                         |

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Next.js generates `next-env.d.ts` and route declarations automatically. Do not edit or commit that file. If the editor reports missing declarations, run `npm run typecheck` and restart its TypeScript server if needed.

Database integration tests require a separate `TEST_DATABASE_URL` database named `placement_test`. Live provider tests are opt-in; normal test success does not prove that an API key has access or quota. Browser tests require the running app and database.

## Hosting

The full app needs a Node.js server and PostgreSQL. It cannot run as a static GitHub Pages site. Configure `DATABASE_URL`, set `APP_URL` to the exact public HTTPS origin, apply migrations with `npm run db:migrate`, then run `npm run build` and `npm start`. Configure optional AI and sandbox credentials on the server only.

## Current limits

- Built-in questions are beginner-level and finite; advanced difficulty needs AI.
- Local keyword feedback is a practice aid, not an interview assessment.
- Tab switching submits the current answer. Coding screens restrict clipboard actions, but these browser rules are not secure proctoring.
- Resume extraction supports text PDFs and TXT, not scanned-image OCR.
- Account email verification and password-reset email are not implemented.
