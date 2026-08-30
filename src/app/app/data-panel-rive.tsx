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

    const sendPointerEvent = (type: "mouseover" | "mouseout") => {
      const bounds = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          clientX: bounds.left + bounds.width / 2,
          clientY: bounds.top + bounds.height / 2,
        }),
      );
    };

    // The glass artwork's state machine has pointer listeners, but the canvas
    // sits below readable panel content. Forward the panel hover to that canvas.
    const playHover = () => sendPointerEvent("mouseover");
    const playIdle = () => sendPointerEvent("mouseout");

    panel.addEventListener("pointerenter", playHover);
    panel.addEventListener("pointerleave", playIdle);
    return () => {
      panel.removeEventListener("pointerenter", playHover);
      panel.removeEventListener("pointerleave", playIdle);
    };
  }, [rive]);

  return (
    <div ref={frameRef} className="data-panel-rive" aria-hidden="true">
      <RiveComponent />
    </div>
  );
}
