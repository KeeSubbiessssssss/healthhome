"use client";

import Rive from "@rive-app/react-webgl2";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SyncResponse = { ok?: boolean; code?: string };

export function DexcomRefresh({ connected }: { connected: boolean }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sync = useCallback(async () => {
    if (!connected || inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);
    setMessage("Refreshing Dexcom in the background. You can keep using HealthHome.");
    try {
      const response = await fetch("/api/dexcom/sync?background=1", { method: "POST", headers: { accept: "application/json" } });
      const result = await response.json().catch(() => ({})) as SyncResponse;
      if (!response.ok || !result.ok) {
        setMessage(result.code === "needs-reauth" ? "Dexcom needs to be connected again before it can refresh." : "Dexcom could not refresh. You can try again from here.");
        return;
      }
      setMessage("Dexcom is up to date.");
      router.refresh();
    } catch {
      setMessage("Dexcom could not refresh. You can try again from here.");
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [connected, router]);

  useEffect(() => {
    const start = window.setTimeout(() => { void sync(); }, 0);
    return () => window.clearTimeout(start);
  }, [sync]);

  if (!connected) return <a className="dashboard-link" href="/api/dexcom/connect">Connect Dexcom</a>;

  return <div className="dexcom-refresh" aria-live="polite">
    <button type="button" className="dashboard-link" onClick={() => void sync()} disabled={syncing}>{syncing ? "Refreshing Dexcom" : "Sync Dexcom"}</button>
    {syncing ? <div className="dexcom-refresh-loader"><Rive className="dexcom-rive" src="/rive/liquid-loading-screen.riv" animations="loading" shouldDisableRiveListeners aria-label="Dexcom is refreshing" /><span>Dexcom refresh in progress</span></div> : null}
    {message ? <p>{message}</p> : null}
  </div>;
}
