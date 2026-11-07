"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccountControls } from "@/app/account-controls";
import s from "@/app/app/family-board.module.css";

const pendingKey = "healthhome-pending-invitation";
const subscribe = (change: () => void) => { window.addEventListener("hashchange", change); return () => window.removeEventListener("hashchange", change); };
const snapshot = () => { try { return window.location.hash.slice(1) || sessionStorage.getItem(pendingKey) || ""; } catch { return "storage-unavailable"; } };
export function JoinInvitation({ user }: { user: { email: string; emailVerified: boolean } | null }) {
  const router = useRouter();
  const token = useSyncExternalStore(subscribe, snapshot, () => null);
  const valid = typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (token === "") { router.replace("/app"); return; }
    if (!valid) return;
    try { sessionStorage.setItem(pendingKey, token!); window.history.replaceState(null, "", "/join"); } catch { /* The link can be reopened after sign-in if storage is unavailable. */ }
  }, [token, valid, router]);
  async function accept() {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }); const data = await r.json();
      if (!r.ok) throw new Error(data.error || "This invitation could not be accepted.");
      sessionStorage.removeItem(pendingKey); router.replace("/app"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  if (token === null || token === "") return <p>Opening your invitation…</p>;
  if (!valid) return <p role="alert">This invitation could not be opened. Ask for a new link and allow this site to use browser storage.</p>;
  return <>{error && <p className={s.error} role="alert">{error}</p>}{token && <><p>You’ve been invited to a private household board. Members share its lists, presents and medication records.</p>{!user ? <><p>Sign in or create an account with the email address the owner invited, then return here to join.</p><Link className={s.primary} href="/auth/sign-in">Sign in to continue</Link></> : <><p>Signed in as <strong>{user.email}</strong>.</p>{!user.emailVerified ? <p>Verify this email address before joining.</p> : <button className={s.primary} disabled={busy} onClick={() => void accept()}>{busy ? "Joining…" : "Join household"}</button>}<AccountControls email={user.email} verify={!user.emailVerified}/><p><Link href="/app" onClick={() => { try { sessionStorage.removeItem(pendingKey); } catch {} }}>Back to HealthHome</Link></p></>}</>}</>;
}
