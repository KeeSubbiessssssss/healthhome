"use client";

import { useCallback, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from "react";
import { constrainPlacement, fastenerAppearance, replaceFastener, type NotePlacement } from "@/lib/board";
import s from "./family-board.module.css";

type Gesture = { mode: "move" | "rotate" | "resize"; pointer: number; startX: number; startY: number; grabX: number; grabY: number; original: NotePlacement; active: boolean; };
type Props = { id: string; color: string; placement: NotePlacement; front: number; disabled: boolean; resizable?: boolean; palette: ReactNode; children: ReactNode; onChange: (p: NotePlacement) => Promise<boolean> };
const transform = (p: NotePlacement) => `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.angle}deg)`;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function FreeNote({ id, color, placement, front, disabled, resizable = false, palette, children, onChange }: Props) {
  const note = useRef<HTMLElement>(null);
  const current = useRef(placement);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef(0);
  const suppressClick = useRef(false);
  const pendingDrop = useRef(false);
  const departing = useRef<Set<HTMLElement>>(new Set());
  const appearance = fastenerAppearance(placement);

  const paint = useCallback(() => {
    if (note.current) { note.current.style.transform = transform(current.current); if (resizable) { note.current.style.width = `${current.current.width || 600}px`; note.current.style.height = `${current.current.height || 300}px`; } }
  }, [resizable]);
  const { x, y, angle, z, attachment, width, height } = placement;
  const { variant, offset, angle: fastenerAngle, size } = appearance;
  const layFastenerDown = useCallback(() => {
    const mount = note.current?.querySelector<HTMLElement>("[data-fastener]");
    if (!mount) return;
    mount.style.visibility = "";
    const inner = mount.firstElementChild as HTMLElement;
    if (!pendingDrop.current || reducedMotion()) { pendingDrop.current = false; return; }
    pendingDrop.current = false;
    inner.animate(attachment === "pin" ? [
      { transform: "translate3d(9px,-62px,0) rotate(24deg) scale(1.25)", opacity: 0 },
      { transform: "translate3d(1px,-5px,0) rotate(3deg) scale(1.04)", opacity: 1, offset: .72 },
      { transform: "translate3d(0,0,0) rotate(0) scale(1)", opacity: 1 },
    ] : [
      { transform: "perspective(240px) rotateY(-78deg) rotateX(25deg) translateY(-16px) scaleX(.2)", opacity: .25, clipPath: "inset(0 85% 0 0)" },
      { transform: "perspective(240px) rotateY(-22deg) rotateX(8deg) translateY(-3px) scaleX(.8)", opacity: .85, offset: .6, clipPath: "inset(0 20% 0 0)" },
      { transform: "none", opacity: 1, clipPath: "inset(0)" },
    ], { duration: attachment === "pin" ? 260 : 360, easing: "cubic-bezier(.16,1,.3,1)" });
  }, [attachment]);
  useLayoutEffect(() => {
    if (!gesture.current) {
      current.current = { x, y, angle, z, attachment, ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}), fastener: { variant, offset, angle: fastenerAngle, size } };
      paint(); layFastenerDown();
    }
  }, [x, y, angle, z, attachment, width, height, variant, offset, fastenerAngle, size, layFastenerDown, paint]);
  useLayoutEffect(() => {
    const debris = departing.current;
    return () => { cancelAnimationFrame(frame.current); for (const el of debris) el.remove(); debris.clear(); };
  }, []);

  // Only the fastener becomes debris. The paper itself is never cloned.
  function releaseFastener() {
    const el = note.current;
    const mount = el?.querySelector<HTMLElement>("[data-fastener]");
    if (!el || !mount || mount.style.visibility === "hidden") return;
    if (reducedMotion()) { mount.style.visibility = "hidden"; return; }
    const stage = el.parentElement!; const stageBounds = stage.getBoundingClientRect();
    const bounds = mount.getBoundingClientRect(); const scale = stageBounds.width / stage.offsetWidth;
    const debris = mount.cloneNode(true) as HTMLElement;
    debris.removeAttribute("data-fastener"); debris.setAttribute("data-departing-fastener", "true"); debris.setAttribute("aria-hidden", "true");
    debris.classList.add(s.departingFastener);
    const f = fastenerAppearance(current.current);
    Object.assign(debris.style, { left: `${(bounds.left - stageBounds.left) / scale}px`, top: `${(bounds.top - stageBounds.top) / scale}px`, width: `${mount.offsetWidth}px`, height: `${mount.offsetHeight}px`, transform: `rotate(${current.current.angle + f.angle}deg)`, zIndex: String(front + 1), visibility: "visible" });
    stage.appendChild(debris); departing.current.add(debris); mount.style.visibility = "hidden";
    const initial = `rotate(${current.current.angle + f.angle}deg)`;
    const sign = f.angle < 0 ? -1 : 1;
    const animation = debris.animate(current.current.attachment === "pin" ? [
      { transform: `${initial} translate(0,0)`, opacity: 1 },
      { transform: `${initial} translate(${sign * 8}px,-14px) rotate(20deg)`, opacity: 1, offset: .16 },
      { transform: `${initial} translate(${sign * 37}px,170px) rotate(${sign * 245}deg)`, opacity: 0 },
    ] : [
      { transform: `${initial} perspective(240px) rotateY(0)`, opacity: 1 },
      { transform: `${initial} perspective(240px) rotateY(-95deg) rotate(-20deg) translate(-12px,-7px)`, opacity: .9, offset: .55 },
      { transform: `${initial} translate(${sign * 55}px,105px) rotate(${sign * 85}deg) scale(.7)`, opacity: 0 },
    ], { duration: current.current.attachment === "pin" ? 520 : 560, easing: "cubic-bezier(.3,0,.75,.45)", fill: "forwards" });
    void animation.finished.catch(() => {}).finally(() => { debris.remove(); departing.current.delete(debris); });
  }

  function start(event: ReactPointerEvent<HTMLElement>, mode: Gesture["mode"]) {
    if (disabled || event.button !== 0 || !event.isPrimary) return;
    const target = event.target as HTMLElement;
    if (mode === "move" && target.closest("button,a,input,select,textarea,label,summary,details,[data-note-scroll]") && !target.closest("[data-note-grip]")) return;
    const el = note.current!;
    const stage = el.parentElement!; const rect = stage.getBoundingClientRect(); const scale = rect.width / stage.offsetWidth;
    gesture.current = { mode, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, grabX: (event.clientX - rect.left) / scale - current.current.x, grabY: (event.clientY - rect.top) / scale - current.current.y, original: { ...current.current }, active: false };
    suppressClick.current = false;
    el.setPointerCapture(event.pointerId);
    event.stopPropagation();
  }
  function move(event: ReactPointerEvent<HTMLElement>) {
    const g = gesture.current; const el = note.current;
    if (!g || !el || event.pointerId !== g.pointer) return;
    const dx = event.clientX - g.startX; const dy = event.clientY - g.startY;
    if (!g.active && Math.hypot(dx, dy) < 4) return;
    if (!g.active) { releaseFastener(); g.active = true; el.dataset.lifted = "true"; el.style.zIndex = String(front); el.style.willChange = "transform"; }
    event.preventDefault();
    if (g.mode === "move") {
      const stage = el.parentElement!; const rect = stage.getBoundingClientRect(); const scale = rect.width / stage.offsetWidth;
      current.current = constrainPlacement({ ...g.original, x: (event.clientX - rect.left) / scale - g.grabX, y: (event.clientY - rect.top) / scale - g.grabY, z: front });
      const viewport = stage.closest<HTMLElement>("[data-board-viewport]");
      if (viewport) { const bounds = viewport.getBoundingClientRect(); if (event.clientY > bounds.bottom - 35) viewport.scrollTop += 10; else if (event.clientY < bounds.top + 35) viewport.scrollTop -= 10; if (event.clientX > bounds.right - 35) viewport.scrollLeft += 8; else if (event.clientX < bounds.left + 35) viewport.scrollLeft -= 8; }
    } else if (g.mode === "resize") {
      const stage = el.parentElement!; const scale = stage.getBoundingClientRect().width / stage.offsetWidth;
      const angle = g.original.angle * Math.PI / 180;
      const localX = (dx * Math.cos(angle) + dy * Math.sin(angle)) / scale;
      const localY = (-dx * Math.sin(angle) + dy * Math.cos(angle)) / scale;
      current.current = constrainPlacement({ ...g.original, width: (g.original.width || 600) + localX, height: (g.original.height || 300) + localY, z: front });
    } else if (g.mode === "rotate") {
      current.current = constrainPlacement({ ...g.original, angle: g.original.angle + dx / 4, z: front });
    }
    if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; paint(); });
  }
  function clear() {
    const el = note.current;
    if (el) { delete el.dataset.lifted; el.style.removeProperty("will-change"); }
    gesture.current = null; cancelAnimationFrame(frame.current); frame.current = 0;
  }
  function finish(event: ReactPointerEvent<HTMLElement>) {
    const g = gesture.current; if (!g || g.pointer !== event.pointerId) return;
    suppressClick.current = g.active;
    if (g.active) window.setTimeout(() => { suppressClick.current = false; }, 0);
    const changed = g.active;
    const original = g.original;
    clear(); paint();
    if (changed) {
      current.current = replaceFastener(current.current); pendingDrop.current = true;
      void onChange(current.current).then(ok => { if (!ok) { current.current = original; paint(); layFastenerDown(); } });
    }
  }
  function cancel() { if (gesture.current) current.current = gesture.current.original; clear(); paint(); pendingDrop.current = true; layFastenerDown(); }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 1 : 10;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (event.key === "Escape") { cancel(); return; }
    if (!delta || disabled) return;
    event.preventDefault(); const original = current.current;
    releaseFastener(); pendingDrop.current = true;
    current.current = replaceFastener(constrainPlacement({ ...original, x: original.x + delta[0], y: original.y + delta[1], z: front })); paint();
    void onChange(current.current).then(ok => { if (!ok) { current.current = original; paint(); } });
  }
  const fastenerStyle = { left: `${appearance.offset}%`, transform: `rotate(${appearance.angle}deg)`, "--tape-width": `${appearance.size}px` } as CSSProperties;
  return <article ref={note} data-card-id={id} data-attachment={placement.attachment} className={`${s.paper} ${s.freeNote} ${s[color]} ${resizable ? s.schedulePaper : ""}`} style={{ transform: transform(placement), zIndex: placement.z, ...(resizable ? { width: placement.width || 600, height: placement.height || 300 } : {}) }}
    onPointerDown={event => start(event, "move")} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={() => { if (gesture.current) cancel(); }}
    onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
    {placement.attachment === "pin" && <span data-fastener data-variant={appearance.variant} className={s.realPin} style={fastenerStyle} aria-hidden="true"><span/></span>}
    {placement.attachment === "tape" && <span data-fastener data-variant={appearance.variant} className={s.realTape} style={fastenerStyle} aria-hidden="true"><span/></span>}
    <div className={s.freeTools}>
      <button type="button" data-note-grip className={s.noteGrip} disabled={disabled} aria-label="Move note. Drag freely or use arrow keys" title="Drag anywhere · Arrow keys move · Shift for fine movement" onKeyDown={keyboard}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01" strokeWidth="4"/></svg></button>
      <div>{palette}</div>
    </div>
    {resizable ? <div className={s.scheduleNoteBody} data-note-scroll>{children}</div> : children}
    {resizable && <button type="button" className={s.resizeNote} aria-label="Resize schedule note" title="Drag to resize · Arrow keys adjust size · Shift for fine adjustments" disabled={disabled} onPointerDown={event => start(event, "resize")} onKeyDown={event => {
      if (disabled) return;
      const step = event.shiftKey ? 2 : 20; const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      if (!delta) return; event.preventDefault(); const original = current.current;
      current.current = constrainPlacement({ ...original, width: (original.width || 600) + delta[0], height: (original.height || 300) + delta[1], z: front }); paint();
      void onChange(current.current).then(ok => { if (!ok) { current.current = original; paint(); } });
    }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M9 21 21 9M15 21l6-6"/></svg></button>}
    <button className={s.rotateNote} aria-label="Rotate note" title="Drag to rotate · Enter to turn 5 degrees" disabled={disabled} onPointerDown={event => start(event, "rotate")} onClick={event => { if (event.detail === 0) (() => { releaseFastener(); pendingDrop.current = true; void onChange(replaceFastener(constrainPlacement({ ...placement, angle: placement.angle >= 20 ? -20 : placement.angle + 5 }))); })(); }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10a8 8 0 1 0-2 8M20 4v6h-6"/></svg></button>
  </article>;
}
