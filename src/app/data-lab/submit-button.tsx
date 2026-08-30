"use client";

import { useFormStatus } from "react-dom";

export function SaveMedicationButton({
  idleLabel = "Save Preview medication",
  pendingLabel = "Saving medication…",
}: {
  idleLabel?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} onClick={(event) => {
      if (event.currentTarget.form?.checkValidity()) document.querySelector<HTMLElement>(":popover-open")?.hidePopover();
    }}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
