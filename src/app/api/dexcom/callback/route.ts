import { NextRequest, NextResponse } from "next/server";

import { dexcomConnections, dexcomOAuthCredentials } from "@/db/schema";
import { dexcomConfig, encryptDexcomToken } from "@/lib/dexcom";
import { currentMember } from "@/lib/household";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const member = await currentMember(); const state = request.nextUrl.searchParams.get("state"); const code = request.nextUrl.searchParams.get("code"); const cookieState = request.cookies.get("healthhome_dexcom_state")?.value;
  if (!member || !code || !state || !cookieState || state !== cookieState) return NextResponse.redirect(new URL("/app?dexcom=failed", request.url));
  try {
    const config = dexcomConfig();
    const tokenResponse = await fetch(config.tokenUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", authorization: "Basic " + Buffer.from(config.clientId + ":" + config.clientSecret).toString("base64") }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: config.redirectUri }), cache: "no-store" });
    if (!tokenResponse.ok) throw new Error("Token exchange failed.");
    const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
    if (!tokens.access_token || !tokens.refresh_token || !tokens.expires_in) throw new Error("Token response was incomplete.");
    const [connection] = await db.insert(dexcomConnections).values({ householdMemberId: member.id, status: "connected", lastError: null }).onConflictDoUpdate({ target: dexcomConnections.householdMemberId, set: { status: "connected", lastError: null, updatedAt: new Date() } }).returning({ id: dexcomConnections.id });
    await db.insert(dexcomOAuthCredentials).values({ connectionId: connection.id, accessTokenCiphertext: encryptDexcomToken(tokens.access_token), refreshTokenCiphertext: encryptDexcomToken(tokens.refresh_token), accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000), scopes: tokens.scope || null }).onConflictDoUpdate({ target: dexcomOAuthCredentials.connectionId, set: { accessTokenCiphertext: encryptDexcomToken(tokens.access_token), refreshTokenCiphertext: encryptDexcomToken(tokens.refresh_token), accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000), scopes: tokens.scope || null, updatedAt: new Date() } });
    const response = NextResponse.redirect(new URL("/app?dexcom=connected", request.url)); response.cookies.set("healthhome_dexcom_state", "", { maxAge: 0, path: "/" }); return response;
  } catch { return NextResponse.redirect(new URL("/app?dexcom=failed", request.url)); }
}
