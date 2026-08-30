"use client";

import { useRive } from "@rive-app/react-webgl2";

export function DataPanelRive() {
  const { RiveComponent } = useRive(
    {
      src: "/rive/translucent-window.riv",
      artboard: "Default",
      animations: "WindowIdle",
      autoplay: true,
    },
    { shouldResizeCanvasToContainer: true },
  );

  return (
    <div className="data-panel-rive" aria-hidden="true">
      <RiveComponent />
    </div>
  );
}
