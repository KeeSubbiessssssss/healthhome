<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Personal infrastructure only

- HealthHome is personal. Never use EduCom accounts, teams, databases, credentials or billing for this repository.
- Neon: use `--profile healthhome-personal` explicitly. Verify `neon me` returns `kee.sublime@gmail.com`. The global `DEFAULT` profile is a work account; do not use or modify it.
- Approved Neon organisation: `org-misty-star-74450945` (Kee Sub); project: `green-dust-74421329` (HealthHomeApp). Production branch: `br-shiny-dawn-a7l61g5b`.
- Production database endpoint: `ep-muddy-art-a73qkf2l`. Preview branch: `br-old-unit-a7za5xaa` (`vercel-preview`), endpoint `ep-wandering-hill-a7jhfrcg`. Never put the production endpoint in Vercel Preview settings.
- Vercel: use `--global-config .vercel/personal-cli --scope pikensteiner` explicitly. Verify the signed-in user is `keesublime-7521` and the project is `prj_J5SQOi1nj0DF3Et9XD3wSV02alCz` (healthhome). This account also has work-team access: authentication alone does not verify the target.
- Keep the project-local CLI credentials under the ignored `.vercel/` directory. Never commit credentials or environment exports.
- Verify database/auth endpoint ownership against the personal Neon project before pulling environment settings, migrating, or deploying. Preview must use its own branch, never production.
- Domain `pikensteiner.me` is registered and DNS-hosted at GoDaddy; the site is hosted in the personal Vercel project. Keep unrelated DNS/email records intact.

## HealthHome database workflow

- The user works on the live personal production site by default. Make and check code locally, then deploy to personal production; do not make them use localhost or previews for normal use. The local demo, browser board storage and transfer features have been retired after the data was imported into production. Do not reintroduce them or a login bypass.
- Do not create extra services, subscriptions or paid plans without explicit approval. Household invites are copyable links shared by the owner, not an external email integration.

- Before adding or changing application data, inspect the linked Neon branch and existing Drizzle migration state.
- Define tables in src/db/schema.ts, generate a reviewed SQL migration with npm run db:generate, and commit the generated drizzle/ files with the feature.
- Vercel Preview and Production deploys run npm run db:migrate:deploy before the frontend build, using DATABASE_URL_UNPOOLED. Preview uses its isolated Neon branch and never mutates production.
- Never use drizzle-kit push against a shared environment. Destructive, rename, or irreversible data migrations require explicit user approval.
- Do not build a route or UI that depends on a new table/column until its migration has been generated and checked.
