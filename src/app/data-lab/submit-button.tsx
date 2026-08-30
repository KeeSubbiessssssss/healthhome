"use client";

import { useFormStatus } from "react-dom";

export function SaveMedicationButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "Saving medication…" : "Save Preview medication"}
    </button>
  );
}
