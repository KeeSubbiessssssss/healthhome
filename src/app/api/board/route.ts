import { and, eq, inArray } from "drizzle-orm";
import { familyBoards, householdMembers, medications, medicationDoseLogs, prescriptions } from "@/db/schema";
import { db } from "@/lib/db";
import { currentMember } from "@/lib/household";
import { emptyBoard, parseBoard } from "@/lib/board";

export async function GET() {
  const member = await currentMember();
  if (!member) return Response.json({ error: "Sign in and set up your household first." }, { status: 401 });
  try {
    const [saved] = await db.select().from(familyBoards).where(eq(familyBoards.householdId, member.householdId));
    if (saved) return Response.json({ state: parseBoard(saved.state), version: saved.version });
    // Existing prescriptions are carried into the new workspace on first save.
    const state = emptyBoard();
    const members = await db.select().from(householdMembers).where(eq(householdMembers.householdId, member.householdId));
    state.profiles = members.map(m => ({ id: m.id, name: m.displayName, kind: "person", birthday: "", species: "", color: "sage" }));
    const scripts = await db.select({ prescription: prescriptions, medication: medications }).from(prescriptions).innerJoin(medications, eq(medications.id, prescriptions.medicationId)).where(and(eq(medications.householdId, member.householdId), eq(prescriptions.isActive, true)));
    const logs = scripts.length ? await db.select().from(medicationDoseLogs).where(inArray(medicationDoseLogs.prescriptionId, scripts.map(s => s.prescription.id))) : [];
    state.medications = scripts.map(({ prescription: p, medication: m }) => ({ id: p.id, profileId: state.profiles.some(person => person.id === p.householdMemberId) ? p.householdMemberId! : "", name: m.name, strength: m.strengthLabel ?? "", instructions: p.instructions ?? p.frequency ?? "", expiresOn: p.scriptExpiresOn ?? "", unit: p.doseUnit || "units", unitsLeft: Number(p.unitsLeft ?? 0), unitsPerDose: Number(p.unitsPerDose ?? 0), dosesPerDay: p.dosesPerDay ?? 0, refillAt: Number(p.refillAtUnitsLeft ?? 0), unitsPerRefill: Number(p.totalUnitsPerScript ?? 0), repeats: p.repeatsRemaining ?? 0, archived: false, logs: logs.filter(l => l.prescriptionId === p.id).map(l => ({ id: l.id, units: Number(l.unitsConsumed), occurredAt: l.occurredAt.toISOString(), note: "Imported medication log", reversed: false })) }));
    return Response.json({ state: parseBoard(state), version: 0 });
  } catch {
    return Response.json({ error: "The family board could not load. Check the connection and that the latest migration has been applied." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  const member = await currentMember();
  if (!member) return Response.json({ error: "Sign in and set up your household first." }, { status: 401 });
  let state; let version;
  try {
    const raw = await request.text();
    if (raw.length > 512_000) return Response.json({ error: "This board is too large to save." }, { status: 413 });
    const body = JSON.parse(raw); state = parseBoard(body.state); version = body.version;
    if (!Number.isInteger(version) || version < 0) throw new Error("Invalid board version.");
  } catch { return Response.json({ error: "The board contains invalid details." }, { status: 400 }); }
  try {
    const saved = version === 0
      ? await db.insert(familyBoards).values({ householdId: member.householdId, state, version: 1 }).onConflictDoNothing().returning({ version: familyBoards.version })
      : await db.update(familyBoards).set({ state, version: version + 1, updatedAt: new Date() }).where(and(eq(familyBoards.householdId, member.householdId), eq(familyBoards.version, version))).returning({ version: familyBoards.version });
    if (!saved.length) return Response.json({ error: "This board changed in another window. Reload before making more changes." }, { status: 409 });
    return Response.json({ version: saved[0].version });
  } catch { return Response.json({ error: "Your changes could not be saved. Check the connection and try again." }, { status: 503 }); }
}
