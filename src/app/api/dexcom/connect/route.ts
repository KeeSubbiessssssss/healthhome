import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { dexcomConfig } from "@/lib/dexcom";
import { currentMember } from "@/lib/household";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const member = await currentMember();
  if (!member) return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  try {
    const config = dexcomConfig(); const state = randomBytes(32).toString("base64url");
    const url = new URL(config.authorizeUrl); url.searchParams.set("response_type", "code"); url.searchParams.set("client_id", config.clientId); url.searchParams.set("redirect_uri", config.redirectUri); url.searchParams.set("scope", "offline_access"); url.searchParams.set("state", state);
    const response = NextResponse.redirect(url); response.cookies.set("healthhome_dexcom_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" }); return response;
  } catch { return NextResponse.json({ error: "Dexcom credentials are not configured yet." }, { status: 503 }); }
}
