export type Profile = { id: string; name: string; kind: "person" | "pet"; birthday: string; species: string; color: string };
export type Task = { id: string; text: string; done: boolean; assigneeId: string; due: string };
export type TaskList = { id: string; title: string; color: string; items: Task[] };
export type GiftProductLink = { label: string; url: string };
export type Gift = { id: string; recipientId: string; occasion: "birthday" | "christmas"; occasions?: ("birthday" | "christmas")[]; year: number; name: string; cost: number | null; productUrl?: string; productLinks?: GiftProductLink[]; status: "idea" | "requested" | "bought" | "wrapped"; notes: string };
export type DoseLog = { id: string; occurredAt: string; units: number; note: string; reversed: boolean; tracksStock?: boolean };
export type StockChange = { id: string; occurredAt: string; action: "consume" | "replenish" | "correct" | "repeat"; before: number; after: number; note: string };
export type Medication = { id: string; profileId: string; name: string; strength: string; instructions: string; doseTiming?: string; stockChanges?: StockChange[]; expiresOn?: string; unit: string; unitsLeft: number; unitsPerDose: number; dosesPerDay: number; refillAt: number; unitsPerRefill: number; repeats: number; logs: DoseLog[]; archived: boolean };
export type Fastener = { variant: number; offset: number; angle: number; size: number };
export type NotePlacement = { fastener?: Fastener; x: number; y: number; angle: number; z: number; attachment: "pin" | "tape" | "loose" };
export type BoardState = { schemaVersion: 1; profiles: Profile[]; lists: TaskList[]; gifts: Gift[]; medications: Medication[]; order: string[]; cardColors?: Record<string, string>; noteLayout?: Record<string, NotePlacement>; removedNotes?: string[] };
export const colors = ["butter", "sage", "rose", "blue", "cream", "peach", "mint", "lavender", "lilac", "coral", "lemon", "teal", "sand", "terracotta", "periwinkle"] as const;
export const emptyBoard = (): BoardState => ({ schemaVersion: 1, profiles: [], lists: [], gifts: [], medications: [], order: ["welcome", "medications", "gifts"] });
export const newId = () => crypto.randomUUID();
export const occasionsForGift = (gift: Gift) => gift.occasions ?? [gift.occasion];
export const linksForGift = (gift: Gift): GiftProductLink[] => gift.productLinks ?? (gift.productUrl ? [{ label: "View product", url: gift.productUrl }] : []);
export const giftIsBought = (gift: Gift) => gift.status === "bought" || gift.status === "wrapped";

export function productLink(value: string): string {
  const link = value.trim();
  if (!link) return "";
  try {
    const url = new URL(link);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new Error("Enter a product link starting with https:// or http://."); }
}

