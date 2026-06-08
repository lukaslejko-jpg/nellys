# GitHub and Vercel Deployment

## GitHub

Recommended repository name: `nellys`.

Before the first full verification:

```bash
npm install
npm run prisma:generate
npm run lint
npm run typecheck
npm run test
npm run build
```

Commit `package-lock.json` after the first successful `npm install`. After that,
switch GitHub Actions from `npm install` back to `npm ci`.

Then initialize and push:

```bash
git init
git add .
git commit -m "Initial Nellys scaffold"
git branch -M main
git remote add origin git@github.com:<owner>/nellys.git
git push -u origin main
```

## Vercel

Create a new Vercel project from the GitHub repository.

Build settings:

- Framework preset: Next.js
- Build command: `npm run vercel-build`
- Install command: `npm install`
- Output directory: default

Required environment variables:

```text
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
OPENAI_API_KEY
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

For the first Vercel deployment, `DATABASE_URL` should point to a hosted PostgreSQL database such as Neon or Supabase. Prisma migrations should be run deliberately from a controlled environment, not silently on every production build.

## Deployment Rule

Vercel must not expose unfinished capabilities as working production features. Photo recognition, AI assistant, billing and speech stay behind feature flags until their server-side providers, validation and tests are complete.
