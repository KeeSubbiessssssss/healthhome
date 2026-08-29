import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { dexcomConnections, dexcomOAuthCredentials, glucoseReadings } from "@/db/schema";
import { decryptDexcomToken, dexcomConfig, encryptDexcomToken } from "@/lib/dexcom";
import { currentMember } from "@/lib/household";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type DexcomEgv = { recordId?: string; systemTime?: string; value?: number; trendRate?: number | null };
type DexcomResponse = { records?: DexcomEgv[] };

export async function POST(request: NextRequest) {
  const member = await currentMember();
  if (!member) return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  const [connection] = await db.select().from(dexcomConnections).where(eq(dexcomConnections.householdMemberId, member.id)).limit(1);
  if (!connection) return NextResponse.redirect(new URL("/app?dexcom=not-connected", request.url));
  const [credentials] = await db.select().from(dexcomOAuthCredentials).where(eq(dexcomOAuthCredentials.connectionId, connection.id)).limit(1);
  if (!credentials) return NextResponse.redirect(new URL("/app?dexcom=needs-reauth", request.url));
  try {
    const config = dexcomConfig(); let accessToken = decryptDexcomToken(credentials.accessTokenCiphertext);
    if (credentials.accessTokenExpiresAt.getTime() < Date.now() + 60_000) {
      const tokenResponse = await fetch(config.tokenUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: decryptDexcomToken(credentials.refreshTokenCiphertext), grant_type: "refresh_token" }), cache: "no-store" });
      if (!tokenResponse.ok) throw new Error("refresh failed"); const refreshed = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
      if (!refreshed.access_token || !refreshed.refresh_token || !refreshed.expires_in) throw new Error("refresh incomplete"); accessToken = refreshed.access_token;
      await db.update(dexcomOAuthCredentials).set({ accessTokenCiphertext: encryptDexcomToken(refreshed.access_token), refreshTokenCiphertext: encryptDexcomToken(refreshed.refresh_token), accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000), updatedAt: new Date() }).where(eq(dexcomOAuthCredentials.connectionId, connection.id));
    }
    const end = new Date(); const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); const endpoint = new URL("/v3/users/self/egvs", config.apiBaseUrl); endpoint.searchParams.set("startDate", start.toISOString()); endpoint.searchParams.set("endDate", end.toISOString());
    const response = await fetch(endpoint, { headers: { authorization: "Bearer " + accessToken, accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error("Dexcom EGV request failed"); const data = await response.json() as DexcomResponse;
    for (const record of data.records || []) {
      if (!record.recordId || !record.systemTime || typeof record.value !== "number") continue;
      await db.insert(glucoseReadings).values({ connectionId: connection.id, sourceReadingId: record.recordId, recordedAt: new Date(record.systemTime), valueMgDl: record.value, trend: "unknown", trendRate: record.trendRate === null || record.trendRate === undefined ? null : String(record.trendRate) }).onConflictDoNothing();
    }
    await db.update(dexcomConnections).set({ lastSyncedAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(dexcomConnections.id, connection.id));
    return NextResponse.redirect(new URL("/app?dexcom=synced", request.url));
  } catch {
    await db.update(dexcomConnections).set({ status: "error", lastError: "Sync failed. Try reconnecting Dexcom.", updatedAt: new Date() }).where(and(eq(dexcomConnections.id, connection.id), eq(dexcomConnections.householdMemberId, member.id)));
    return NextResponse.redirect(new URL("/app?dexcom=sync-failed", request.url));
  }
}
