"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { dropPickProfileIds, colors, emptyBoard, adjustInventory, dailyDoseLabel, medicationSupplyStatus, medicationRegimens, medicationHasProfile, medicationBackground, fillRepeat, logDose, newId, defaultPlacement, constrainPlacement, type NotePlacement, parseBoard, productLink, linksForGift, occasionsForGift, giftIsBought, undoDose, type BoardState, type Gift, type Medication, type Profile, type TaskList, type SummaryKind, summaryPreferences, setSummaryPreferences } from "@/lib/board";
import s from "./family-board.module.css";
import { FreeNote } from "./free-note";
import { BoardCanvas } from "./board-canvas";
import { InventoryFields, MedicationScheduleFields, DoseRecipientFields } from "./medication-fields";
import { TodayDropPick } from "./today-drop-pick";
import { WeeklySchedule } from "./schedule";
import { SummaryOptionsEditor, SummaryNoteContent } from "./summary-notes";
import { HouseholdAccess } from "./household-access";

type View = "board" | "lists" | "medications" | "gifts" | "settings" | "schedule";
type Editor = { type: "profile" | "list" | "gift" | "medication" | "dose" | "task" | "inventory" | "summary"; id?: string; listId?: string; kind?: "person" | "pet" };
type IconName = "board" | "list" | "pill" | "gift" | "settings" | "plus" | "arrow" | "paw" | "person" | "close" | "grip" | "up" | "down" | "check" | "edit" | "trash" | "palette" | "calendar";
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 17h3"/></>,
    palette: <><path d="M12 3a9 9 0 1 0 0 18h1a3 3 0 0 0 0-6h-1a1 1 0 0 1 0-2h3a6 6 0 0 0 0-12Z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="6" r="1"/><circle cx="15" cy="7" r="1"/></>,
    board: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M9 10h12"/></>,
    list: <><path d="m3 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2M10 6h11M10 12h11M10 18h8"/></>,
    pill: <><path d="m9 15 6-6m-9 9a5 5 0 0 1 0-7l5-5a5 5 0 0 1 7 7l-5 5a5 5 0 0 1-7 0Z"/></>,
    gift: <><path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14"/><path d="M12 7H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z"/></>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="8" cy="18" r="2" fill="currentColor"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    paw: <><ellipse cx="12" cy="16" rx="5" ry="4"/><ellipse cx="5" cy="9" rx="2" ry="3"/><ellipse cx="10" cy="5" rx="2" ry="3"/><ellipse cx="16" cy="6" rx="2" ry="3"/><ellipse cx="20" cy="11" rx="2" ry="3"/></>,
    person: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>, close: <path d="m6 6 12 12M6 18 18 6"/>,
    grip: <><path d="M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01" strokeWidth="4"/></>,
    up: <path d="m6 14 6-6 6 6"/>, down: <path d="m6 10 6 6 6-6"/>, check: <path d="m5 12 4 4L19 6"/>,
    edit: <><path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z"/></>, trash: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