// The same validation protects browser backups and authenticated server saves.
export function parseBoard(value: unknown): BoardState {
  if (!value || typeof value !== "object") throw new Error("This board could not be read.");
  const board = value as BoardState;
  if (board.schemaVersion !== 1 || ![board.profiles, board.lists, board.gifts, board.medications, board.order].every(Array.isArray)) throw new Error("Unsupported board format.");
  const ids = new Set<string>();
  const text = (v: unknown, required = false) => typeof v === "string" && v.length <= 4000 && (!required || v.trim().length > 0);
  const id = (v: unknown) => { if (!text(v, true) || ids.has(v as string)) throw new Error("Invalid or duplicate record."); ids.add(v as string); };
  const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e9;
  const date = (v: unknown) => v === "" || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)));
  const check = (ok: boolean) => { if (!ok) throw new Error("Some board details are invalid. Check your entries and try again."); };
  check(board.profiles.length <= 100 && board.lists.length <= 100 && board.gifts.length <= 2000 && board.medications.length <= 500);
  for (const p of board.profiles) { id(p.id); check(text(p.name, true) && ["person", "pet"].includes(p.kind) && date(p.birthday) && text(p.species) && colors.includes(p.color as typeof colors[number])); }
  const profile = (v: unknown, optional = false) => (optional && v === "") || board.profiles.some(p => p.id === v);
  for (const list of board.lists) {
    id(list.id); check(text(list.title, true) && colors.includes(list.color as typeof colors[number]) && Array.isArray(list.items) && list.items.length <= 1000);
    for (const t of list.items) { id(t.id); check(text(t.text, true) && typeof t.done === "boolean" && profile(t.assigneeId, true) && date(t.due)); }
  }
  for (const gift of board.gifts) { id(gift.id); check(profile(gift.recipientId) && text(gift.name, true) && text(gift.notes) && (gift.productUrl === undefined || (text(gift.productUrl) && productLink(gift.productUrl) === gift.productUrl)) && (gift.productLinks === undefined || (Array.isArray(gift.productLinks) && gift.productLinks.length <= 20 && gift.productLinks.every(link => !!link && text(link.label) && link.label.length <= 200 && text(link.url, true) && productLink(link.url) === link.url))) && ["birthday", "christmas"].includes(gift.occasion) && ["idea", "requested", "bought", "wrapped"].includes(gift.status) && (gift.occasions === undefined || (Array.isArray(gift.occasions) && gift.occasions.length > 0 && gift.occasions.length <= 2 && new Set(gift.occasions).size === gift.occasions.length && gift.occasions.every(o => ["birthday", "christmas"].includes(o)) && gift.occasions.includes(gift.occasion))) && Number.isInteger(gift.year) && gift.year >= 2000 && gift.year <= 2200 && (gift.cost === null || number(gift.cost))); }
  for (const m of board.medications) {
    id(m.id); check(profile(m.profileId, true) && text(m.name, true) && text(m.strength) && text(m.instructions) && (m.doseTiming === undefined || text(m.doseTiming)) && (m.expiresOn === undefined || date(m.expiresOn)) && text(m.unit, true) && [m.unitsLeft, m.unitsPerDose, m.dosesPerDay, m.refillAt, m.unitsPerRefill, m.repeats].every(number) && Number.isInteger(m.repeats) && Number.isInteger(m.dosesPerDay) && typeof m.archived === "boolean" && Array.isArray(m.logs));
    if (m.stockChanges !== undefined) { check(Array.isArray(m.stockChanges) && m.stockChanges.length <= 2000); for (const change of m.stockChanges) { id(change.id); check(["consume", "replenish", "correct", "repeat"].includes(change.action) && number(change.before) && number(change.after) && text(change.note) && typeof change.occurredAt === "string" && !Number.isNaN(Date.parse(change.occurredAt))); } }
    for (const log of m.logs) { id(log.id); check(number(log.units) && log.units > 0 && typeof log.occurredAt === "string" && !Number.isNaN(Date.parse(log.occurredAt)) && text(log.note) && typeof log.reversed === "boolean" && (log.tracksStock === undefined || typeof log.tracksStock === "boolean")); }
  }
  const cards = new Set(["welcome", "medications", "gifts", ...board.lists.map(l => l.id)]);
  if (board.cardColors !== undefined) {
    check(!!board.cardColors && typeof board.cardColors === "object" && !Array.isArray(board.cardColors));
    check(Object.entries(board.cardColors).every(([id, color]) => cards.has(id) && colors.includes(color as typeof colors[number])));
  }
  if (board.noteLayout !== undefined) {
    check(!!board.noteLayout && typeof board.noteLayout === "object" && !Array.isArray(board.noteLayout));
    check(Object.entries(board.noteLayout).every(([id, p]) => cards.has(id) && !!p && typeof p === "object" && Number.isFinite(p.x) && p.x >= 0 && p.x <= 900 && Number.isFinite(p.y) && p.y >= 0 && p.y <= 5000 && Number.isFinite(p.angle) && Math.abs(p.angle) <= 25 && Number.isInteger(p.z) && p.z >= 0 && p.z <= 10000 && ["pin", "tape", "loose"].includes(p.attachment) && (p.fastener === undefined || (!!p.fastener && Number.isInteger(p.fastener.variant) && p.fastener.variant >= 0 && p.fastener.variant <= 4 && Number.isFinite(p.fastener.offset) && p.fastener.offset >= 15 && p.fastener.offset <= 85 && Number.isFinite(p.fastener.angle) && Math.abs(p.fastener.angle) <= 30 && Number.isFinite(p.fastener.size) && p.fastener.size >= 40 && p.fastener.size <= 110))));
  }
  if (board.removedNotes !== undefined) check(Array.isArray(board.removedNotes) && new Set(board.removedNotes).size === board.removedNotes.length && board.removedNotes.every(id => cards.has(id)));
  check(board.order.length === cards.size && new Set(board.order).size === cards.size && board.order.every(v => cards.has(v)));
  return board;
}

