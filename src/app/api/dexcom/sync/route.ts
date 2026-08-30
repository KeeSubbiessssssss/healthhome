import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { dexcomConnections, dexcomOAuthCredentials } from "@/db/schema";
import { db } from "@/lib/db";
import { syncDexcomConnection } from "@/lib/dexcom-sync";
import { currentMember } from "@/lib/household";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const member = await currentMember();
  if (!member) return NextResponse.redirect(new URL("/auth/sign-in", request.url), 303);
  const [connection] = await db.select().from(dexcomConnections).where(eq(dexcomConnections.householdMemberId, member.id)).limit(1);
  if (!connection) return NextResponse.redirect(new URL("/app?dexcom=not-connected", request.url), 303);
  const [credentials] = await db.select().from(dexcomOAuthCredentials).where(eq(dexcomOAuthCredentials.connectionId, connection.id)).limit(1);
  if (!credentials) return NextResponse.redirect(new URL("/app?dexcom=needs-reauth", request.url), 303);

  try {
    await syncDexcomConnection(connection.id);
    return NextResponse.redirect(new URL("/app?dexcom=synced", request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/app?dexcom=sync-failed", request.url), 303);
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/app?dexcom=use-sync-button", request.url));
}
