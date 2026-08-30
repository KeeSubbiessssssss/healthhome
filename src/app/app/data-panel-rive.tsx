"use client";

import { useRive } from "@rive-app/react-webgl2";

export function DataPanelRive() {
  const { RiveComponent, rive } = useRive(
    {
      src: "/rive/translucent-window.riv",
      artboard: "Default",
      stateMachines: "Window",
      autoplay: true,
      automaticallyHandleEvents: true,
    },
    { shouldResizeCanvasToContainer: true },
  );

  return (
    <div className="data-panel-rive" aria-hidden="true">
      <RiveComponent
        onPointerEnter={() => rive?.play("WindowUp")}
        onPointerLeave={() => rive?.play("WindowIdle")}
      />
    </div>
  );
}
