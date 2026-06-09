# Nellys Implementation Status

## Completed in this pass

- Created architecture plan locally in `docs/NELLYS_ARCHITECTURE_PLAN.md`.
- Recorded approved decisions:
  - Next.js + Prisma + PostgreSQL + Auth.js.
  - UI name `Nellys`.
  - Product subtitle `Puzzle Solver`.
  - Solver core moved into Phase 1.
- Added project scaffold for Next.js App Router.
- Added Prisma schema draft for users, plans, subscriptions, sessions, images, corrections, AI usage, payments, audit logs, settings, consents and contact messages.
- Added provider contracts for AI, storage, billing and authorization checks.
- Added PWA manifest, icon and offline route.
- Added GitHub/Vercel deployment baseline:
  - `.gitignore`,
  - GitHub Actions CI,
  - `vercel.json`,
  - deployment guide,
  - Prisma generate/build scripts.
- Added initial deterministic Pyraminx domain core:
  - legal moves,
  - inverse moves,
  - state serialization,
  - simulator,
  - shape validator,
  - bounded deterministic solver,
  - solution verification.
- Added unit tests for solved state, inverses, inverse sequences and short deterministic scrambles.
- Added Phase 1 service foundations:
  - default billing plan definitions,
  - monthly solve limit checks,
  - manual session solve wrapper,
  - auth input contracts,
  - Prisma seed SQL for subscription plans.
- Added tested session use-case layer:
  - repository contract,
  - in-memory repository for unit tests,
  - manual session creation,
  - corrected state persistence,
  - ownership checks,
  - admin session access override.
- Added Prisma persistence adapter preparation:
  - Prisma client singleton,
  - Prisma session repository,
  - mapper between Prisma JSON/enums and domain session snapshots.
- Added manual puzzle-session API layer:
  - request contracts,
  - framework-independent API handlers,
  - Next.js API routes for create session, save state and solve,
  - handler tests over in-memory repository.
- Added auth service foundation:
  - user repository contract,
  - in-memory auth repository for tests,
  - password hasher interface,
  - registration and login service,
  - duplicate email and invalid credential tests.
- Added auth persistence preparation:
  - Prisma auth mapper,
  - Prisma auth repository,
  - bcrypt password hasher,
  - auth service factory.
- Added auth API layer:
  - register/login request contracts,
  - framework-independent auth API handlers,
  - Next.js register/login routes,
  - handler tests over in-memory auth repository.
- Added first UI auth flow:
  - register page,
  - login page,
  - reusable client auth form,
  - dashboard copy updated to show current Phase 1 state honestly.
- Added server-side session foundation:
  - `UserSession` Prisma model,
  - opaque session token service,
  - token hashing,
  - in-memory and Prisma session repositories,
  - session create/verify/revoke service,
  - login route HTTP-only cookie metadata.
- Secured puzzle-session API actor source:
  - session cookie actor resolver,
  - user lookup by session token,
  - puzzle-session routes now derive actor server-side,
  - secure handler tests prove request body actor is ignored.
- Adjusted CI to use `npm install` until `package-lock.json` exists.

## Verification

Passed locally in Codex:

```text
node --test --experimental-strip-types tests/unit/*.test.ts
```

Latest result: 38 tests passed.

Not run in the Codex environment:

- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run test:e2e`
- `npm run build`

Reason: `npm` is not available in PATH in this Codex environment. A bundled Node runtime was used for domain tests.

## Important limitation

The current solver core is deterministic and verified against its simulator, but the full real-world Pyraminx color-to-piece physical validator is not finished yet. It must be completed before the app presents arbitrary manually entered color states as production-ready solved workflows.
