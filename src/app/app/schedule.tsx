"use client";

import { useRef, useState, useLayoutEffect, type ReactNode, type FormEvent } from "react";
import { householdDateKey, newId, weekDates, weekdayNames, weeklyAgenda, type BoardState, type WeeklyActivity } from "@/lib/board";
import { activityGroups, timedActivityLayout } from "@/lib/schedule-layout";
import s from "./family-board.module.css";
import { DropPickSettings } from "./drop-pick-settings";

export type BoardCommit = (change: (draft: BoardState) => void, message?: string) => Promise<boolean>;
export const clockLabel = (time: string) => { const [hour, minute] = time.split(":").map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, "0")}${hour >= 12 ? "pm" : "am"}`; };

export function AgendaTiles({ state, offset = 0, profileId = "", compact = false, todayOnly = false, showPeople = true, onEdit, onRemove }: { state: BoardState; offset?: number; profileId?: string; compact?: boolean; todayOnly?: boolean; showPeople?: boolean; onEdit?: (id: string) => void; onRemove?: (id: string) => void }) {
  const today = householdDateKey();
  const occupied = weeklyAgenda(state.activities || [], new Date(), offset, profileId);
  const days = weekDates(new Date(), offset).map((date, weekday) => ({ date, weekday, activities: occupied.find(day => day.date === date)?.activities || [] })).filter(day => !todayOnly || day.date === today);
  if (todayOnly && !days.some(day => day.activities.length)) return <p className={s.agendaEmpty}>Nothing scheduled today.</p>;
  const layout = days.map(day => ({ ...day, groups: activityGroups(day.activities) }));
  const tile = (activity: WeeklyActivity) => <>
    <time>{clockLabel(activity.startTime)}{activity.endTime && <span>–{clockLabel(activity.endTime)}</span>}</time>
    <div><strong>{activity.title}</strong>{showPeople && <small>{activity.profileIds.length ? activity.profileIds.map(id => state.profiles.find(p => p.id === id)?.name || "Unknown").join(" & ") : "Everyone"}</small>}</div>
    {(onEdit || onRemove) && <div className={s.activityActions}>{onEdit && <button className={s.textButton} onClick={() => onEdit(activity.id)} aria-label={`Edit ${activity.title}`}>Edit</button>}{onRemove && <button className={s.textButton} onClick={() => onRemove(activity.id)} aria-label={`Remove ${activity.title}`}>Remove</button>}</div>}
  </>;
  return <div className={`${s.agenda} ${compact ? s.compactAgenda : ""}`} style={{ gridTemplateColumns: `repeat(${layout.length}, minmax(192px, 1fr))` }}>{layout.map(day => <section className={s.agendaDay} key={day.date}>
    <h3>{weekdayNames[day.weekday].slice(0, 3)}{day.date === today && <small>Today</small>}</h3>
    {day.weekday < 5 && <DropPickNotes state={state} weekday={day.weekday} profileId={profileId}/>}
    <div className={s.agendaTiles}>{day.groups.map((lanes, index) => lanes.length > 1 ? <TimedActivities key={index} lanes={lanes} renderTile={tile}/> : lanes[0].map(activity => <article key={activity.id} className={`${s.activityTile} ${s[activity.color]}`}>{tile(activity)}</article>))}</div>
  </section>)}</div>;
}

function TimedActivities({ lanes, renderTile }: { lanes: WeeklyActivity[][]; renderTile: (activity: WeeklyActivity) => ReactNode }) {
  const group = useRef<HTMLDivElement>(null);
  const [minimumHeights, setMinimumHeights] = useState<Record<string, number>>({});
  const signature = lanes.flat().map(activity => activity.id).join("|");
  useLayoutEffect(() => {
    const measure = () => {
      const heights: Record<string, number> = {};
      group.current?.querySelectorAll<HTMLElement>("[data-activity-content]").forEach(element => { heights[element.dataset.activityContent!] = element.offsetHeight + 28; });
      setMinimumHeights(previous => Object.keys(heights).length === Object.keys(previous).length && Object.entries(heights).every(([id, height]) => previous[id] === height) ? previous : heights);
    };
    const observer = new ResizeObserver(measure);
    group.current?.querySelectorAll("[data-activity-content]").forEach(element => observer.observe(element));
    measure();
    return () => observer.disconnect();
  }, [signature]);
  const layout = timedActivityLayout(lanes, minimumHeights);
  return <div className={s.activityGroupScroll} role="group" aria-label="Overlapping activities, positioned by time" tabIndex={lanes.length > 2 ? 0 : undefined}>
    <div ref={group} className={s.timedActivities} style={{ height: layout.height, minWidth: lanes.length > 2 ? lanes.length * 90 : undefined }}>
      {layout.items.map(({ activity, column, top, height }) => <article key={activity.id} className={`${s.activityTile} ${s[activity.color]}`} style={{ top, height, left: `calc(${column * 100 / lanes.length}% + ${column ? 4 : 0}px)`, width: `calc(${100 / lanes.length}% - 4px)` }}><div data-activity-content={activity.id} className={s.activityTileContent}>{renderTile(activity)}</div></article>)}
    </div>
  </div>;
}

export function WeeklySchedule({ state, profileId, busy, commit, onPin, onOptions, pinned, initialEditing = null }: { state: BoardState; profileId: string; busy: boolean; commit: BoardCommit; onPin: () => void; onOptions: () => void; pinned: boolean; initialEditing?: string | null }) {
  const [editing, setEditing] = useState<string | null>(initialEditing);
  const formRef = useRef<HTMLFormElement>(null);
  const activity = state.activities?.find(a => a.id === editing);
  const start = (id: string) => { setEditing(id); requestAnimationFrame(() => formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })); };
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const text = (key: string) => String(data.get(key) || "").trim();
    const value: WeeklyActivity = { id: activity?.id || newId(), title: text("title"), weekdays: data.getAll("weekday").map(Number), profileIds: data.getAll("activityProfile").map(String), startTime: text("startTime"), endTime: text("endTime"), color: activity?.color || state.profiles.find(profile => profile.id === String(data.getAll("activityProfile")[0] || ""))?.color || "blue" };
    const ok = await commit(draft => {
      if (!value.weekdays.length) throw new Error("Choose at least one day for this weekly activity.");
      if (value.endTime && value.endTime <= value.startTime) throw new Error("Choose an end time later than the start time on the same day.");
      const activities = draft.activities || []; const index = activities.findIndex(a => a.id === value.id);
      if (index < 0) activities.push(value); else activities[index] = value; draft.activities = activities;
    }, "Weekly activity saved."); if (ok) setEditing(null);
  }
  return <>
    <div className={s.viewToolbar}><p>The regular things, with room around them.</p><div className={s.scheduleActions}><button className={s.secondary} disabled={busy} onClick={pinned ? onOptions : onPin}>{pinned ? "Summary options" : "Pin schedule summary"}</button><button className={s.primary} disabled={busy} onClick={() => start("new")}>Add weekly activity</button></div></div>
    <details className={s.dropPickControl}><summary>Manage Drop/Pick</summary><DropPickSettings state={state} busy={busy} commit={commit}/></details>
    {editing !== null && <form ref={formRef} key={editing} className={s.editor} onSubmit={save}><header><h2>{activity ? "Edit weekly activity" : "A regular little plan"}</h2><button type="button" className={s.textButton} onClick={() => setEditing(null)}>Close</button></header><fieldset className={s.formFields} disabled={busy}>
      <label className={s.field}>Activity<input name="title" defaultValue={activity?.title} maxLength={500} required placeholder="Swimming, school run, family dinner…"/></label>
      <label className={s.field}>Starts<input name="startTime" type="time" defaultValue={activity?.startTime || "09:00"} required/></label>
      <label className={s.field}>Ends (optional)<input name="endTime" type="time" defaultValue={activity?.endTime}/></label>
      <fieldset className={s.activityChoices}><legend>Repeats every week on</legend>{weekdayNames.map((day, index) => <label key={day}><input type="checkbox" name="weekday" value={index} defaultChecked={activity?.weekdays.includes(index)}/>{day.slice(0, 3)}</label>)}</fieldset>
      <fieldset className={s.activityChoices}><legend>Family members & pets (leave empty for everyone)</legend>{state.profiles.map(profile => <label key={profile.id}><input name="activityProfile" type="checkbox" value={profile.id} defaultChecked={activity?.profileIds.includes(profile.id)}/><span className={`${s.profileDot} ${s[profile.color]}`}/>{profile.name}</label>)}</fieldset>
      <div className={s.formActions}><button className={s.primary} type="submit">{busy ? "Saving…" : "Save weekly activity"}</button><button type="button" className={s.textButton} onClick={() => setEditing(null)}>Cancel</button>{activity && <button type="button" className={s.textButton} onClick={() => { if (window.confirm(`Delete “${activity.title}” from the weekly schedule? This removes all its weekly occurrences.`)) void commit(d => { d.activities = d.activities?.filter(a => a.id !== activity.id); }, "Weekly activity removed.").then(ok => { if (ok) setEditing(null); }); }}>Delete weekly activity</button>}</div>
    </fieldset></form>}
    <div className={s.weekNavigation}><div><h2>Every week</h2><span>Weekly recurring activities</span></div></div>
    <AgendaTiles state={state} profileId={profileId} onEdit={start} onRemove={id => { const item = state.activities?.find(a => a.id === id); if (item && !busy && window.confirm(`Remove “${item.title}” from every week?`)) void commit(d => { d.activities = d.activities?.filter(a => a.id !== id); }, "Weekly activity removed."); }}/>
  </>;
}

function DropPickNotes({ state, weekday, profileId }: { state: BoardState; weekday: number; profileId: string }) {
  const entries = (state.dropPick || []).filter(entry => entry.weekdays.includes(weekday) && (!profileId || entry.profileId === profileId || entry.byProfileId === profileId));
  return <div className={s.dropPickDay}><h4>Drop/Pick</h4>{entries.map(entry => {
    const person = state.profiles.find(p => p.id === entry.profileId);
    const by = state.profiles.find(p => p.id === entry.byProfileId);
    return <div className={s.dropPickNote} key={entry.id}><div><span className={`${s.profileDot} ${s[person?.color || "cream"]}`}/><strong>{person?.name}</strong><span>{entry.note}</span></div><small>By <span className={`${s.profileDot} ${s[by?.color || "cream"]}`}/><strong>{by?.name}</strong></small></div>;
  })}{!entries.length && <span className={s.dropPickBlank}>—</span>}</div>;
}
