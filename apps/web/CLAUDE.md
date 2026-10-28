@AGENTS.md

# ZindagiCare web (apps/web)

Next.js 16 App Router + React 19 + TypeScript + Tailwind v4, npm workspaces monorepo. Mongoose (MongoDB), next-auth v5 beta, Zod v4, Upstash/Redis, Supabase storage. This is a production healthcare app handling patient data.

## Layout
- `src/app/` routes, grouped by role: `(marketing)`, `(auth)`, `(admin)`, `(physiotherapist)`, … API under `src/app/api/v1/**/route.ts`.
- `src/server/services/*.service.ts` business logic; `src/server/api/` route helpers (`withApiHandler`, `response.ts`); `src/server/lib/` infra (cache, rate-limit, object-storage, redis).
- `src/features/<domain>/` UI per feature; `src/components/` shared UI; `src/lib/` client/shared helpers.
- `src/proxy.ts` is the request proxy (Next 16's replacement for middleware).
- Shared packages: `@zindagi/shared` (enums, `AppError`, utils), `@zindagi/database` (Mongoose models), `@zindagi/validators` (Zod schemas). Put schemas/models there, not inline.

## Commands (run in apps/web)
- Dev: `npm run dev` (webpack) · Lint: `npm run lint` · Types: `npx tsc --noEmit` (no script) · Build: `npm run build`
- Tests: `npx jest tests/unit/<file>` or `npx jest tests/integration/<file>` — run the targeted file first, full `npm test` only for broad changes. Integration tests use mongodb-memory-server and doubles in `tests/helpers/`; never point tests at a real DB.

## Patterns to follow
- API routes: `export const GET = withApiHandler(fn, { auth, roles, bodySchema, rateLimit })` at module scope (never per request — it breaks rate limiting). Parse query params with a validators schema. Keep logic in a service.
- Errors: throw `new AppError(message, code, status)` using `ErrorCodes` (UNAUTHORIZED 401, FORBIDDEN 403, NOT_FOUND 404, VALIDATION 400, CONFLICT 409, RATE_LIMITED 429); `withApiHandler` → `apiError()` turns them and Zod errors into responses. Don't add try/catch in routes/services unless you can recover or add context; never swallow errors.• Generate inputs using a random mechanism rather than chosen partitions.
• Book examples: random tests for Triangle, Commission and NextDate (Tables 5.6–5.8).
• Rare categories may occur too infrequently in random samples.
• Random selection does not guarantee boundary or class coverage

- Logging: `console.error("[module] what failed", { ids, error: e?.name })` — log once at the boundary, never log PII, tokens, or medical content.
- Background/fire-and-forget work must `.catch()` and log (see `src/server/lib/schedule-*.ts`).
- Authorization: always scope queries by `session.user.id`/roles; IDOR is tested in `tests/integration/authz-idor.test.ts`.
- Reuse existing components, services and helpers before writing new ones; no new dependencies without asking. No `any` or unsafe casts where a type exists.
- Mutations must keep cache invalidation working (`src/server/lib/cache.ts`).

## Workflow
- Read only files relevant to the task; grep for symbols before opening directories. Don't dump lockfiles, `.next/`, `node_modules`, or full logs — show only the relevant errors.
- Find the root cause before fixing; smallest complete change; review `git diff` before finishing.
- Add/update a test for behavior changes and bug fixes (regression test for confirmed bugs).
- Report exactly which checks ran and their results; say what wasn't run.
- Commits go directly on `main`, only when asked. Never push, deploy, run migrations/seeds, or write to real databases/external services without approval. Don't edit `.env*`, `vercel.json`, or schemas unless the task needs it.

I want you to make effective and consistent use of the installed Ponytail plugin throughout my development workflow.

First, read `CLAUDE.md` and all applicable `AGENTS.md` files. Then inspect the actual installed Ponytail plugin files, skills, commands, and documentation. Verify its real capabilities before using it. Do not assume that any command or feature exists.

### How to use Ponytail

1. **Before coding:** Understand the task, inspect relevant files, and use Ponytail's available guidance to identify existing patterns, unnecessary complexity, and potential risks.

2. **During implementation:** Follow Ponytail's verified recommendations where applicable. Reuse existing services, components, utilities, and patterns. Prefer the smallest complete solution over unnecessary abstractions, duplicated code, or new dependencies.

3. **For bug fixes:** Find the root cause before changing code. Add a focused regression test when appropriate. Do not hide errors or weaken tests to make them pass.

4. **After coding:** Use the appropriate installed Ponytail review command or skill when the changes justify it. Review correctness, security, maintainability, performance, and unnecessary complexity. Run relevant tests and inspect the final Git diff.

5. **For larger changes:** Use a broader Ponytail audit when it adds value. Do not repeatedly audit the entire repository for small, unrelated tasks.

6. **Token efficiency:** Prefer targeted file inspection and verified codebase knowledge. Avoid rereading large files, repeating the same analysis, producing unnecessary reports, or making changes solely to satisfy a plugin recommendation.

7. **Decision-making:** Treat Ponytail findings as recommendations, not unquestionable truth. Verify important findings against the actual code and project requirements. Explain any recommendation you reject.

### Safety rules

- Read-only inspection and reviews are preferred before modifications.
- Never modify production data, run migrations or seeds, change environment/configuration files, push commits, or deploy without my explicit approval.
- Do not install, update, or reconfigure Ponytail without approval.
- Do not make unrelated refactors or change application behavior just to improve a review score.
- Preserve existing architecture, security checks, authorization, error handling, and test coverage.

### Reporting

At the end of each task, briefly report:
- What changed and why.
- Which Ponytail command or skill was used, if any.
- Which tests and checks actually ran.
- Any verified issues that remain.
- Anything you did not verify.

First inspect the installed Ponytail implementation and tell me how you will apply these rules. Do not modify any files in this initial step.