export function logDose(medication: Medication, units: number, occurredAt: string, note = "", tracksStock = true): Medication {
  if (!Number.isFinite(units) || units <= 0) throw new Error("Enter a dose greater than zero.");
  if (tracksStock && units > medication.unitsLeft) throw new Error("There isn’t enough medication left for that dose. Check the supply first.");
  if (Number.isNaN(Date.parse(occurredAt)) || Date.parse(occurredAt) > Date.now() + 60_000) throw new Error("Choose a dose time that isn’t in the future.");
  return { ...medication, unitsLeft: tracksStock ? Math.round((medication.unitsLeft - units) * 10000) / 10000 : medication.unitsLeft, logs: [...medication.logs, { id: newId(), units, occurredAt, note, reversed: false, tracksStock }] };
}
export function undoDose(medication: Medication, logId: string): Medication {
  const log = medication.logs.find(l => l.id === logId);
  if (!log || log.reversed) throw new Error("That dose has already been restored.");
  return { ...medication, unitsLeft: log.tracksStock === false ? medication.unitsLeft : Math.round((medication.unitsLeft + log.units) * 10000) / 10000, logs: medication.logs.map(l => l.id === logId ? { ...l, reversed: true } : l) };
}
// Strength is per supply unit, or an explicit concentration such as 10 mg / 5 mL.
// Ambiguous labels (ranges, multiple ingredients, percentages) stay uncalculated.
export function totalDailyDose(medication: Pick<Medication, "strength" | "unit" | "unitsPerDose" | "dosesPerDay">): { amount: number; unit: string } | null {
  const match = medication.strength.trim().match(/^(\d+(?:\.\d+)?)\s*(mcg|μg|µg|ug|mg|g|mL|ml|IU|units?|mmol|mEq)?(?:\s*\/\s*(\d+(?:\.\d+)?)?\s*(mL|ml|tablets?|capsules?|units?))?$/i);
  if (!match || !Number.isFinite(medication.unitsPerDose) || medication.unitsPerDose <= 0 || !Number.isFinite(medication.dosesPerDay) || medication.dosesPerDay <= 0) return null;
  const unit = (value: string) => value.toLowerCase().replace(/s$/, "");
  if (match[4] && unit(match[4]) !== unit(medication.unit.trim())) return null;
  const strength = Number(match[1]); const perUnits = match[4] ? Number(match[3] || 1) : 1;
  const amount = strength / perUnits * medication.unitsPerDose * medication.dosesPerDay;
  if (strength <= 0 || perUnits <= 0 || !Number.isFinite(amount) || amount > 1e9) return null;
  return { amount: Math.round(amount * 1e6) / 1e6, unit: match[2] || "" };
}
export function dailyDoseLabel(medication: Pick<Medication, "strength" | "unit" | "unitsPerDose" | "dosesPerDay">): string {
  if (medication.dosesPerDay === 0) return "As needed";
  const dose = totalDailyDose(medication);
  return dose ? `${dose.amount}${dose.unit ? ` ${dose.unit}` : ""} daily` : "Daily dose not set";
}
export function medicationSupplyStatus(medication: Pick<Medication, "unitsLeft" | "unitsPerDose" | "dosesPerDay" | "repeats" | "refillAt">) {
  const dailyUnits = medication.unitsPerDose * medication.dosesPerDay;
  const daysLeft = medication.unitsLeft === 0 ? 0 : dailyUnits > 0 ? medication.unitsLeft / dailyUnits : null;
  const kind = medication.repeats === 0 && daysLeft !== null && daysLeft <= 12
    ? "prescription" : medication.unitsLeft <= medication.refillAt ? "low" : null;
  return { kind, daysLeft };
}
export function adjustInventory(medication: Medication, action: StockChange["action"], amount: number, note = ""): Medication {
  if (!["consume", "replenish", "correct", "repeat"].includes(action)) throw new Error("Choose an inventory action.");
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e9 || (action !== "correct" && amount === 0)) throw new Error("Enter a valid inventory quantity.");
  if (action === "repeat" && medication.repeats < 1) throw new Error("There are no repeats remaining.");
  const after = Math.round((action === "correct" ? amount : medication.unitsLeft + (action === "consume" ? -amount : amount)) * 10000) / 10000;
  if (after < 0 || after > 1e9) throw new Error("That change would leave an invalid stock balance. Check the quantity.");
  if ((medication.stockChanges?.length || 0) >= 2000) throw new Error("Inventory history is full.");
  return { ...medication, unitsLeft: after, repeats: medication.repeats - (action === "repeat" ? 1 : 0), stockChanges: [...(medication.stockChanges || []), { id: newId(), occurredAt: new Date().toISOString(), action, before: medication.unitsLeft, after, note }] };
}
export function fillRepeat(medication: Medication, note = "Prescription repeat filled"): Medication {
  if (medication.repeats <= 0 || medication.unitsPerRefill <= 0) throw new Error("Add a repeat and a refill quantity before filling it.");
  return adjustInventory(medication, "repeat", medication.unitsPerRefill, note);
}
export function moveCard(order: string[], from: string, to: string) {
  if (from === to || !order.includes(from) || !order.includes(to)) return order;
  const next = order.filter(id => id !== from); next.splice(order.indexOf(to), 0, from); return next;
}

export function defaultPlacement(index: number): NotePlacement {
  const column = index % 3;
  return { x: [55, 425, 795][column], y: Math.min(4800, 60 + Math.floor(index / 3) * 480 + [15, 125, 0][column]), angle: [-3, 2.5, -1.8][column], z: index + 1, attachment: index % 2 ? "tape" : "pin" };
}
export function constrainPlacement(p: NotePlacement): NotePlacement {
  return { ...p, x: Math.max(0, Math.min(900, p.x)), y: Math.max(0, Math.min(5000, p.y)), angle: Math.max(-25, Math.min(25, p.angle)), z: Math.max(0, Math.min(10000, Math.round(p.z))) };
}

export function fastenerAppearance(p: NotePlacement): Fastener {
  return p.fastener || { variant: p.z % 5, offset: 30 + (p.z * 17) % 40, angle: -13 + (p.z * 11) % 27, size: 64 + (p.z * 7) % 25 };
}
export function replaceFastener(p: NotePlacement, random = Math.random): NotePlacement {
  const round = (n: number) => Math.round(n * 100) / 100;
  return { ...p, attachment: random() < .5 ? "pin" : "tape", fastener: { variant: Math.floor(random() * 5), offset: round(22 + random() * 56), angle: round(-23 + random() * 46), size: round(56 + random() * 32) } };
}
