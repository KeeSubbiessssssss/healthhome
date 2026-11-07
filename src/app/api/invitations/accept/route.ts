import { and, eq } from "drizzle-orm";
import { householdInvitations, householdMembers } from "@/db/schema";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/household";
import { AccessError, checkInvitation, invitationHash, normalizeEmail } from "@/lib/access-policy";

export async function POST(request: Request) {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Request origin is not allowed." }, 403);
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in before joining." }, 401);
  try {
    const raw = await request.text();
    if (raw.length > 512) return reply({ error: "Invalid invitation." }, 400);
    const hash = invitationHash(JSON.parse(raw).token);
    await db.transaction(async tx => {
      const [found] = await tx.select().from(householdInvitations).where(eq(householdInvitations.tokenHash, hash));
      if (!found) throw new AccessError("This invitation is no longer available. Ask for a new link.");
      const [owner] = await tx.select().from(householdMembers).where(eq(householdMembers.id, found.invitedBy)).for("update");
      if (!owner?.isActive || owner.role !== "owner") throw new AccessError("This invitation is no longer available.");
      const [invite] = await tx.select().from(householdInvitations).where(eq(householdInvitations.id, found.id)).for("update");
      checkInvitation(invite, user);
      const [existing] = await tx.select().from(householdMembers).where(eq(householdMembers.authUserId, user.id)).for("update");
      if (existing && (!existing.isActive || existing.householdId !== invite.householdId)) throw new AccessError("Your account already belongs to a household or its access is disabled. Ask the owner to manage your access.");
      const members = await tx.select({ id: householdMembers.id }).from(householdMembers).where(eq(householdMembers.householdId, invite.householdId));
      if (!existing && members.length >= 50) throw new AccessError("This household has reached its user limit. Contact the owner.");
      if (!existing) await tx.insert(householdMembers).values({ householdId: invite.householdId, authUserId: user.id, displayName: user.name || user.email, email: normalizeEmail(user.email), role: "member" });
      await tx.update(householdInvitations).set({ acceptedAt: new Date() }).where(and(eq(householdInvitations.id, invite.id), eq(householdInvitations.tokenHash, hash)));
    });
    return reply({ ok: true });
  } catch (error) {
    const message = error instanceof AccessError ? error.message : "This invitation could not be accepted. Ask the owner for a new link.";
    return reply({ error: message }, 400);
  }
}
