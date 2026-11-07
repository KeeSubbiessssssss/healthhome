import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { householdInvitations, householdMembers } from "@/db/schema";
import { db } from "@/lib/db";
import { currentMember } from "@/lib/household";
import { AccessError, invitationEmail, invitationHash, invitationToken } from "@/lib/access-policy";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  const actor = await currentMember();
  if (!actor) return json({ error: "Sign in to your household first." }, 401);
  if (actor.role !== "owner") return json({ role: actor.role, name: actor.displayName });
  const members = await db.select({ id: householdMembers.id, name: householdMembers.displayName, email: householdMembers.email, role: householdMembers.role, active: householdMembers.isActive }).from(householdMembers).where(eq(householdMembers.householdId, actor.householdId)).orderBy(householdMembers.createdAt);
  const invitations = await db.select({ id: householdInvitations.id, email: householdInvitations.email, expiresAt: householdInvitations.expiresAt, acceptedAt: householdInvitations.acceptedAt, revokedAt: householdInvitations.revokedAt }).from(householdInvitations).where(eq(householdInvitations.householdId, actor.householdId)).orderBy(desc(householdInvitations.createdAt)).limit(50);
  return json({ role: actor.role, name: actor.displayName, members, invitations, now: Date.now() });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Request origin is not allowed." }, 403);
  const actor = await currentMember();
  if (!actor || actor.role !== "owner") return json({ error: "Only the household owner can manage access." }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: "Request is too large." }, 413);
    const body = JSON.parse(raw);
    const result = await db.transaction(async tx => {
      await tx.select({ id: householdMembers.id }).from(householdMembers).where(eq(householdMembers.id, actor.id)).for("update");
      if (body.action === "invite") {
        const email = invitationEmail(body.email);
        const members = await tx.select().from(householdMembers).where(eq(householdMembers.householdId, actor.householdId));
        const existing = members.find(m => m.email === email);
        if (existing) throw new AccessError(existing.isActive ? "This person already has access." : "This person already has a login. Restore their access in the list below.");
        if (members.length >= 50) throw new AccessError("This household has reached its 50-user limit.");
        const recent = await tx.select({ id: householdInvitations.id }).from(householdInvitations).where(and(eq(householdInvitations.householdId, actor.householdId), gt(householdInvitations.createdAt, new Date(Date.now() - 3600000))));
        if (recent.length >= 20) throw new AccessError("Please wait before creating more invitations. You can create 20 per hour.");
        const now = new Date();
        await tx.update(householdInvitations).set({ revokedAt: now }).where(and(eq(householdInvitations.householdId, actor.householdId), eq(householdInvitations.email, email), isNull(householdInvitations.acceptedAt), isNull(householdInvitations.revokedAt)));
        const token = invitationToken();
        const expiresAt = new Date(now.getTime() + 7 * 86400000);
        await tx.insert(householdInvitations).values({ householdId: actor.householdId, invitedBy: actor.id, email, tokenHash: invitationHash(token), expiresAt });
        return { token, email, expiresAt };
      }
      if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) throw new AccessError("Choose a valid user or invitation.");
      if (body.action === "revoke-invite") {
        await tx.update(householdInvitations).set({ revokedAt: new Date() }).where(and(eq(householdInvitations.id, body.id), eq(householdInvitations.householdId, actor.householdId), isNull(householdInvitations.acceptedAt)));
        return { ok: true };
      }
      if (body.action === "set-access" && typeof body.active === "boolean") {
        const [target] = await tx.select().from(householdMembers).where(and(eq(householdMembers.id, body.id), eq(householdMembers.householdId, actor.householdId))).for("update");
        if (!target || target.role === "owner" || target.id === actor.id) throw new AccessError("The owner’s access cannot be changed here.");
        await tx.update(householdMembers).set({ isActive: body.active, updatedAt: new Date() }).where(eq(householdMembers.id, target.id));
        if (!body.active && target.email) await tx.update(householdInvitations).set({ revokedAt: new Date() }).where(and(eq(householdInvitations.householdId, actor.householdId), eq(householdInvitations.email, target.email), isNull(householdInvitations.acceptedAt)));
        return { ok: true };
      }
      throw new AccessError("Choose a valid access action.");
    });
    return json(result);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Invalid request." }, 400);
    // Only explicitly authored validation messages are returned; database details stay private.
    const message = error instanceof AccessError ? error.message : "Access could not be updated. Please try again.";
    return json({ error: message }, 400);
  }
}
