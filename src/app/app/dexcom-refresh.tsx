"use client";

import { StateMachineInputType, useRive } from "@rive-app/react-webgl2";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SyncEvent = { type?: "progress" | "complete" | "error"; percent?: number; message?: string; code?: string };

function LiquidLoadingRive({ progress }: { progress: number }) {
  const { RiveComponent, rive } = useRive({ src: "/rive/liquid-loading-screen.riv", artboard: "refresh", stateMachines: "SM", autoplay: true }, { shouldResizeCanvasToContainer: true });
  const started = useRef(false);

  useEffect(() => {
    const inputs = rive?.stateMachineInputs("SM") ?? [];
    for (const input of inputs) {
      if (input.name === "start" && input.type === StateMachineInputType.Trigger && !started.current) {
        input.fire();
        started.current = true;
      }
      if (input.name === "loading" && input.type === StateMachineInputType.Boolean) input.value = true;
      if (input.name === "progress" && input.type === StateMachineInputType.Number) input.value = progress;
    }
  }, [progress, rive]);

  return <RiveComponent className="dexcom-rive" aria-label="Dexcom is refreshing" />;
}

export function DexcomRefresh({ connected }: { connected: boolean }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const sync = useCallback(async () => {
    if (!connected || inFlight.current) return;
    inFlight.current = true;
    setProgress(0);
    setSyncing(true);
    setMessage("Preparing Dexcom refresh");
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const response = await fetch("/api/dexcom/sync?stream=1", { method: "POST", headers: { accept: "text/event-stream" } });
      if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("Dexcom stream could not start.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failed = false;
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const rawEvent of events) {
          const data = rawEvent.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
          if (!data) continue;
          const event = JSON.parse(data) as SyncEvent;
          if (event.message) setMessage(event.message);
          if (typeof event.percent === "number") setProgress(event.percent);
          if (event.type === "error") failed = true;
        }
        if (done) break;
      }
      if (failed) setMessage("Dexcom could not refresh. You can try again from here.");
      else router.refresh();
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
    {syncing ? <div className="dexcom-refresh-loader"><LiquidLoadingRive progress={progress} /><span>{message ?? "Dexcom refresh in progress"} · {progress}%</span></div> : null}
    {message ? <p>{message}</p> : null}
  </div>;
}
