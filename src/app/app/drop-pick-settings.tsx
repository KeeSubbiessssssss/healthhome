"use client";

import { useState, type FormEvent } from "react";
import { newId, weekdayNames, type BoardState, type DropPick } from "@/lib/board";
import type { BoardCommit } from "./schedule";
import s from "./family-board.module.css";

export function DropPickSettings({ state, busy, commit }: { state: BoardState; busy: boolean; commit: BoardCommit }) {
  const [editing, setEditing] = useState<string | null>(null);
  const entry = state.dropPick?.find(entry => entry.id === editing);
  const people = state.profiles.filter(person => person.kind === "person");
  const name = (id: string) => people.find(person => person.id === id)?.name || "Unknown";
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value: DropPick = { id: entry?.id || newId(), profileId: String(data.get("profileId")), note: String(data.get("note") || "").trim(), byProfileId: String(data.get("byProfileId")), weekdays: data.getAll("weekday").map(Number) };
    const ok = await commit(draft => {
      if (!value.weekdays.length) throw new Error("Choose at least one weekday for Drop/Pick.");
      const entries = draft.dropPick || [];
      const index = entries.findIndex(entry => entry.id === value.id);
      if (index < 0) entries.push(value); else entries[index] = value;
      draft.dropPick = entries;
    }, "Drop/Pick saved.");
    if (ok) setEditing(null);
  }
  return <section className={s.settingsGroup}>
    <div className={s.sectionHeading}><h2>Drop/Pick</h2><button className={s.secondary} disabled={busy || !people.length} onClick={() => setEditing("new")}>Add Drop/Pick</button></div>
    <p className={s.dropPickHelp}>Who’s going, a little reminder, and who’s taking them. Shown above each weekday on your schedule.</p>
    {editing !== null && <form key={editing} className={s.editor} onSubmit={save}><h3>{entry ? "Edit Drop/Pick" : "Add Drop/Pick"}</h3><fieldset className={s.formFields} disabled={busy}>
      <label className={s.field}>Family member<select name="profileId" defaultValue={entry?.profileId || ""} required><option value="" disabled>Choose a family member</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <label className={s.field}>Note<input name="note" defaultValue={entry?.note} required maxLength={200} placeholder="School drop, pickup…"/></label>
      <label className={s.field}>By<select name="byProfileId" defaultValue={entry?.byProfileId || ""} required><option value="" disabled>Choose a family member</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <fieldset className={s.activityChoices}><legend>Every week on</legend>{weekdayNames.slice(0, 5).map((day, index) => <label key={day}><input type="checkbox" name="weekday" value={index} defaultChecked={entry ? entry.weekdays.includes(index) : true}/>{day.slice(0, 3)}</label>)}</fieldset>
      <div className={s.formActions}><button type="submit" className={s.primary}>{busy ? "Saving…" : "Save Drop/Pick"}</button><button type="button" className={s.textButton} onClick={() => setEditing(null)}>Cancel</button></div>
    </fieldset></form>}
    <ul className={s.dropPickSettingsList}>{(state.dropPick || []).map(entry => <li key={entry.id}><div><strong>{name(entry.profileId)}</strong><span>{entry.note}</span><small>By {name(entry.byProfileId)} · {entry.weekdays.map(day => weekdayNames[day].slice(0, 3)).join(", ")}</small></div><div className={s.activityActions}><button className={s.textButton} disabled={busy} onClick={() => setEditing(entry.id)} aria-label={`Edit Drop/Pick for ${name(entry.profileId)}: ${entry.note}`}>Edit</button><button className={s.textButton} disabled={busy} onClick={() => { if (window.confirm(`Remove “${entry.note}” for ${name(entry.profileId)} from Drop/Pick?`)) void commit(draft => { draft.dropPick = draft.dropPick?.filter(item => item.id !== entry.id); }, "Drop/Pick removed.").then(ok => { if (ok && editing === entry.id) setEditing(null); }); }}>Remove</button></div></li>)}</ul>
    {!state.dropPick?.length && editing === null && <p className={s.dropPickHelp}>{people.length ? "No Drop/Pick entries yet." : "Add family members above to start."}</p>}
  </section>;
}
