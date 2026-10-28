<

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
- Tests: `npx jest tests/unit/<file>` or `npx jest tests/integration/<file>`. Run the targeted file first, then widen by risk; full `npm test` for broad or security-sensitive changes. Integration tests use mongodb-memory-server and doubles in `tests/helpers/`; never point tests at a real DB.

## Code patterns
- API routes: `export const GET = withApiHandler(fn, { auth, roles, bodySchema, rateLimit })` at module scope (never per request — it breaks rate limiting). Validate body/query with `@zindagi/validators` schemas. Keep business logic in a service; keep the `apiSuccess`/`apiError` response shape.
- Reuse existing components, services, validators and helpers before writing new ones; no new dependencies without asking. No `any` or unsafe casts where a type exists.
- Mutations must keep cache invalidation working (`src/server/lib/cache.ts`).
- Keep API responses and shared types backward compatible unless a breaking change is approved.
- Optimize only with evidence (a measurement or failing test), never by weakening auth, validation or rate limits.

## Errors
- Throw `new AppError(message, code, status)` using `ErrorCodes` (UNAUTHORIZED 401, FORBIDDEN 403, NOT_FOUND 404, VALIDATION 400, CONFLICT 409, RATE_LIMITED 429); `withApiHandler` → `apiError()` turns them and Zod errors into responses.
- Add try/catch only to recover, translate, clean up, or add context; no empty catches or swallowed errors. When rethrowing, keep the original as `{ cause }`.
- External calls (Supabase, Redis, Zoom, payments, push) need a timeout and an explicit failure path. Retry only idempotent operations, with bounded attempts and backoff.
- Logging: `console.error("[module] what failed", { ids, error: e?.name })`. Log once, at the boundary.
- Background/fire-and-forget work must `.catch()` and log (see `src/server/lib/schedule-*.ts`).
- Never put stack traces, secrets, tokens, env values, or patient data (identity, records, consultation/chat content) in logs, caches, API responses, or user-facing errors.

## Security
- Keep authentication and role checks; scope every query by `session.user.id`/roles. IDOR is tested in `tests/integration/authz-idor.test.ts`.
- Validate all untrusted input at the boundary. Never bypass authorization for convenience.

## Tests
- Bug fixes get a regression test. Behavior changes get deterministic tests for boundaries, invalid input, authorization (wrong user/role), and failure paths, as applicable.

## Working efficiently
- Read only files relevant to the task; grep for symbols before opening large files or directories. Don't re-read files or re-investigate facts already established.
- Don't dump lockfiles, `.next/`, `node_modules`, generated files, or full logs — show only the relevant errors and summarize output.
- Prefer focused diffs and targeted tests. Don't delegate to agents unless asked. Never skip required verification or safety checks to save tokens.

## Workflow and safety
- Check `git status` first and never overwrite unrelated changes. Find the root cause before fixing; make the smallest complete change; review `git diff` before finishing.
- Report exactly which checks ran and their results; say what wasn't run and why. Never claim a command ran when it didn't.
- Git: commits go directly on `main`, only when asked. Graphite (`gt`) is not installed or configured here, so don't use it or stacked PRs unless the user sets it up. Never create branches, rewrite history, push, or open PRs without authorization.
- Never deploy, run migrations/seeds, or write to real databases/external services without approval; never touch production patient data. Don't edit `.env*`, `vercel.json`, schemas, or infra config unless the task needs it and it's approved.
- Optional, where the Ponytail Claude Code plugin is installed (not part of the repo): `/ponytail-review` reviews a change (correctness, safety, load, tests, leanness), and `/ponytail-audit` audits the whole repo. Both are read-only reports.

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