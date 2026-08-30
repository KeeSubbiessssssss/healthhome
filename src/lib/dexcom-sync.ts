import { eq } from "drizzle-orm";

import { dexcomConnections, dexcomOAuthCredentials, glucoseReadings } from "@/db/schema";
import { db } from "@/lib/db";
import { decryptDexcomToken, dexcomConfig, encryptDexcomToken } from "@/lib/dexcom";

type DexcomEgv = { recordId?: string; systemTime?: string; value?: number; trendRate?: number | null };
type DexcomResponse = { records?: DexcomEgv[] };
type DexcomDataRange = { egvs?: { start?: { systemTime?: string }; end?: { systemTime?: string } } };

export class DexcomSyncError extends Error {
  constructor(readonly code: string, readonly detail = "Dexcom rejected the glucose-reading request.") {
    super(detail);
  }
}

function dexcomUtcTime(value: string) {
  const timestamp = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) throw new DexcomSyncError("data-range-invalid");
  return date;
}

function dexcomRequestTime(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

export async function syncDexcomConnection(connectionId: string) {
  const [connection] = await db.select().from(dexcomConnections).where(eq(dexcomConnections.id, connectionId)).limit(1);
  const [credentials] = await db.select().from(dexcomOAuthCredentials).where(eq(dexcomOAuthCredentials.connectionId, connectionId)).limit(1);
  if (!connection || !credentials) throw new DexcomSyncError("needs-reauth", "Dexcom needs to be connected again before it can sync.");

  try {
    const config = dexcomConfig();
    let accessToken = decryptDexcomToken(credentials.accessTokenCiphertext);
    if (credentials.accessTokenExpiresAt.getTime() < Date.now() + 60_000) {
      const tokenResponse = await fetch(config.tokenUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: decryptDexcomToken(credentials.refreshTokenCiphertext), grant_type: "refresh_token" }), cache: "no-store" });
      if (!tokenResponse.ok) throw new DexcomSyncError(`token-refresh-${tokenResponse.status}`);
      const refreshed = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
      if (!refreshed.access_token || !refreshed.refresh_token || !refreshed.expires_in) throw new DexcomSyncError("token-refresh-incomplete");
      accessToken = refreshed.access_token;
      await db.update(dexcomOAuthCredentials).set({ accessTokenCiphertext: encryptDexcomToken(refreshed.access_token), refreshTokenCiphertext: encryptDexcomToken(refreshed.refresh_token), accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000), updatedAt: new Date() }).where(eq(dexcomOAuthCredentials.connectionId, connection.id));
    }

    const dataRangeEndpoint = new URL("/v3/users/self/dataRange", config.apiBaseUrl);
    const dataRangeResponse = await fetch(dataRangeEndpoint, { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" }, cache: "no-store" });
    if (!dataRangeResponse.ok) throw new DexcomSyncError(`data-range-${dataRangeResponse.status}`);
    const dataRange = await dataRangeResponse.json() as DexcomDataRange;
    const earliest = dataRange.egvs?.start?.systemTime;
    const latest = dataRange.egvs?.end?.systemTime;
    if (!earliest || !latest) throw new DexcomSyncError("no-egv-data-available");

    const latestReading = dexcomUtcTime(latest);
    const earliestReading = dexcomUtcTime(earliest);
    const start = new Date(Math.max(earliestReading.getTime(), latestReading.getTime() - 24 * 60 * 60 * 1000));
    const end = new Date(latestReading.getTime() + 1000);
    const endpoint = new URL("/v3/users/self/egvs", config.apiBaseUrl);
    endpoint.searchParams.set("startDate", dexcomRequestTime(start));
    endpoint.searchParams.set("endDate", dexcomRequestTime(end));
    const response = await fetch(endpoint, { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" }, cache: "no-store" });
    if (!response.ok) {
      const responseText = (await response.text()).slice(0, 500);
      let detail = "Dexcom rejected the glucose-reading request.";
      try { const parsed = JSON.parse(responseText) as { message?: string; error?: string }; detail = parsed.message || parsed.error || detail; } catch { /* Dexcom does not guarantee JSON error bodies. */ }
      throw new DexcomSyncError(`egv-request-${response.status}`, detail);
    }
    const data = await response.json() as DexcomResponse;
    const readings = (data.records || []).flatMap((record) => !record.recordId || !record.systemTime || typeof record.value !== "number" ? [] : [{ connectionId: connection.id, sourceReadingId: record.recordId, recordedAt: new Date(record.systemTime), valueMgDl: record.value, trend: "unknown" as const, trendRate: record.trendRate === null || record.trendRate === undefined ? null : String(record.trendRate) }]);
    if (readings.length > 0) await db.insert(glucoseReadings).values(readings).onConflictDoNothing();
    await db.update(dexcomConnections).set({ lastSyncedAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(dexcomConnections.id, connection.id));
    return { readingsReceived: readings.length };
  } catch (error) {
    const code = error instanceof DexcomSyncError ? error.code : "unexpected";
    const detail = error instanceof DexcomSyncError ? error.detail : "Please try again, or reconnect Dexcom.";
    console.error("Dexcom sync failed", { connectionId, code });
    await db.update(dexcomConnections).set({ lastError: `Dexcom sync could not complete (${code}): ${detail}`, updatedAt: new Date() }).where(eq(dexcomConnections.id, connection.id));
    throw error;
  }
}
