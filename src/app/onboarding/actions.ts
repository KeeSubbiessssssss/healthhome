"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { householdMembers, households } from "@/db/schema";
import { currentUser } from "@/lib/household";
import { db } from "@/lib/db";

export async function createHousehold() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  await db.transaction(async (tx) => {
    const [household] = await tx.insert(households).values({ name: "household-" + randomUUID() }).returning({ id: households.id });
    await tx.insert(householdMembers).values({ householdId: household.id, authUserId: user.id, displayName: user.name || "HealthHome owner", role: "owner" });
  });
  redirect("/app");
}
