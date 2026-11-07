# HealthHome

A family pinboard for lists, tasks, medication for people and pets, and birthday and Christmas presents. The name is temporary.

## Everyday use

Use https://pikensteiner.me. The user works against the personal production site; code is checked locally before being deployed there. No extra hosting or email provider is required for household invitations.

The verified owner (`kee.sublime@gmail.com`, or the explicitly configured `HEALTHHOME_OWNER_EMAIL`) can create the household once. Settings → Access & invitations creates private, single-use, seven-day links bound to the invitee's verified email. Share links yourself. Only the owner can invite, cancel invitations, turn off access or restore it. Members can view and edit the entire household board. Login accounts and family/pet profiles are separate.

Anyone can reach the authentication screen, but signing up does not grant board access. Every board request checks verified email and active household membership. Disabling access blocks subsequent requests; it cannot erase information someone already viewed. Invitation tokens are stored as hashes and travel in URL fragments rather than request URLs. Limits bound invitation creation and household size.

## Development and deployment

Application changes are checked in the repository and deployed to the personal production site. There is no browser-only board, local-save mode, login bypass or transfer screen. All board reads and writes require authentication and use the online household. The previous local testing data has already been imported into production.

## Hosted use

Hosted builds retain Neon Auth and household access checks. Board snapshots are stored in `family_boards`, scoped by household and protected by optimistic version checks. Existing active prescriptions and dose logs are imported into the new board on first save; original medication records remain intact. People and pets on a board are organisational profiles, not login accounts.

The Dexcom API integration, connection routes, sync, glucose screens, and old background have been removed. Historical provider tables and versioned migration files remain to avoid deleting shared data. They are unused by the application.

## Database workflow

- Define tables in `src/db/schema.ts` and generate SQL with `npm run db:generate`.
- Review and commit generated `drizzle/` files with the feature.
- Test migrations on an isolated Neon branch before deployment.
- Never run schema push against a shared environment.
- Deployment builds validate migrations and apply pending migrations with `DATABASE_URL_UNPOOLED` before building.

`0008_smooth_the_executioner.sql` adds only the household board table. It must be applied to the relevant environment before hosted board use.

## Personal hosting accounts

Use `npm run vercel:personal -- <command>` and `npm run neon:personal -- <command>` for infrastructure work. These select the personal Vercel configuration/team and named personal Neon profile explicitly; the machine's default Neon profile belongs to work. On another machine, sign in with these commands' `login` / `auth` subcommands first.

The verified personal email is `kee.sublime@gmail.com`. Vercel hosts `pikensteiner/healthhome`; Neon hosts `HealthHomeApp` in the `Kee Sub` organisation. Exact approved IDs and verification requirements are recorded in `AGENTS.md`. Domain registration and DNS are at GoDaddy. Both `pikensteiner.me` and `www.pikensteiner.me` are attached to the personal Vercel project.

## Checks

`npm run lint`, `npm run test`, `npx tsc --noEmit`, and `npm run db:check`.

Keep environment files, credentials, and personal data out of Git. Medication entries are records of care given, not treatment instructions or clinical alerts.
