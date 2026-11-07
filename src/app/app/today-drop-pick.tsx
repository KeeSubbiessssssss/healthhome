"use client";

import { useEffect, useState, type FormEvent } from "react";
import { dailyDropPick, dropPickByLabel, dropPickProfileIds, householdDateKey, setDropPickOverride, summaryPreferences, type BoardState, type DropPick } from "@/lib/board";
import { DropPickFields } from "./drop-pick-settings";
import type { BoardCommit } from "./schedule";
import s from "./family-board.module.css";

export function TodayDropPick(props: { state: BoardState; busy: boolean; commit: BoardCommit; onOpen: () => void }) {
  const [date, setDate] = useState(householdDateKey);
  useEffect(() => {
    const refresh = () => setDate(householdDateKey());
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return <DailyDropPick key={date} {...props} date={date}/>;
}
function DailyDropPick({ state, busy, commit, onOpen, date }: { state: BoardState; busy: boolean; commit: BoardCommit; onOpen: () => void; date: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const entries = dailyDropPick(state, date, summaryPreferences(state, "drop-pick").profileId);
  const current = entries.find(item => item.source.id === editing);
  const people = state.profiles.filter(profile => profile.kind === "person");
  const names = (entry: DropPick) => dropPickProfileIds(entry).map(id => state.profiles.find(profile => profile.id === id)?.name || "Unknown").join(" & ");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!current) return;
    const data = new FormData(event.currentTarget);
    const profileIds = data.getAll("profileId").map(String); const by = String(data.get("by") || "");
    const replacement: DropPick = { id: current.source.id, profileId: profileIds[0] || "", profileIds, note: String(data.get("note") || "").trim(), byProfileId: by.startsWith("person:") ? by.slice(7) : "", ...(by === "bus" ? { transport: "bus" } : {}), weekdays: current.source.weekdays };
    const ok = await commit(draft => {
      if (householdDateKey() !== date) throw new Error("The day has changed. Reopen today’s arrangement and try again.");
      if (!profileIds.length) throw new Error("Choose at least one family member.");
      setDropPickOverride(draft, current.source.id, date, replacement);
    }, "Drop/Pick changed for today only.");
    if (ok) setEditing(null);
  }
  function restore(entryId: string) {
    void commit(draft => { draft.dropPickOverrides = draft.dropPickOverrides?.filter(item => item.entryId !== entryId || item.date !== date); }, "Today’s weekly arrangement restored.").then(ok => { if (ok) setEditing(null); });
  }
  return <div className={s.todayDropPick} data-note-scroll>
    <p className={s.todayDate}>{new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "long", day: "numeric", month: "short" }).format(new Date(date + "T01:00:00Z"))}</p>
    {!entries.length && <p>No Drop/Pick arrangements today.</p>}
    <ul>{entries.map(item => <li key={item.source.id} className={item.skipped ? s.skippedDropPick : undefined}>
      <div className={s.todayPeople}>{dropPickProfileIds(item.entry).map(id => { const person = state.profiles.find(profile => profile.id === id); return <span key={id}><i className={`${s.profileDot} ${s[person?.color || "cream"]}`}/><strong>{person?.name}</strong></span>; })}</div>
      <span>{item.entry.note}</span><small>{item.skipped ? "Skipped today" : `By ${dropPickByLabel(item.entry, state.profiles)}`}{item.changed && !item.skipped && " · Changed today"}</small>
      <div className={s.todayActions}>{!item.skipped && <><button className={s.textButton} disabled={busy} onClick={() => setEditing(item.source.id)} aria-label={`Change today’s Drop/Pick for ${names(item.entry)}: ${item.entry.note}`}>Change today</button><button className={s.textButton} disabled={busy} onClick={() => void commit(draft => setDropPickOverride(draft, item.source.id, date, null), "Drop/Pick skipped for today only.")}>Skip today</button></>}{item.changed && <button className={s.textButton} disabled={busy} onClick={() => restore(item.source.id)}>Use weekly plan</button>}</div>
    </li>)}</ul>
    {current && <form key={editing} className={s.todayEditor} onSubmit={save}><h3>Change for today</h3><p>Only {date}. The weekly plan stays the same.</p><fieldset className={s.formFields} disabled={busy}><DropPickFields entry={current.entry} people={people} showWeekdays={false}/><div className={s.formActions}><button type="submit" className={s.primary}>Save for today</button><button type="button" className={s.textButton} onClick={() => setEditing(null)}>Cancel</button></div></fieldset></form>}
    <button className={s.noteLink} onClick={onOpen}>Open weekly schedule</button>
  </div>;
}
