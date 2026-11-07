"use client";
import { useEffect, useRef, useState } from "react";
import { parseBoard, type BoardState } from "@/lib/board";
import s from "./family-board.module.css";

const liveOrigin = "https://pikensteiner.me";
const localOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
type Props = { local: boolean; state: BoardState; busy: boolean; onImport: (incoming: BoardState) => Promise<boolean> };
export function BoardTransfer({ local, state, busy, onImport }: Props) {
  const target = useRef<Window | null>(null);
  const snapshot = useRef<BoardState | null>(null);
  const [incoming, setIncoming] = useState<BoardState | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    const importing = new URLSearchParams(window.location.search).get("importLocal") === "1";
    function receive(event: MessageEvent) {
      if (local) {
        if (event.origin === liveOrigin && event.source === target.current && event.data?.type === "healthhome-import-ready" && snapshot.current) {
          target.current?.postMessage({ type: "healthhome-local-board", state: snapshot.current }, liveOrigin);
          setMessage("Your live tab is ready. Review the counts there and bring the board online.");
        }
        return;
      }
      if (!importing || !window.opener || event.source !== window.opener || !localOrigins.includes(event.origin) || event.data?.type !== "healthhome-local-board") return;
      try { setIncoming(parseBoard(event.data.state)); setError(""); }
      catch { setError("The local board could not be read. Your saved boards have not been changed."); }
    }
    window.addEventListener("message", receive);
    if (!local && importing) {
      async function prepare() {
        const r = await fetch("/api/household", { cache: "no-store" }); const access = await r.json();
        if (!r.ok || access.role !== "owner") throw new Error("Sign in as the household owner to bring in the local board.");
        setRequested(true);
        if (!window.opener) throw new Error("Open this page using the transfer button in your local board.");
        const sourceOrigin = new URLSearchParams(window.location.search).get("sourceOrigin") || localOrigins[0];
        if (!localOrigins.includes(sourceOrigin)) throw new Error("Open this page from your local HealthHome board.");
        window.opener.postMessage({ type: "healthhome-import-ready" }, sourceOrigin);
      }
      void prepare().catch(e => setError(e.message));
    }
    return () => window.removeEventListener("message", receive);
  }, [local]);
  function openLive() {
    setError(""); snapshot.current = structuredClone(state);
    target.current = window.open(`${liveOrigin}/app?view=settings&importLocal=1&sourceOrigin=${encodeURIComponent(window.location.origin)}`, "_blank");
    if (!target.current) setError("Allow this site to open the live HealthHome tab, then try again.");
    else setMessage("Opening your live household. Keep this local tab open until the transfer is finished.");
  }
  if (!local && !requested && !error) return null;
  return <section className={s.transferPanel} aria-labelledby="board-transfer-title"><h2 id="board-transfer-title">{local ? "Bring this board online" : "Your local board, ready to move in."}</h2>
    {local ? <><p>Bring these people, pets, lists, presents, medication records and note positions into your live household. Your original local copy stays here.</p><button className={s.primary} disabled={busy} onClick={openLive}>Open live board to transfer</button></> : incoming ? <><p>{incoming.profiles.filter(p => p.kind === "person").length} family members · {incoming.profiles.filter(p => p.kind === "pet").length} pets · {incoming.lists.length} lists · {incoming.gifts.length} presents · {incoming.medications.length} medication records</p><p>Existing live records are kept. Imported notes keep their colours and positions. If the same record differs between boards, the import stops for review.</p><button className={s.primary} disabled={busy} onClick={() => void onImport(incoming).then(ok => { if (ok) { setIncoming(null); setMessage("Your local board is now saved in your live household. The original local copy is untouched."); window.history.replaceState(null, "", "/app?view=settings"); } })}>{busy ? "Bringing your board online…" : "Bring local board into this household"}</button></> : !message && <p>Waiting for the local board. Keep both tabs open.</p>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className={s.error}>{error}</p>}
  </section>;
}
