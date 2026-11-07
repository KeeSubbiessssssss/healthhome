"use client";
import { useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import s from "./family-board.module.css";

type Props = { children: ReactNode; height: number; removed: { id: string; title: string }[]; onRestore: (id: string) => void; onAdd: () => void; disabled: boolean };
export function BoardCanvas({ children, height, removed, onRestore, onAdd, disabled }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [tray, setTray] = useState(false);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    let fitted = false;
    const observer = new ResizeObserver(() => { if (!fitted && viewport.current) { fitted = true; setZoom(Math.max(.35, Math.min(1, (viewport.current.clientWidth - 16) / 1200))); } });
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  function fit() { if (viewport.current) setZoom(Math.max(.35, Math.min(1, (viewport.current.clientWidth - 16) / 1200))); }
  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.button !== 0 || !viewport.current) return;
    pan.current = { x: event.clientX, y: event.clientY, left: viewport.current.scrollLeft, top: viewport.current.scrollTop };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  return <section className={s.canvasWorkstation} aria-label="Free movement pinboard">
    <div className={s.canvasDock}><span className={s.canvasHint}>Pick up. Turn. Pin down.</span><div className={s.zoomControls}><button type="button" onClick={() => setZoom(z => Math.max(.35, z - .1))} aria-label="Zoom out">−</button><output aria-label="Board zoom">{Math.round(zoom * 100)}%</output><button type="button" onClick={() => setZoom(z => Math.min(1.3, z + .1))} aria-label="Zoom in">+</button><button type="button" onClick={fit}>Fit</button></div><div className={s.canvasDockActions}><button type="button" onClick={onAdd} disabled={disabled}>New paper</button><button type="button" aria-expanded={tray} onClick={() => setTray(v => !v)}>Paper tray{removed.length ? ` (${removed.length})` : ""}</button></div></div>
    {tray && <div className={s.paperTray}><strong>Put aside, never lost.</strong><p>Torn-off notes keep their contents here.</p>{removed.length ? removed.map(item => <button type="button" key={item.id} disabled={disabled} onClick={() => onRestore(item.id)}><span>{item.title}</span><span>Put back</span></button>) : <span className={s.emptyTray}>Your tray is empty. Pull a note’s lower corner to put it away.</span>}</div>}
    <div ref={viewport} data-board-viewport className={s.canvasViewport} tabIndex={0} aria-label="Free pinboard canvas. Scroll to explore; drag blank space to pan.">
      <div className={s.canvasSizer} style={{ width: 1200 * zoom, height: height * zoom }}>
        <div className={s.freeCanvas} style={{ width: 1200, height, transform: `scale(${zoom})` }} onPointerDown={startPan} onPointerMove={event => { if (pan.current && viewport.current) { viewport.current.scrollLeft = pan.current.left - (event.clientX - pan.current.x); viewport.current.scrollTop = pan.current.top - (event.clientY - pan.current.y); } }} onPointerUp={() => { pan.current = null; }} onPointerCancel={() => { pan.current = null; }} onLostPointerCapture={() => { pan.current = null; }}>
          {children}
          <div className={s.canvasInstructions}>A little space to make your own.<small>Drag freely · Turn the top corner · Pull the bottom corner to tear off</small></div>
        </div>
      </div>
    </div>
  </section>;
}
