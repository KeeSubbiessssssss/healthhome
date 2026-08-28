# HealthHome

HealthHome is a private household dashboard for sharing Dexcom CGM data safely with a trusted family member and tracking household inventory.

## Current milestone

The local app shell is in place with an example-data dashboard. Neon Postgres and Neon Auth are wired server-side, but no HealthHome data schema, Dexcom credentials, OAuth code, or live health data has been added yet.

## Safety and privacy boundary

- This is a personal data-viewing app, not a clinical alerting, dosing, or treatment-decision product.
- Any Dexcom client secret, access token, and refresh token will be server-only. They must never reach browser code or Git.
- The future app will have a private owner role and a household-member role. Household members may view the prepared dashboard but cannot access provider credentials.
- Keep `.env` files private. Copy `.env.example` only after the Dexcom sandbox app has been created.
- `DATABASE_URL` is pooled for application requests. `DATABASE_URL_UNPOOLED` is reserved for future Drizzle migrations.

## Planned first release

- Private household sign-in for an owner and partner.
- Owner-connected Dexcom dashboard: latest reading, trend, 24-hour history, and explicit data freshness.
- Shared inventory: item, quantity, minimum quantity, and location.
- Server-side Dexcom OAuth and token handling only.

## Local development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the local prototype.

## Next build steps

1. Add the shared Neon Auth cookie secret to local and Vercel environments, then create the two household accounts.
2. Add a database schema for members and shared inventory.
3. Register the Dexcom sandbox application and add the server-only OAuth flow.
4. Replace example glucose data with a read-only Dexcom sandbox sync.
