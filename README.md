# HealthHome

A family pinboard for lists, tasks, medication for people and pets, and birthday and Christmas presents. The name is temporary.

## Local use

Run `npm run dev` and open http://localhost:3000. Local development needs no login. Add family members and pets in Settings, then create lists, assign tasks, track medication, and plan presents. Drag card handles or use their move buttons to rearrange the board.

Local changes are saved in this browser’s local storage. They are not sent to Neon, shared between devices, or automatically copied into a hosted household. Clearing browser site data removes the local board.

## Hosted use

Hosted builds retain Neon Auth and household access checks. Board snapshots are stored in `family_boards`, scoped by household and protected by optimistic version checks. Existing active prescriptions and dose logs are imported into the new board on first save; original medication records remain intact. People and pets on a board are organisational profiles, not login accounts.

The Dexcom API integration, connection routes, sync, glucose screens, and old background have been removed. Historical provider tables and versioned migration files remain to avoid deleting shared data. They are unused by the application.

## Database workflow

- Define tables in `src/db/schema.ts` and generate SQL with `npm run db:generate`.
- Review and commit generated `drizzle/` files with the feature.
- Test migrations on an isolated Neon branch before deployment.
- Never run schema push against a shared environment.
- Deployment builds validate migrations and apply pending migrations with `DATABASE_URL_UNPOOLED` before building.

`0008_smooth_the_executioner.sql` adds only the household board table. It must be applied to the relevant environment before hosted board use. Local browser mode does not query this table or run migrations.

## Checks

`npm run lint`, `npm run test`, `npx tsc --noEmit`, and `npm run db:check`.

Keep environment files, credentials, and personal data out of Git. Medication entries are records of care given, not treatment instructions or clinical alerts.
