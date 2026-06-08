# Nellys

Nellys is a Slovak-first mobile PWA for solving Pyraminx and future puzzle types. The product may use AI for image analysis and explanations, but AI is never the source of truth for puzzle moves.

## Core Rule

Every displayed move must be computed and verified by deterministic domain code:

1. Build or correct the puzzle state.
2. Validate the state.
3. Solve with deterministic solver code.
4. Apply the full solution in the simulator.
5. Show the sequence only if the simulator reaches solved state.

## Current Phase

- Phase 0: project architecture, Prisma model, provider contracts, threat model.
- Phase 1: app shell, auth/admin/session foundations, manual input path, and initial deterministic Pyraminx domain core.

## Commands

```bash
npm install
npm run prisma:generate
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## GitHub and Vercel

Deployment notes are in `docs/DEPLOYMENT.md`.

The Vercel build command is:

```bash
npm run vercel-build
```

Production database migrations should be run explicitly with:

```bash
npm run prisma:deploy
```

The local Codex environment currently exposes a bundled Node runtime, but `npm` is not available in PATH here. Dependency installation should be run in a normal Node/npm shell.
