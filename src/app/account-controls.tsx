"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import s from "./app/family-board.module.css";

export function AccountControls({ email, verify = false }: { email?: string; verify?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  async function act(signOut: boolean) {
    setBusy(true); setMessage("");
    try {
      const result = signOut ? await authClient.signOut() : await authClient.emailOtp.sendVerificationOtp({ email: email!, type: "email-verification" });
      if (result.error) throw new Error(result.error.message || "Please try again.");
      if (signOut) { router.replace("/auth/sign-in"); router.refresh(); }
      else setMessage("Verification code sent. Enter the six-digit code from your email below.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await authClient.emailOtp.verifyEmail({ email: email!, otp: code });
      if (result.error) throw new Error(result.error.message || "The code could not be verified. Try the latest code in your email.");
      await authClient.signOut(); router.replace("/auth/sign-in"); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <div className={s.accountControls}>{verify && email && <><form onSubmit={confirm} className={s.verificationForm}><label className={s.field}>Verification code<input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required placeholder="Six-digit email code"/></label><button className={s.primary} disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify email & sign in"}</button></form><button className={s.secondary} disabled={busy} onClick={() => void act(false)}>Send a new code</button></>}<button className={s.textButton} disabled={busy} onClick={() => void act(true)}>Sign out</button>{message && <p role="status">{message}</p>}</div>;
}
