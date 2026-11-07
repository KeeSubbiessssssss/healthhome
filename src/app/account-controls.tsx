"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import s from "./app/family-board.module.css";

export function AccountControls({ email, verify = false }: { email?: string; verify?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function act(signOut: boolean) {
    setBusy(true); setMessage("");
    try {
      const result = signOut ? await authClient.signOut() : await authClient.sendVerificationEmail({ email: email!, callbackURL: `${window.location.origin}/join` });
      if (result.error) throw new Error(result.error.message || "Please try again.");
      if (signOut) { router.replace("/auth/sign-in"); router.refresh(); }
      else setMessage("Verification email sent. Follow its link, then sign in again.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <div className={s.accountControls}>{verify && email && <button className={s.secondary} disabled={busy} onClick={() => void act(false)}>Send verification email</button>}<button className={s.textButton} disabled={busy} onClick={() => void act(true)}>Sign out</button>{message && <p role="status">{message}</p>}</div>;
}
