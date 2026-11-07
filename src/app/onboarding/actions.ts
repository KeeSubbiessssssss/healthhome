"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";

import { householdMembers, households } from "@/db/schema";
import { currentUser } from "@/lib/household";
import { db } from "@/lib/db";
import { isHouseholdOwner, normalizeEmail } from "@/lib/access-policy";

export async function createHousehold() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  if (!isHouseholdOwner(user)) redirect("/onboarding");
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(793194084)`);
    const [existing] = await tx.select().from(householdMembers).where(eq(householdMembers.authUserId, user.id));
    if (existing) return;
    const [household] = await tx.insert(households).values({ name: "household-" + randomUUID() }).returning({ id: households.id });
    await tx.insert(householdMembers).values({ householdId: household.id, authUserId: user.id, displayName: user.name || "HealthHome owner", email: normalizeEmail(user.email), role: "owner" });
  });
  redirect("/app");
}
