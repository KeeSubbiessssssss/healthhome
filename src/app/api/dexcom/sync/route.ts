import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { dexcomConnections, dexcomOAuthCredentials } from "@/db/schema";
import { db } from "@/lib/db";
import { syncDexcomConnection } from "@/lib/dexcom-sync";
import { currentMember } from "@/lib/household";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const background = request.nextUrl.searchParams.get("background") === "1";
  const member = await currentMember();
  if (!member) return background ? NextResponse.json({ ok: false, code: "not-authenticated" }, { status: 401 }) : NextResponse.redirect(new URL("/auth/sign-in", request.url), 303);
  const [connection] = await db.select().from(dexcomConnections).where(eq(dexcomConnections.householdMemberId, member.id)).limit(1);
  if (!connection) return background ? NextResponse.json({ ok: false, code: "not-connected" }, { status: 409 }) : NextResponse.redirect(new URL("/app?dexcom=not-connected", request.url), 303);
  const [credentials] = await db.select().from(dexcomOAuthCredentials).where(eq(dexcomOAuthCredentials.connectionId, connection.id)).limit(1);
  if (!credentials) return background ? NextResponse.json({ ok: false, code: "needs-reauth" }, { status: 409 }) : NextResponse.redirect(new URL("/app?dexcom=needs-reauth", request.url), 303);

  try {
    const result = await syncDexcomConnection(connection.id);
    if (background) return NextResponse.json({ ok: true, readingsReceived: result.readingsReceived });
    return NextResponse.redirect(new URL("/app?dexcom=synced", request.url), 303);
  } catch {
    if (background) return NextResponse.json({ ok: false, code: "sync-failed" }, { status: 502 });
    return NextResponse.redirect(new URL("/app?dexcom=sync-failed", request.url), 303);
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/app?dexcom=use-sync-button", request.url));
}
