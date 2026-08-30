import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { dexcomConnections, dexcomOAuthCredentials } from "@/db/schema";
import { db } from "@/lib/db";
import { syncDexcomConnection } from "@/lib/dexcom-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connections = await db.select({ id: dexcomConnections.id }).from(dexcomConnections).innerJoin(dexcomOAuthCredentials, eq(dexcomOAuthCredentials.connectionId, dexcomConnections.id)).where(eq(dexcomConnections.status, "connected"));
  const results = await Promise.allSettled(connections.map((connection) => syncDexcomConnection(connection.id)));
  const synced = results.filter((result) => result.status === "fulfilled");
  const failed = results.length - synced.length;
  return NextResponse.json({ ok: failed === 0, connections: connections.length, synced: synced.length, failed, readingsReceived: synced.reduce((total, result) => total + result.value.readingsReceived, 0) }, { status: failed === 0 ? 200 : 207 });
}
