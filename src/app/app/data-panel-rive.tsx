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

    const playHover = () => rive.play("WindowUp");
    const playIdle = () => rive.play("WindowIdle");

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