const views: { id: View; label: string; icon: IconName }[] = [{ id: "board", label: "Pinboard", icon: "board" }, { id: "lists", label: "Lists & tasks", icon: "list" }, { id: "schedule", label: "Weekly schedule", icon: "calendar" }, { id: "medications", label: "Medication", icon: "pill" }, { id: "gifts", label: "Presents", icon: "gift" }, { id: "settings", label: "Settings", icon: "settings" }];
const money = (v: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(v);
const day = (v: string) => new Date(v + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" });
const localDateTime = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

// Do not animate snapshots of the page: the live paper is the only moving element.
function updateSurface(change: () => void) { change(); return Promise.resolve(); }

function ColorPicker({ value }: { value: string }) {
  return <fieldset className={s.colorPicker}><legend>Paper colour</legend><div>{colors.map(color => <label key={color} className={s.colorOption}><input type="radio" name="color" value={color} defaultChecked={color === value}/><span className={`${s.colorChip} ${s[color]}`} aria-hidden="true"/><span>{color[0].toUpperCase() + color.slice(1)}</span></label>)}</div></fieldset>;
}

function GiftLinksEditor({ gift }: { gift?: Gift }) {
  const [rows, setRows] = useState(() => {
    const links = gift ? linksForGift(gift) : [];
    return (links.length ? links : [{ label: "", url: "" }]).map(link => ({ ...link, id: newId() }));
  });
  return <fieldset className={s.giftLinkEditor}><legend>Product links (optional)</legend>
    <div className={s.giftLinkRows}>{rows.map((row, index) => <div key={row.id} className={s.giftLinkRow}>
      <label className={s.field}>Label<input name="productLinkLabel" defaultValue={row.label} placeholder="Shop or option" maxLength={200} aria-label={`Label for product link ${index + 1}`}/></label>
      <label className={s.field}>Link<input name="productLinkUrl" type="url" defaultValue={row.url} placeholder="https://shop.com/product" maxLength={4000} aria-label={`Product link ${index + 1}`}/></label>
      <button type="button" className={s.iconButton} aria-label={`Remove product link ${index + 1}`} onClick={() => setRows(current => current.filter(link => link.id !== row.id))}><Icon name="close" size={17}/></button>
    </div>)}</div>
    <button type="button" className={s.textButton} disabled={rows.length >= 20} onClick={() => setRows(current => [...current, { id: newId(), label: "", url: "" }])}><Icon name="plus" size={16}/>Add another link</button>
  </fieldset>;
}

export function FamilyBoard() {
  const [state, setState] = useState<BoardState>(emptyBoard);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("board");
  const [scheduleEditId, setScheduleEditId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recipient, setRecipient] = useState("");
  const [occasion, setOccasion] = useState("all");
  const editorRef = useRef<HTMLElement>(null);
  const mobileMenu = useRef<HTMLDialogElement>(null);
  const saving = useRef(false);
  const [historyId, setHistoryId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const initial = new URLSearchParams(window.location.search).get("view");
        if (views.some(v => v.id === initial)) setView(initial as View);
        const response = await fetch("/api/board", { cache: "no-store" }); const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "The board could not load.");
        if (active) { setState(parseBoard(payload.state)); setVersion(payload.version); }
        if (active) setReady(true);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "The board could not load. Reload to try again."); }
    }
    void load();
    return () => { active = false; };
  }, []);
  useEffect(() => { if (editor) { editorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); editorRef.current?.querySelector<HTMLInputElement>("input")?.focus(); } }, [editor]);

  async function commit(change: (draft: BoardState) => void, message = "Saved.") {
    if (!ready || saving.current) return false;
    saving.current = true; setBusy(true); setError("");
    try {
      const next = structuredClone(state); change(next); parseBoard(next);
      const response = await fetch("/api/board", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: next, version }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Could not save. Please try again."); setVersion(payload.version);
      await updateSurface(() => { setState(next); setNotice(message); }); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save. Check your connection and try again."); return false; }
    finally { saving.current = false; setBusy(false); }
  }
  function navigate(next: View, profileId = "", nextEditor: Editor | null = null, activityId: string | null = null) { void updateSurface(() => { setView(next); setScheduleEditId(activityId); setEditor(nextEditor); if (ready) setError(""); setRecipient(profileId); }); if (!nextEditor) requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })); }
  const open = (next: Editor) => { setEditor(next); setError(""); };
  const profileName = (id: string) => state.profiles.find(p => p.id === id)?.name || "Unassigned";
  const people = state.profiles.filter(p => p.kind === "person");
  const pets = state.profiles.filter(p => p.kind === "pet");
  const activeMeds = state.medications.filter(m => !m.archived);
  const tasks = state.lists.flatMap(l => l.items);
  const activeTasks = tasks.filter(t => !t.done);

  function field(name: string, label: string, options: { value?: string | number; type?: string; required?: boolean; min?: number; step?: string; placeholder?: string; max?: string } = {}) {
    return <label className={s.field}>{label}<input name={name} type={options.type || "text"} defaultValue={options.value ?? ""} required={options.required} min={options.min} max={options.max} step={options.step} placeholder={options.placeholder} maxLength={options.type === "number" ? undefined : 500}/></label>;
  }
  function profileSelect(value = "", optional = false, peopleOnly = false) {
    return <label className={`${s.field} ${peopleOnly ? s.giftRecipient : ""}`}>For<select name="profileId" defaultValue={value} required={!optional}><option value="">{optional ? "Anyone" : (peopleOnly ? "Choose a family member" : "Choose a family member or pet")}</option>{(peopleOnly ? people : state.profiles).map(p => <option key={p.id} value={p.id}>{p.name}{p.kind === "pet" ? ` · ${p.species || "Pet"}` : ""}</option>)}</select></label>;
  }
  async function saveEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editor) return;
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) || "").trim();
    const num = (name: string) => Number(text(name) || 0);
    const ok = await commit(draft => {
      if (editor.type === "profile") {
        const value: Profile = { id: editor.id || newId(), name: text("name"), kind: text("kind") as Profile["kind"], birthday: text("birthday"), species: text("species"), color: text("color") };
        const index = draft.profiles.findIndex(p => p.id === value.id); if (index < 0) draft.profiles.push(value); else draft.profiles[index] = value;
      } else if (editor.type === "list") {
        if (editor.id) { const list = draft.lists.find(l => l.id === editor.id)!; list.title = text("title"); list.color = text("color"); }
        else { const id = newId(); draft.lists.push({ id, title: text("title"), color: text("color"), items: [] }); draft.order.push(id); }
      } else if (editor.type === "task") {
        const list = draft.lists.find(l => l.id === editor.listId)!; const task = list.items.find(t => t.id === editor.id)!;
        Object.assign(task, { text: text("text"), assigneeId: text("profileId"), due: text("due") });
      } else if (editor.type === "gift") {
        const occasions = data.getAll("occasion") as Gift["occasion"][];
        if (!occasions.length) throw new Error("Choose Christmas, Birthday, or both for this present.");
        if (!draft.profiles.some(p => p.id === text("profileId") && p.kind === "person")) throw new Error("Choose a family member for this present.");
        const labels = data.getAll("productLinkLabel").map(value => String(value).trim());
        const urls = data.getAll("productLinkUrl").map(value => String(value).trim());
        const productLinks = urls.map((url, index) => ({ label: labels[index] || "", url: productLink(url) })).filter(link => link.url || link.label);
        if (productLinks.some(link => !link.url)) throw new Error("Add a URL for each labelled product link, or remove the empty row.");
        const existing = draft.gifts.find(g => g.id === editor.id);
        const value: Gift = { id: editor.id || newId(), recipientId: text("profileId"), occasion: occasions[0], occasions, year: existing?.year ?? new Date().getFullYear(), name: text("name"), cost: text("cost") ? num("cost") : null, productLinks, status: text("status") as Gift["status"], notes: text("notes") };
        const index = draft.gifts.findIndex(g => g.id === value.id); if (index < 0) draft.gifts.push(value); else draft.gifts[index] = value;
      } else if (editor.type === "medication") {
        const old = draft.medications.find(m => m.id === editor.id);
        const assigned = data.getAll("regimenProfileId").map(String);
        const values = (name: string) => data.getAll(name).map(v => String(v).trim());
        const units = values("regimenUnits"), frequency = values("regimenFrequency"), timing = values("regimenTiming"), instructions = values("regimenInstructions");
        const regimens = assigned.map((profileId, index) => ({ profileId, unitsPerDose: Number(units[index]), dosesPerDay: Number(frequency[index]), doseTiming: timing[index] || "", instructions: instructions[index] || "" }));
        if (!regimens.length) throw new Error("Assign at least one family member or pet.");
        const primary = regimens[0];
        const value: Medication = { id: editor.id || newId(), profileId: primary.profileId, regimens, name: text("name"), strength: text("strength"), instructions: primary.instructions, expiresOn: text("expiresOn"), unit: text("unit"), doseTiming: primary.doseTiming, stockChanges: old?.stockChanges || [], unitsLeft: old?.unitsLeft ?? 0, unitsPerDose: primary.unitsPerDose, dosesPerDay: primary.dosesPerDay, refillAt: old?.refillAt ?? 5, unitsPerRefill: old?.unitsPerRefill ?? 0, repeats: old?.repeats ?? 0, logs: old?.logs || [], archived: false };
        const index = draft.medications.findIndex(m => m.id === value.id); if (index < 0) draft.medications.push(value); else draft.medications[index] = value;
      } else if (editor.type === "inventory") {
        const index = draft.medications.findIndex(m => m.id === editor.id);
        const med = { ...draft.medications[index], refillAt: num("refillAt"), unitsPerRefill: num("unitsPerRefill"), repeats: num("repeats") };
        const action = text("stockAction");
        draft.medications[index] = action === "none" ? med : action === "repeat" ? fillRepeat(med, text("stockNote")) : adjustInventory(med, action as "consume" | "replenish" | "correct", num("stockAmount"), text("stockNote"));
      } else if (editor.type === "dose") {
        const index = draft.medications.findIndex(m => m.id === editor.id);
        draft.medications[index] = logDose(draft.medications[index], num("units"), new Date(text("occurredAt")).toISOString(), text("note"), data.has("tracksStock"), text("doseProfileId"));
      }
    });
    if (ok) setEditor(null);
  }
  function colorSelect(value = "butter") { return <ColorPicker value={value}/>; }
  function renderEditor() {
    if (!editor) return null;
    if (editor.type === "summary") return <section ref={editorRef} className={s.editor}><SummaryOptionsEditor state={state} busy={busy} commit={commit} onClose={() => setEditor(null)}/></section>;
    const p = state.profiles.find(p => p.id === editor.id);
    const list = state.lists.find(l => l.id === editor.id);
    const task = state.lists.find(l => l.id === editor.listId)?.items.find(t => t.id === editor.id);
    const gift = state.gifts.find(g => g.id === editor.id);
    const med = state.medications.find(m => m.id === editor.id);
    const titles = { profile: p ? `Edit ${p.name}` : editor.kind === "pet" ? "Add a pet" : "Add a family member", list: list ? "Edit list" : "Pin a new list", task: "Edit task", gift: gift ? "Edit present" : "Keep a gift idea", medication: med ? "Edit medication" : "Add medication", inventory: `Inventory · ${med?.name}`, dose: `Log a dose · ${med?.name}` };
    return <section ref={editorRef} className={s.editor} aria-labelledby="editor-title"><header><h2 id="editor-title">{titles[editor.type]}</h2><button className={s.iconButton} onClick={() => setEditor(null)} aria-label="Close editor"><Icon name="close"/></button></header>
      <form key={JSON.stringify(editor)} onSubmit={saveEditor}><fieldset disabled={busy || !ready} className={s.formFields}>
        {editor.type === "profile" && <>{field("name", "Name", { value: p?.name, required: true, placeholder: "What should we call them?" })}<label className={s.field}>Profile type<select name="kind" defaultValue={p?.kind || editor.kind || "person"}><option value="person">Family member</option><option value="pet">Pet</option></select></label>{field("birthday", "Birthday (optional)", { type: "date", value: p?.birthday })}{field("species", "Pet type (optional)", { value: p?.species, placeholder: "e.g. dog, cat, rabbit" })}{colorSelect(p?.color || "sage")}</>}
        {editor.type === "list" && <>{field("title", "List name", { value: list?.title, required: true, placeholder: "Weekend jobs, shopping, a little project…" })}{colorSelect(list?.color)}</>}
        {editor.type === "task" && <>{field("text", "Task", { value: task?.text, required: true })}{profileSelect(task?.assigneeId, true)}{field("due", "Due date (optional)", { type: "date", value: task?.due })}</>}
        {editor.type === "gift" && <>{field("name", "Present or idea", { value: gift?.name, required: true, placeholder: "Something they’d love" })}{profileSelect(gift?.recipientId || recipient, false, true)}<fieldset className={s.occasionChoices}><legend>Occasion</legend>{(["christmas", "birthday"] as const).map(o => <label key={o}><input type="checkbox" name="occasion" value={o} defaultChecked={gift ? occasionsForGift(gift).includes(o) : o === (occasion === "birthday" ? "birthday" : "christmas")}/>{o === "christmas" ? "Christmas" : "Birthday"}</label>)}</fieldset>{field("cost", "Price ($ AUD, optional)", { type: "number", value: gift?.cost ?? "", min: 0, step: "0.01" })}<label className={s.field}>Progress<select name="status" defaultValue={gift?.status || "idea"}><option value="idea">Idea</option><option value="requested">Requested</option><option value="bought">Bought</option><option value="wrapped">Wrapped & ready</option></select></label><GiftLinksEditor key={gift?.id || "new-present"} gift={gift}/><label className={s.field}>Notes<textarea name="notes" defaultValue={gift?.notes} placeholder="Size, colour, shop, or a hint they dropped…" maxLength={4000}/></label></>}
        {editor.type === "medication" && <>{field("name", "Medication name", { value: med?.name, required: true })}<MedicationScheduleFields key={med?.id || "new-medication"} medication={med} profiles={state.profiles}/>{field("expiresOn", "Prescription expiry (optional)", { type: "date", value: med?.expiresOn })}<p className={s.formHelp}>Stock is managed separately using “Manage inventory” after saving this medication.</p></>}
        {editor.type === "inventory" && med && <InventoryFields key={med.id} medication={med}/>}
        {editor.type === "dose" && med && <><p className={s.formHelp}>Record a dose that has been given.</p><DoseRecipientFields key={med.id} medication={med} profiles={state.profiles}/>{field("occurredAt", "Date & time given", { type: "datetime-local", value: localDateTime(), required: true, max: localDateTime() })}{field("note", "Note (optional)", { placeholder: "e.g. given with breakfast" })}<label className={s.stockCheckbox}><input type="checkbox" name="tracksStock" defaultChecked/>Deduct this dose from inventory</label></>}
        <div className={s.formActions}><button type="submit" className={s.primary}>{busy ? "Saving…" : editor.type === "dose" ? "Save dose log" : "Save"}</button><button type="button" className={s.textButton} onClick={() => setEditor(null)}>Cancel</button>{editor.type === "task" && <button type="button" className={s.textButton} onClick={() => void commit(d => { const l = d.lists.find(l => l.id === editor.listId)!; l.items = l.items.filter(t => t.id !== editor.id); }, "Task removed.").then(ok => { if (ok) setEditor(null); })}>Remove task</button>}</div>
      </fieldset></form></section>;
  }
  function notePlacement(id: string) { return state.noteLayout?.[id] || (id === "drop-pick" ? { x: 60, y: 65, angle: 1.2, z: Math.min(10000, state.order.length + 1), attachment: "pin" as const } : id === "schedule" ? { ...defaultPlacement(state.order.includes(id) ? state.order.indexOf(id) : state.order.length), x: 60, width: 600, height: 300 } : defaultPlacement(state.order.includes(id) ? state.order.indexOf(id) : state.order.length)); }
  function changePlacement(id: string, placement: NotePlacement) {
    return commit(d => { if (id === "drop-pick" && !d.order.includes(id)) d.order.push(id); d.noteLayout = { ...d.noteLayout, [id]: constrainPlacement(placement) }; }, "Paper placed.");
  }
  function cardTools(id: string, color: string) {
    return <details className={s.paletteMenu}><summary aria-label="Change card colour" title="Change card colour"><Icon name="palette" size={17}/></summary><div className={s.cardPalette}><strong>Paper colour</strong><div>{colors.map(c => <button key={c} type="button" className={`${s.paletteSwatch} ${s[c]}`} aria-label={c[0].toUpperCase() + c.slice(1)} aria-pressed={color === c} title={c[0].toUpperCase() + c.slice(1)} disabled={busy} onClick={event => { const menu = event.currentTarget.closest("details"); void commit(d => { if (id === "drop-pick" && !d.order.includes(id)) d.order.push(id); const list = d.lists.find(l => l.id === id); if (list) list.color = c; else d.cardColors = { ...d.cardColors, [id]: c }; }, "Colour saved.").then(ok => { if (ok && menu) menu.open = false; }); }}>{color === c && <Icon name="check" size={15}/>}</button>)}</div></div></details>;
  }
  function paper(id: string, color: string, content: ReactNode) {
    const paperColor = state.cardColors?.[id] || color;
    const list = state.lists.find(list => list.id === id);
    const heading = list?.title || ({ welcome: "Life’s little things, in one place.", medications: "Medication", gifts: "Presents", schedule: "Our week, on paper.", "tasks-summary": "Lists & tasks", "drop-pick": "Today’s Drop/Pick" } as Record<string, string>)[id];
    if (view === "board") {
      const front = Math.min(10000, Math.max(state.order.length + 1, ...Object.values(state.noteLayout || {}).map(p => p.z)) + 1);
      return <FreeNote key={id} id={id} heading={heading} color={paperColor} placement={notePlacement(id)} front={front} disabled={busy} resizable={id === "schedule"} palette={<>{list && <button className={s.iconButton} aria-label={`Edit ${list.title}`} onClick={() => open({ type: "list", id: list.id })}><Icon name="edit" size={16}/></button>}{cardTools(id, paperColor)}</>} onChange={p => changePlacement(id, p)}>{content}</FreeNote>;
    }
    return <article key={id} className={`${s.paper} ${s[paperColor]}`}><div className={s.cardTools}>{cardTools(id, paperColor)}</div>{content}</article>;
  }
  function renderList(list: TaskList) {
    return paper(list.id, list.color, <><div className={s.noteTitle}><h2>{list.title}</h2><button className={s.iconButton} onClick={() => open({ type: "list", id: list.id })} aria-label={`Edit ${list.title}`}><Icon name="edit" size={16}/></button></div><p className={s.noteMeta}>{list.items.filter(t => t.done).length} of {list.items.length} done</p><ul className={s.taskList}>{list.items.map(t => <li key={t.id}><label className={t.done ? s.doneTask : ""}><input type="checkbox" checked={t.done} disabled={busy} onChange={() => void commit(d => { const item = d.lists.find(l => l.id === list.id)!.items.find(i => i.id === t.id)!; item.done = !item.done; }, t.done ? "Task reopened." : "Task complete.")}/><span>{t.text}{(t.assigneeId || t.due) && <small>{t.assigneeId && profileName(t.assigneeId)}{t.assigneeId && t.due ? " · " : ""}{t.due && `Due ${day(t.due)}`}</small>}</span></label><button className={s.iconButton} aria-label={`Edit task: ${t.text}`} onClick={() => open({ type: "task", id: t.id, listId: list.id })}><Icon name="edit" size={14}/></button></li>)}</ul><form className={s.quickTask} onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const text = String(new FormData(form).get("task") || "").trim(); if (!text) return; void commit(d => { d.lists.find(l => l.id === list.id)!.items.push({ id: newId(), text, done: false, assigneeId: "", due: "" }); }, "Task added.").then(ok => { if (ok) form.reset(); }); }}><input name="task" aria-label={`New task for ${list.title}`} placeholder="Add something to do…" required maxLength={500}/><button type="submit" className={s.iconButton} disabled={busy} aria-label="Add task"><Icon name="plus" size={18}/></button></form><div className={s.noteFooter}><button className={s.textButton} disabled={busy || !list.items.some(t => t.done)} onClick={() => void commit(d => { d.lists.find(l => l.id === list.id)!.items = list.items.filter(t => !t.done); }, "Completed tasks cleared.")}>Clear completed</button><button className={s.iconButton} aria-label={`Delete list ${list.title}`} onClick={() => { if (window.confirm(`Delete “${list.title}” and its tasks?`)) void commit(d => { d.lists = d.lists.filter(l => l.id !== list.id); d.order = d.order.filter(id => id !== list.id); if (d.noteLayout) delete d.noteLayout[list.id]; if (d.cardColors) delete d.cardColors[list.id]; d.removedNotes = d.removedNotes?.filter(id => id !== list.id); }); }}><Icon name="trash" size={15}/></button></div></>);
  }
  function renderBoard() {
    const order = ["drop-pick", ...state.order.filter(id => id !== "drop-pick")];
    const height = Math.max(850, ...order.map(id => notePlacement(id).y + (notePlacement(id).height || (id === "drop-pick" ? 750 : 580))));
    const notes = order.map(id => {
      const list = state.lists.find(l => l.id === id);
      if (list) return renderList(list);
      if (view === "lists") return null;
      if (id === "drop-pick") return summaryPreferences(state, "drop-pick").pinned ? paper(id, "lemon", <TodayDropPick state={state} busy={busy} commit={commit} onOpen={() => navigate("schedule")}/>) : null;
      if (["medications", "gifts", "schedule", "tasks-summary"].includes(id)) {
        const kind = id as SummaryKind; if (!summaryPreferences(state, kind).pinned) return null;
        return paper(id, kind === "schedule" ? "cream" : kind === "medications" ? "sage" : kind === "gifts" ? "rose" : "butter", <SummaryNoteContent state={state} kind={kind} onEditActivity={id => navigate("schedule", "", null, id)} onOpen={() => navigate(kind === "tasks-summary" ? "lists" : kind === "drop-pick" ? "schedule" : kind)}/>);
      }
      if (id === "welcome") return paper(id, "cream", <><div className={s.handwritten}>A place for all of us.</div><h2 className={s.welcomeTitle}>Life’s little things,<br/>in one place.</h2><p className={s.noteCopy}>The shopping list. A birthday idea. The dog’s medication. A little less to keep in your head.</p><div className={s.familyLine}>{state.profiles.slice(0, 6).map(p => <span key={p.id} className={`${s.avatar} ${s[p.color]}`} title={p.name}>{p.kind === "pet" ? <Icon name="paw" size={16}/> : p.name.slice(0, 1)}</span>)}<button className={s.addAvatar} onClick={() => { navigate("settings", "", { type: "profile", kind: "person" }); }} aria-label="Add a family member"><Icon name="plus" size={17}/></button></div><button className={s.noteLink} onClick={() => navigate("settings")}>{state.profiles.length ? "Meet the household" : "Start with your family"}<Icon name="arrow" size={17}/></button></>);
      return null;
     });
    return <>{view === "lists" && <div className={s.sectionHeading}><h2>One list at a time.</h2><span>One thing, then the next.</span></div>}{view === "board" ? <BoardCanvas height={height} disabled={busy} onAdd={() => open({ type: "list" })} onSummaries={() => open({ type: "summary" })}>{notes}</BoardCanvas> : <div className={s.pinboard}>{notes}<button className={s.addNote} disabled={!ready || busy} onClick={() => open({ type: "list" })}><span><Icon name="plus" size={26}/></span><strong>A fresh little list</strong><small>Shopping, jobs, plans, anything.</small></button></div>}</>;
  }
  function renderSettings() {
    const profileGroup = (title: string, profiles: Profile[], kind: "person" | "pet") => <section className={s.settingsGroup}><div className={s.sectionHeading}><h2>{title}</h2><button className={s.secondary} onClick={() => open({ type: "profile", kind })}><Icon name="plus" size={16}/>Add {kind === "pet" ? "pet" : "member"}</button></div>{profiles.length === 0 ? <div className={s.emptyGroup}><Icon name={kind === "pet" ? "paw" : "person"} size={30}/><h3>{kind === "pet" ? "The furry part of the family." : "Make room for your people."}</h3><p>{kind === "pet" ? "Add pets so you can keep their medication and care together." : "Add family members to assign tasks, plan presents, and track medication."}</p></div> : <ul className={s.profileRows}>{profiles.map(p => <li key={p.id}><span className={`${s.avatar} ${s[p.color]}`}>{p.kind === "pet" ? <Icon name="paw"/> : p.name.slice(0, 1)}</span><div><strong>{p.name}</strong><small>{p.species || (kind === "pet" ? "Pet" : "Family member")}{p.birthday ? ` · Birthday ${day(p.birthday)}` : ""}</small></div><button className={s.iconButton} onClick={() => open({ type: "profile", id: p.id })} aria-label={`Edit ${p.name}`}><Icon name="edit" size={17}/></button><button className={s.iconButton} aria-label={`Remove ${p.name}`} onClick={() => { if (!window.confirm(`Remove ${p.name}? Profiles with medication, presents, or assigned tasks must be cleared or reassigned first.`)) return; void commit(d => { if (d.schoolTravel?.profileIds.includes(p.id) || d.schoolTravel?.days.some(day => day.profileId === p.id || day.toSchool.byProfileId === p.id || day.pickup.byProfileId === p.id) || d.schoolTravelOverrides?.some(item => item.profileId === p.id || item.trip?.byProfileId === p.id) || d.dropPickOverrides?.some(item => item.replacement && (dropPickProfileIds(item.replacement).includes(p.id) || item.replacement.byProfileId === p.id)) || d.dropPick?.some(entry => dropPickProfileIds(entry).includes(p.id) || entry.byProfileId === p.id) || d.activities?.some(activity => activity.profileIds.includes(p.id)) || Object.values(d.summaries || {}).some(prefs => prefs.profileId === p.id) || d.medications.some(m => medicationHasProfile(m, p.id)) || d.gifts.some(g => g.recipientId === p.id) || d.lists.some(l => l.items.some(t => t.assigneeId === p.id))) throw new Error("Reassign this profile’s school travel and Drop/Pick entries, medication, activities, summary filters, presents and tasks before removing it."); d.profiles = d.profiles.filter(v => v.id !== p.id); }); }}><Icon name="trash" size={16}/></button></li>)}</ul>}</section>;
    return <><p className={s.viewIntro}>Your people. Your pets. Everyone belongs here.<br/>Profiles help organise the board; they don’t need their own login.</p><div className={s.settingsGrid}>{profileGroup("Family members", people, "person")}{profileGroup("Pets", pets, "pet")}</div><HouseholdAccess/><aside className={s.storageNote}><strong>A private household board</strong><p>Changes are saved to your household online. Other signed-in household members can use the same board.</p></aside></>;
  }
  function renderMedications() {
    const medications = activeMeds.filter(m => !recipient || medicationHasProfile(m, recipient));
    return <><div className={s.viewToolbar}><p>Keep track of what’s been given, and what’s left.</p><button className={s.primary} disabled={!state.profiles.length || busy} onClick={() => open({ type: "medication" })}><Icon name="plus" size={17}/>Add medication</button></div>{renderProfileFilters()}{!state.profiles.length && <div className={s.setupPrompt}>Add a family member or pet in Settings to start tracking their medication.<button className={s.textButton} onClick={() => navigate("settings")}>Open settings <Icon name="arrow" size={16}/></button></div>}<div className={s.medicationGrid}>{medications.map(m => {
      const regimens = medicationRegimens(m); const person = state.profiles.find(p => p.id === regimens[0].profileId); const supplyStatus = medicationSupplyStatus(m);
      const lastDose = [...m.logs].reverse().find(l => !l.reversed);
      const daysLeft = supplyStatus.daysLeft === null ? null : Math.floor(supplyStatus.daysLeft);
      const supplyTime = supplyStatus.daysLeft === 0 ? "Out of stock" : supplyStatus.daysLeft !== null && supplyStatus.daysLeft < 1 ? "Less than 1 day left" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`;
      return <article className={`${s.medicationCard} ${s[person?.color || "cream"]}`} key={m.id} style={{ background: medicationBackground(m, state.profiles) }}><header><span className={s.recipient}><Icon name={person?.kind === "pet" ? "paw" : "person"} size={16}/>{medicationRegimens(m).map(r => profileName(r.profileId)).join(" & ")}</span>{supplyStatus.kind && <span className={`${s.supplySticker} ${supplyStatus.kind === "prescription" ? s.prescriptionSticker : s.lowStockSticker}`} role="status">{supplyStatus.kind === "prescription" ? <><strong>New prescription</strong><small>0 repeats · {supplyTime}</small></> : <><strong>Low stock</strong><small>{m.unitsLeft} {m.unit} left</small></>}</span>}<button className={s.iconButton} onClick={() => open({ type: "medication", id: m.id })} aria-label={`Edit ${m.name}`}><Icon name="edit" size={17}/></button></header><h2>{m.name}</h2><div className={s.medicationRegimens}>{regimens.map(regimen => <section key={regimen.profileId} className={s.memberDose} aria-label={`Dose for ${profileName(regimen.profileId)}`}>{regimens.length > 1 && <strong className={s.memberDoseName}>{profileName(regimen.profileId)}</strong>}<p className={s.dailyDose}><strong>{dailyDoseLabel({ ...m, ...regimen })}</strong></p><p className={s.doseSchedule}>{regimen.unitsPerDose} {m.unit} per dose · {regimen.dosesPerDay ? `${regimen.dosesPerDay}× daily` : "as needed"}{m.strength && <> · {m.strength} strength</>}{regimen.doseTiming && <><br/>{regimen.doseTiming}</>}</p>{regimen.instructions && <p className={s.instructions}>{regimen.instructions}</p>}</section>)}</div><details className={s.medInventory} aria-label={`Inventory for ${m.name}`}><summary>{m.unitsLeft} {m.unit} left{daysLeft !== null && <> · approx. {daysLeft} days</>}</summary><dl className={s.supply}><div><dt>Supply left</dt><dd>{m.unitsLeft}<small>{m.unit}</small></dd></div><div><dt>Repeats</dt><dd>{m.repeats}</dd></div>{daysLeft !== null && <div><dt>Approx. supply</dt><dd>{daysLeft}<small>days</small></dd></div>}</dl><details className={s.stockHistory}><summary>Inventory history ({m.stockChanges?.length || 0})</summary><ol className={s.doseHistory}>{[...(m.stockChanges || [])].reverse().map(change => <li key={change.id}><div><strong>{({ consume: "Consumed", replenish: "Replenished", correct: "Corrected", repeat: "Repeat filled" })[change.action]} · {change.before} → {change.after} {m.unit}</strong><span>{new Date(change.occurredAt).toLocaleString("en-AU")}</span>{change.note && <span>{change.note}</span>}</div></li>)}{!m.stockChanges?.length && <li>No inventory adjustments yet. Dose deductions appear in dose history.</li>}</ol></details></details>{m.expiresOn && <p className={s.lastDose}>Prescription expires {day(m.expiresOn)} {m.expiresOn.slice(0, 4)}</p>}{lastDose && <p className={s.lastDose}>{`Last logged ${new Date(lastDose.occurredAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · ${lastDose.profileId ? `${profileName(lastDose.profileId)} · ` : ""}${lastDose.units} ${m.unit}`}</p>}<div className={s.medActions}><button className={s.primary} disabled={busy} onClick={() => open({ type: "dose", id: m.id })}>Log a dose</button><button className={s.secondary} disabled={busy} onClick={() => open({ type: "inventory", id: m.id })}>Inventory</button></div><div className={s.noteFooter}><button className={s.textButton} onClick={() => setHistoryId(historyId === m.id ? null : m.id)}>{historyId === m.id ? "Hide history" : `Dose history (${m.logs.filter(l => !l.reversed).length})`}</button><button className={s.textButton} onClick={() => { if (window.confirm(`Archive ${m.name}? Its dose history will be kept.`)) void commit(d => { d.medications.find(v => v.id === m.id)!.archived = true; }); }}>Archive</button></div>{historyId === m.id && <ol className={s.doseHistory}>{[...m.logs].reverse().map(log => <li key={log.id}><div><strong>{log.profileId && <>{profileName(log.profileId)} · </>}{log.units} {m.unit}{log.reversed ? " · Reversed" : ""}{log.tracksStock === false ? " · Inventory unchanged" : " · Deducted from inventory"}</strong><span>{new Date(log.occurredAt).toLocaleString("en-AU")}</span>{log.note && <span>{log.note}</span>}</div>{!log.reversed && <button className={s.textButton} disabled={busy} onClick={() => void commit(d => { const i = d.medications.findIndex(v => v.id === m.id); d.medications[i] = undoDose(d.medications[i], log.id); }, "Dose reversed; any stock deduction restored.")}>Undo</button>}</li>)}{!m.logs.length && <li>No dose history yet.</li>}</ol>}</article>;
    })}{!medications.length && <div className={s.emptyGroup}><Icon name="pill" size={34}/><h2>Care, without the mental checklist.</h2><p>Add medication for a family member or pet, then log each dose and track the supply.</p></div>}</div>{state.medications.some(m => m.archived) && <details className={s.archived}><summary>Archived medications</summary>{state.medications.filter(m => m.archived).map(m => <div key={m.id}><span>{m.name} · {medicationRegimens(m).map(r => profileName(r.profileId)).join(" & ")} · {m.logs.length} history entries</span><button className={s.textButton} disabled={busy} onClick={() => void commit(d => { d.medications.find(v => v.id === m.id)!.archived = false; })}>Restore</button></div>)}</details>}<p className={s.quietFootnote}>A record of care given. Follow the directions from your doctor, pharmacist or vet.</p></>;
  }
  function renderProfileFilters(peopleOnly = false) {
    return <div className={s.profileFilters} aria-label="Filter by family member">
      <button aria-pressed={!recipient} onClick={() => updateSurface(() => setRecipient(""))}>Everyone</button>
      {(peopleOnly ? people : state.profiles).map(p => <button key={p.id} aria-pressed={recipient === p.id} onClick={() => updateSurface(() => setRecipient(p.id))}>
        <span className={`${s.smallAvatar} ${s[p.color]}`}>{p.kind === "pet" ? <Icon name="paw" size={13}/> : p.name[0]}</span>{p.name}
      </button>)}
    </div>;
  }
  function renderGifts() {
    const gifts = state.gifts.filter(g => (!recipient || g.recipientId === recipient) && (occasion === "all" || occasionsForGift(g).includes(occasion as Gift["occasion"])));
    const budget = gifts.reduce((n, g) => n + (g.cost || 0), 0);
    return <><div className={s.viewToolbar}><p>Little hints now. Lovely surprises later.</p><button className={s.primary} disabled={!people.length || busy} onClick={() => open({ type: "gift" })}><Icon name="plus" size={17}/>Add an idea</button></div><div className={s.giftToolbar}><div className={s.segmented}>{["all", "birthday", "christmas"].map(o => <button key={o} aria-pressed={occasion === o} onClick={() => updateSurface(() => setOccasion(o))}>{o === "all" ? "All presents" : o === "birthday" ? "Birthdays" : "Christmas"}</button>)}</div></div>{renderProfileFilters(true)}<div className={s.giftSummary}><span>{gifts.length} {gifts.length === 1 ? "idea" : "ideas"} · {gifts.filter(g => g.status === "requested").length} requested · {gifts.filter(giftIsBought).length} bought · {gifts.filter(g => g.status === "wrapped").length} ready</span><span>Total price {money(budget)}</span></div>{!people.length && <div className={s.setupPrompt}>Add your family in Settings, then give each person their own present list.<button className={s.textButton} onClick={() => navigate("settings")}>Open settings <Icon name="arrow" size={16}/></button></div>}<div className={s.giftGrid}>{gifts.map(g => <article key={g.id} className={`${s.giftCard} ${s[state.profiles.find(p => p.id === g.recipientId)?.color || "cream"]}`}><header><div className={s.giftHeadingLine}><span>{profileName(g.recipientId)} · {occasionsForGift(g).map(o => o === "birthday" ? "Birthday" : "Christmas").join(" & ")}</span><span className={s.requestedStatus}>{({ idea: "Idea", requested: "Requested", bought: "Bought", wrapped: "Ready" })[g.status]}</span></div><button className={s.iconButton} onClick={() => open({ type: "gift", id: g.id })} aria-label={`Edit ${g.name}`}><Icon name="edit" size={16}/></button></header><h2>{g.name}</h2>{g.notes && <p>{g.notes}</p>}<div className={s.giftDetails}><div className={s.giftPrice}><span>Price</span><strong>{g.cost !== null ? money(g.cost) : "Not set"}</strong></div>{!!linksForGift(g).length && <div className={s.giftProductLinks}>{linksForGift(g).map((link, index) => <a key={`${link.url}-${index}`} className={s.productLink} href={link.url} target="_blank" rel="noopener noreferrer">{link.label || new URL(link.url).hostname.replace(/^www\./, "")}<Icon name="arrow" size={14}/></a>)}</div>}</div><div className={s.giftChecks}><label><input type="checkbox" checked={giftIsBought(g)} disabled={busy} onChange={() => void commit(d => { d.gifts.find(v => v.id === g.id)!.status = giftIsBought(g) ? "idea" : "bought"; })}/>Bought</label><label><input type="checkbox" checked={g.status === "wrapped"} disabled={busy} onChange={() => void commit(d => { d.gifts.find(v => v.id === g.id)!.status = g.status === "wrapped" ? "bought" : "wrapped"; })}/>Wrapped & ready</label><button className={s.iconButton} aria-label={`Delete present ${g.name}`} onClick={() => { if (window.confirm(`Remove “${g.name}” from the present list?`)) void commit(d => { d.gifts = d.gifts.filter(v => v.id !== g.id); }); }}><Icon name="trash" size={15}/></button></div></article>)}</div>{!gifts.length && <div className={s.emptyGifts}><Icon name="gift" size={40}/><h2>A good idea deserves a place.</h2><p>{recipient ? `Save birthday and Christmas ideas for ${profileName(recipient)}.` : "Choose someone and tuck away an idea for their birthday or Christmas."}</p>{!!people.length && <button className={s.secondary} onClick={() => open({ type: "gift" })}>Keep the first idea</button>}</div>}</>;
  }
  const currentSummary: SummaryKind | null = view === "lists" ? "tasks-summary" : view === "medications" || view === "gifts" ? view : null;
  function pinSummary(kind: SummaryKind) { void commit(draft => setSummaryPreferences(draft, kind, { ...summaryPreferences(draft, kind), pinned: true }), "Summary pinned to your board."); }
  const headings = { schedule: "The rhythm of our week.", board: "The family board.", lists: "A little more organised.", medications: "Care for the whole family.", gifts: "Thought of. Tucked away.", settings: "Everyone under one roof." };
  return <div className={`${s.shell} ${view === "board" ? s.boardShell : ""}`}>
    <header className={s.mobileHeader}><button className={s.mobileBrand} onClick={() => navigate("board")} aria-label="HealthHome pinboard"><Icon name="board" size={22}/><span>HealthHome<span>.</span></span></button><button className={s.mobileMenuButton} onClick={() => mobileMenu.current?.showModal()} aria-label="Open household and settings"><Icon name="settings"/><span>More</span></button></header>
    <nav className={s.mobileNav} aria-label="Main navigation">{views.filter(v => v.id !== "settings").map(v => <button key={v.id} aria-label={v.label} aria-current={view === v.id ? "page" : undefined} onClick={() => navigate(v.id)}><Icon name={v.icon} size={21}/><span>{({ board: "Pinboard", lists: "Lists", schedule: "Week", medications: "Medication", gifts: "Presents" } as Record<string, string>)[v.id]}</span></button>)}</nav>
    <dialog ref={mobileMenu} className={s.mobileMenu} aria-labelledby="mobile-menu-title" onClick={event => { if (event.target === event.currentTarget || (event.target as HTMLElement).closest("button")) mobileMenu.current?.close(); }}><div className={s.mobileMenuContents}><header><h2 id="mobile-menu-title">Our little corner</h2><button className={s.iconButton} aria-label="Close menu" onClick={() => mobileMenu.current?.close()}><Icon name="close"/></button></header><nav aria-label="Household navigation">{views.map(v => <button key={v.id} aria-current={view === v.id ? "page" : undefined} onClick={() => navigate(v.id)}><Icon name={v.icon}/>{v.label}<Icon name="arrow" size={16}/></button>)}</nav><h3>The household</h3><div className={s.mobilePeople}>{state.profiles.map(p => <button key={p.id} onClick={() => navigate("medications", p.id)}><span className={`${s.smallAvatar} ${s[p.color]}`}>{p.kind === "pet" ? <Icon name="paw" size={14}/> : p.name[0]}</span>{p.name}</button>)}</div><p>Private family space · Saved online</p></div></dialog>
    <aside className={s.sidebar}><a href="/app" className={s.brand}><span className={s.brandMark}><Icon name="board" size={22}/></span>HealthHome<span className={s.brandDot}>.</span></a><p className={s.homeLabel}>Our little corner</p><nav aria-label="Main navigation">{views.map(v => <button key={v.id} className={`${s.navItem} ${view === v.id ? s.activeNav : ""}`} aria-current={view === v.id ? "page" : undefined} onClick={() => navigate(v.id)}><Icon name={v.icon}/><span>{v.label}</span>{v.id === "lists" && !!activeTasks.length && <small>{activeTasks.length}</small>}</button>)}</nav><div className={s.sidebarFamily}><div className={s.sidebarTitle}><span>The household</span><button className={s.iconButton} aria-label="Manage household" onClick={() => navigate("settings")}><Icon name="plus" size={16}/></button></div>{state.profiles.map(p => <button key={p.id} onClick={() => { navigate("medications", p.id); }}><span className={`${s.smallAvatar} ${s[p.color]}`}>{p.kind === "pet" ? <Icon name="paw" size={13}/> : p.name[0]}</span>{p.name}{p.kind === "pet" && <small>Pet</small>}</button>)}{!state.profiles.length && <p>A place for your people<br/>and pets, too.</p>}</div><div className={s.sidebarBottom}><span className={s.saveDot}/><div><strong>Private family space</strong><small>Saved online · Shared with your household</small></div></div></aside><main className={`${s.main} ${view === "board" ? s.boardMain : view === "schedule" ? s.scheduleMain : ""}`}>{view !== "board" && <header className={s.topbar}><span>Home <span>/</span> {views.find(v => v.id === view)?.label}</span><div className={s.date}>{ready && <><span>{new Date().getDate()}</span><div><strong>{new Date().toLocaleDateString("en-AU", { month: "short" })}</strong><small>{new Date().toLocaleDateString("en-AU", { weekday: "long" })}</small></div></>}</div></header>}{view !== "board" && <div className={s.pageHeading}><div><h1>{headings[view]}</h1><p>{view === "settings" ? "The family behind the board." : "Less remembering. More getting on with life."}</p></div>{view === "lists" && <button className={s.primary} disabled={!ready || busy} onClick={() => open({ type: "list" })}><Icon name="plus" size={18}/>New list</button>}</div>}<div className={s.feedback} aria-live="polite">{notice && <span><Icon name="check" size={14}/>{notice}</span>}</div>{error && <div className={s.error} role="alert">{error}{!ready && <button className={s.textButton} onClick={() => window.location.reload()}>Try again</button>}</div>}{!ready ? <div className={s.loading}>Opening your family board…</div> : <>{renderEditor()}{currentSummary && <div className={s.sectionSummaryControl}><button className={s.textButton} disabled={busy} onClick={() => summaryPreferences(state, currentSummary).pinned ? open({ type: "summary" }) : pinSummary(currentSummary)}>{summaryPreferences(state, currentSummary).pinned ? "Pinboard summary options" : "Pin a summary to the board"}</button></div>}{view === "board" || view === "lists" ? renderBoard() : view === "schedule" ? <>{renderProfileFilters()}<WeeklySchedule key={scheduleEditId || "schedule"} initialEditing={scheduleEditId} state={state} profileId={recipient} busy={busy} commit={commit} pinned={summaryPreferences(state, "schedule").pinned} onPin={() => pinSummary("schedule")} onOptions={() => open({ type: "summary" })}/></> : view === "settings" ? renderSettings() : view === "medications" ? renderMedications() : renderGifts()}</>}<footer className={s.footer}><span>Room for the everyday.</span><span>HealthHome · Made for your family</span></footer></main></div>;
}
