import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { dexcomConnections, dexcomOAuthCredentials, glucoseReadings } from "@/db/schema";
import { db } from "@/lib/db";
import { syncDexcomConnection } from "@/lib/dexcom-sync";
import { currentMember } from "@/lib/household";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const encoder = new TextEncoder();

function streamEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: object) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

export async function POST(request: NextRequest) {
  const background = request.nextUrl.searchParams.get("background") === "1";
  const stream = request.nextUrl.searchParams.get("stream") === "1";
  const asynchronousRequest = background || stream;
  const member = await currentMember();
  if (!member) return asynchronousRequest ? NextResponse.json({ ok: false, code: "not-authenticated" }, { status: 401 }) : NextResponse.redirect(new URL("/auth/sign-in", request.url), 303);
  const [connection] = await db.select().from(dexcomConnections).where(eq(dexcomConnections.householdMemberId, member.id)).limit(1);
  if (!connection) return asynchronousRequest ? NextResponse.json({ ok: false, code: "not-connected" }, { status: 409 }) : NextResponse.redirect(new URL("/app?dexcom=not-connected", request.url), 303);
  const [credentials] = await db.select().from(dexcomOAuthCredentials).where(eq(dexcomOAuthCredentials.connectionId, connection.id)).limit(1);
  if (!credentials) return asynchronousRequest ? NextResponse.json({ ok: false, code: "needs-reauth" }, { status: 409 }) : NextResponse.redirect(new URL("/app?dexcom=needs-reauth", request.url), 303);

  if (stream) {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        streamEvent(controller, { type: "progress", percent: 0, message: "Preparing Dexcom refresh" });
        void syncDexcomConnection(connection.id, (progress) => streamEvent(controller, { type: "progress", ...progress })).then(
          (result) => { streamEvent(controller, { type: "complete", percent: 100, message: "Dexcom is up to date", readingsReceived: result.readingsReceived }); controller.close(); },
          () => { streamEvent(controller, { type: "error", code: "sync-failed", message: "Dexcom could not refresh." }); controller.close(); },
        );
      },
    });
    return new Response(body, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
  }

  try {
    const result = await syncDexcomConnection(connection.id);
    if (background) {
      const [reading] = await db
        .select({
          id: glucoseReadings.id,
          valueMgDl: glucoseReadings.valueMgDl,
          recordedAt: glucoseReadings.recordedAt,
        })
        .from(glucoseReadings)
        .where(eq(glucoseReadings.connectionId, connection.id))
        .orderBy(desc(glucoseReadings.recordedAt))
        .limit(1);
      return NextResponse.json({ ok: true, readingsReceived: result.readingsReceived, reading: reading ?? null });
    }
    return NextResponse.redirect(new URL("/app?dexcom=synced", request.url), 303);
  } catch {
    if (background) return NextResponse.json({ ok: false, code: "sync-failed" }, { status: 502 });
    return NextResponse.redirect(new URL("/app?dexcom=sync-failed", request.url), 303);
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/app?dexcom=use-sync-button", request.url));
}
