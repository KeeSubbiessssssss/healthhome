import { eq } from "drizzle-orm";

import { householdMembers } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";

export async function currentUser() {
  const { data } = await auth.getSession();
  return data?.user ?? null;
}

export async function currentMember() {
  const user = await currentUser();
  if (!user) return null;
  const [member] = await db.select().from(householdMembers).where(eq(householdMembers.authUserId, user.id)).limit(1);
  return member ?? null;
}
