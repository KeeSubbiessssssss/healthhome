"use client";

import { useEffect, useRef } from "react";
import { Fit, Layout, useRive } from "@rive-app/react-webgl2";
import styles from "./data-panel-rive.module.css";

export function DataPanelRive() {
  const frameRef = useRef<HTMLDivElement>(null);
  const { RiveComponent, rive } = useRive(
    {
      src: "/rive/translucent-window.riv",
      stateMachine: "Default",
      autoplay: true,
      layout: new Layout({ fit: Fit.Cover }),
      automaticallyHandleEvents: true,
      shouldDisableRiveListeners: false,
    },
    { shouldResizeCanvasToContainer: true },
  );

  useEffect(() => {
    const frame = frameRef.current;
    const panel = frame?.parentElement;
    if (!panel || !rive) return;

    const canvas = frame.querySelector("canvas");
    if (!canvas) return;

    const sendPointerEvent = (
      type: "mouseover" | "mousemove" | "mouseout",
      event: PointerEvent,
    ) => {
      canvas.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          clientX: event.clientX,
          clientY: event.clientY,
        }),
      );
    };

    // The glass artwork's state machine has pointer listeners, but the canvas
    // sits below readable panel content. Forward the panel hover to that canvas.
    const playHover = (event: PointerEvent) => {
      frame.setAttribute("data-hover", "true");
      sendPointerEvent("mouseover", event);
    };
    const trackPointer = (event: PointerEvent) => sendPointerEvent("mousemove", event);
    const playIdle = (event: PointerEvent) => {
      frame.removeAttribute("data-hover");
      sendPointerEvent("mouseout", event);
    };

    panel.addEventListener("pointerenter", playHover);
    panel.addEventListener("pointermove", trackPointer);
    panel.addEventListener("pointerleave", playIdle);
    return () => {
      panel.removeEventListener("pointerenter", playHover);
      panel.removeEventListener("pointermove", trackPointer);
      panel.removeEventListener("pointerleave", playIdle);
      frame.removeAttribute("data-hover");
    };
  }, [rive]);

  return (
    <div ref={frameRef} className={`data-panel-rive ${styles.scaledPanelRive}`} aria-hidden="true">
      <RiveComponent />
    </div>
  );
}
