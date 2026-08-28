<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## HealthHome database workflow

- Before adding or changing application data, inspect the linked Neon branch and existing Drizzle migration state.
- Define tables in src/db/schema.ts, generate a reviewed SQL migration with npm run db:generate, and commit the generated drizzle/ files with the feature.
- Vercel Preview and Production deploys run npm run db:migrate:deploy before the frontend build, using DATABASE_URL_UNPOOLED. Preview uses its isolated Neon branch and never mutates production.
- Never use drizzle-kit push against a shared environment. Destructive, rename, or irreversible data migrations require explicit user approval.
- Do not build a route or UI that depends on a new table/column until its migration has been generated and checked.
