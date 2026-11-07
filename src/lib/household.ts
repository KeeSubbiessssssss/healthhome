import { and, eq } from "drizzle-orm";

import { householdMembers } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/access-policy";

export async function currentUser() {
  const { data } = await auth.getSession();
  return data?.user ?? null;
}

export async function currentMember() {
  const user = await currentUser();
  if (!user?.emailVerified) return null;
  const [member] = await db.select().from(householdMembers).where(and(eq(householdMembers.authUserId, user.id), eq(householdMembers.isActive, true))).limit(1);
  return member ? { ...member, email: member.email || normalizeEmail(user.email) } : null;
}
