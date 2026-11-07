import type { BoardState, DropPick, Profile, SchoolJourney, SchoolTrip } from "./board";

export const schoolName = (profile: Profile) => profile.name.trim().toLowerCase() === "esme" ? "Ezzie" : profile.name;
export const schoolChildren = (board: BoardState) => {
  const selected = board.schoolTravel?.profileIds ?? board.profiles.filter(p => p.kind === "person" && ["ace", "rhythm", "esme", "ezzie"].includes(p.name.trim().toLowerCase())).map(p => p.id);
  const rank = (profile: Profile) => ({ace:0,rhythm:1,esme:2,ezzie:2}[profile.name.trim().toLowerCase()] ?? 3);
  return selected.map(id => board.profiles.find(p => p.id === id)).filter((p): p is Profile => !!p && p.kind === "person").sort((a,b) => rank(a)-rank(b));
};
export function schoolJourney(entry: DropPick): SchoolJourney | undefined {
  const note = entry.note.toLowerCase();
  const pickup = /pick[\s-]*up|collect|\bhome\b/.test(note);
  const morning = /drop[\s-]*off|to school|\bmorning\b/.test(note);
  return pickup === morning ? undefined : pickup ? "pickup" : "to-school";
}
export const schoolBy = (trip: SchoolTrip, profiles: Profile[]) => trip.transport === "bus" ? "Bus" : trip.byProfileId ? profiles.find(p => p.id === trip.byProfileId)?.name || "Unknown" : "Not set";
export const schoolChoice = (trip: SchoolTrip) => trip.transport === "bus" ? "bus" : trip.byProfileId ? `person:${trip.byProfileId}` : "";
export const schoolTripFromChoice = (choice: string, detail = ""): SchoolTrip => ({ byProfileId: choice.startsWith("person:") ? choice.slice(7) : "", ...(choice === "bus" ? { transport: "bus" as const } : {}), detail: detail.trim() });
const members = (entry: DropPick) => entry.profileIds ?? [entry.profileId];
export function schoolTrip(board: BoardState, profileId: string, weekday: number, journey: SchoolJourney, date?: string) {
  const dated = date ? board.schoolTravelOverrides?.find(item => item.profileId === profileId && item.journey === journey && item.date === date) : undefined;
  if (dated && !dated.useWeekly) return { trip: dated.trip ?? { byProfileId: "" }, changed: true, skipped: dated.trip === null, conflict: false };
  const saved = board.schoolTravel?.days.find(day => day.profileId === profileId && day.weekday === weekday);
  const earlier = (board.dropPick || []).filter(entry => members(entry).includes(profileId) && entry.weekdays.includes(weekday) && schoolJourney(entry) === journey);
  if (earlier.length === 1) {
    const override = date ? board.dropPickOverrides?.find(item => item.entryId === earlier[0].id && item.date === date) : undefined;
    if (override && !dated?.useWeekly) {
      const entry = override.replacement;
      return { trip: entry ? { byProfileId: entry.byProfileId, transport: entry.transport, detail: entry.note } : { byProfileId: "" }, changed: true, skipped: entry === null || !members(entry).includes(profileId), conflict: false };
    }
  }
  if (saved) return { trip: saved[journey === "to-school" ? "toSchool" : "pickup"], changed: false, skipped: false, conflict: false };
  const entry = earlier.length === 1 ? earlier[0] : undefined;
  return { trip: entry ? { byProfileId: entry.byProfileId, transport: entry.transport, detail: entry.note } : { byProfileId: "" }, changed: false, skipped: false, conflict: earlier.length > 1 };
}
export function saveSchoolDay(board: BoardState, profileIds: string[], weekday: number, trips: {profileId: string; toSchool: SchoolTrip; pickup: SchoolTrip}[], allWeek = false) {
  const plan = board.schoolTravel ?? { profileIds, days: [] };
  plan.profileIds = profileIds;
  for (const day of allWeek ? [0,1,2,3,4] : [weekday]) for (const trip of trips) {
    plan.days = plan.days.filter(item => item.weekday !== day || item.profileId !== trip.profileId);
    plan.days.push({ ...trip, weekday: day });
  }
  board.schoolTravel = plan;
}
export function setSchoolDayOverride(board: BoardState, profileId: string, journey: SchoolJourney, date: string, trip: SchoolTrip | null) {
  const matches = (item: {profileId:string;journey:SchoolJourney;date:string}) => item.profileId === profileId && item.journey === journey && item.date === date;
  const existing = board.schoolTravelOverrides?.find(matches);
  board.schoolTravelOverrides = [...(board.schoolTravelOverrides || []).filter(item => !matches(item)), { id: existing?.id || crypto.randomUUID(), profileId, journey, date, trip }];
}
export function restoreSchoolDay(board: BoardState, profileId: string, journey: SchoolJourney, date: string) {
  board.schoolTravelOverrides = board.schoolTravelOverrides?.filter(item => item.profileId !== profileId || item.journey !== journey || item.date !== date);
  // Older exceptions can cover siblings. Keep their other passengers intact.
  for (const source of board.dropPick || []) {
    if (schoolJourney(source) !== journey || !members(source).includes(profileId)) continue;
    const index = board.dropPickOverrides?.findIndex(item => item.entryId === source.id && item.date === date) ?? -1;
    if (index < 0 || !board.dropPickOverrides) continue;
    const passengers = members(source);
    if (passengers.length === 1) board.dropPickOverrides.splice(index, 1);
    else {
      // Give this child an explicit dated copy of the current weekly arrangement.
      const weekday = (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7;
      const weekly = schoolTrip({ ...board, dropPickOverrides: [], schoolTravelOverrides: [] }, profileId, weekday, journey).trip;
      setSchoolDayOverride(board, profileId, journey, date, weekly);
      const restored = board.schoolTravelOverrides?.find(item => item.profileId === profileId && item.journey === journey && item.date === date);
      if (restored) restored.useWeekly = true;
    }
  }
}
