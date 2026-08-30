"use client";

import { useEffect, useRef } from "react";
import { useRive } from "@rive-app/react-webgl2";

export function DataPanelRive() {
  const frameRef = useRef<HTMLDivElement>(null);
  const { RiveComponent, rive } = useRive(
    {
      src: "/rive/translucent-window.riv",
      artboard: "Default",
      stateMachines: "Window",
      autoplay: true,
      automaticallyHandleEvents: true,
      shouldDisableRiveListeners: false,
    },
    { shouldResizeCanvasToContainer: true },
  );

  useEffect(() => {
    const panel = frameRef.current?.parentElement;
    if (!panel || !rive) return;

    const canvas = frameRef.current?.querySelector("canvas");
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
    const playHover = (event: PointerEvent) => sendPointerEvent("mouseover", event);
    const trackPointer = (event: PointerEvent) => sendPointerEvent("mousemove", event);
    const playIdle = (event: PointerEvent) => sendPointerEvent("mouseout", event);

    panel.addEventListener("pointerenter", playHover);
    panel.addEventListener("pointermove", trackPointer);
    panel.addEventListener("pointerleave", playIdle);
    return () => {
      panel.removeEventListener("pointerenter", playHover);
      panel.removeEventListener("pointermove", trackPointer);
      panel.removeEventListener("pointerleave", playIdle);
    };
  }, [rive]);

  return (
    <div ref={frameRef} className="data-panel-rive" aria-hidden="true">
      <RiveComponent />
    </div>
  );
}
