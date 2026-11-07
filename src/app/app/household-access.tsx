"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AccountControls } from "@/app/account-controls";
import s from "./family-board.module.css";

type Access = { role: string; name: string; now: number; members?: { id: string; name: string; email: string | null; role: string; active: boolean }[]; invitations?: { id: string; email: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null }[] };
export function HouseholdAccess() {
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/household", { cache: "no-store" }); const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Access settings could not load."); return data as Access;
  }, []);
  useEffect(() => { void load().then(setAccess).catch(e => setError(e.message)); }, [load]);
  async function change(body: object) {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/household", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Access could not be updated.");
      if (data.token) { setLink(`${window.location.origin}/join#${data.token}`); setMessage(`Invitation ready for ${data.email}. Copy the link and send it privately.`); }
      else { setLink(""); setMessage("Access updated."); }
      setAccess(await load());
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  function invite(e: FormEvent<HTMLFormElement>) { e.preventDefault(); void change({ action: "invite", email: new FormData(e.currentTarget).get("email") }); }
  return <section className={s.accessPanel} aria-labelledby="household-access-title"><div className={s.sectionHeading}><h2 id="household-access-title">Access & invitations</h2>{access && <span>{access.name} · {access.role === "owner" ? "Owner" : "Member"}</span>}</div>
    {error && <p className={s.error} role="alert">{error}<button className={s.textButton} onClick={() => { setError(""); void load().then(setAccess).catch(e => setError(e.message)); }}>Try again</button></p>}
    {!access && !error && <p>Loading access settings…</p>}
    {access?.role === "owner" ? <><p>Choose who can use your household board. Invited users can view and edit everything on the board; only you manage access.</p>
      <form onSubmit={invite} className={s.inviteForm}><label className={s.field}>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="someone@example.com" disabled={busy}/></label><button className={s.primary} disabled={busy}>{busy ? "Working…" : "Create invitation"}</button></form>
      <p className={s.accessHint}>Links work once, expire in seven days, and require the invited email to be verified. Send the link yourself—no extra email service is needed.</p>
      {message && <p role="status">{message}</p>}{link && <div className={s.inviteResult}><label className={s.field}>Private invitation link<input readOnly value={link} onFocus={e => e.currentTarget.select()}/></label><button className={s.secondary} onClick={() => void navigator.clipboard.writeText(link).then(() => setMessage("Invitation link copied."), () => setMessage("Select and copy the invitation link above."))}>Copy link</button><small>Keep this link private. For safety, it is only shown now; create a replacement if you lose it.</small></div>}
      <h3>People with a login</h3><ul className={s.accessRows}>{access.members?.map(m => <li key={m.id}><div><strong>{m.name}</strong><small>{m.email}{m.email ? " · " : ""}{m.role === "owner" ? "Owner" : m.active ? "Access on" : "Access off"}</small></div>{m.role !== "owner" && <button className={s.secondary} disabled={busy} onClick={() => { if (!m.active || window.confirm(`Turn off ${m.name}’s access? They will no longer be able to load or save this board. Information they have already seen cannot be taken back.`)) void change({ action: "set-access", id: m.id, active: !m.active }); }}>{m.active ? "Turn access off" : "Restore access"}</button>}</li>)}</ul>
      <h3>Recent invitations</h3>{!access.invitations?.length && <p className={s.accessHint}>No invitations yet.</p>}<ul className={s.accessRows}>{access.invitations?.map(i => { const pending = !i.acceptedAt && !i.revokedAt && Date.parse(i.expiresAt) > access.now; return <li key={i.id}><div><strong>{i.email}</strong><small>{i.acceptedAt ? "Joined" : i.revokedAt ? "Cancelled" : pending ? `Expires ${new Date(i.expiresAt).toLocaleDateString("en-AU")}` : "Expired"}</small></div>{pending && <button className={s.textButton} disabled={busy} onClick={() => void change({ action: "revoke-invite", id: i.id })}>Cancel invitation</button>}</li>; })}</ul>
    </> : access && <p>Your household owner manages invitations and login access.</p>}
    <AccountControls/>
  </section>;
}
