"use client";

import { useState, useTransition } from "react";

import { doseConsumed } from "@/app/data-lab/actions";
import { DataPanelRive } from "@/app/app/data-panel-rive";

type InjectableScript = {
  prescriptionId: string;
  pharmaceuticalName: string;
  streetName: string | null;
  strength: string | null;
  unitsLeft: string | null;
  refillAtUnitsLeft: string | null;
  tracksBslAtDose: boolean;
};

type Reading = {
  id: string;
  valueMgDl: number;
  recordedAt: string;
};

function mmol(valueMgDl: number) {
  return (valueMgDl / 18).toFixed(1);
}

function displayUnits(value: string | null) {
  return value === null ? "—" : Number(value).toFixed(2).replace(/\.00$/, "");
}

function localDateTimeValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function readingTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    timeZone: "Australia/Brisbane",
  }).format(new Date(value));
}

export function InjectableDoseSection({ scripts }: { scripts: InjectableScript[] }) {
  const [activeScript, setActiveScript] = useState<InjectableScript | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, startRecording] = useTransition();

  if (scripts.length === 0) return null;

  async function startDose(script: InjectableScript) {
    setActiveScript(null);
    setReading(null);
    setError(null);
    if (!script.tracksBslAtDose) {
      setActiveScript(script);
      return;
    }

    setLoadingId(script.prescriptionId);
    try {
      const response = await fetch("/api/dexcom/sync?background=1", { method: "POST" });
      const payload = (await response.json()) as {
        ok?: boolean;
        reading?: Reading | null;
      };
      if (!response.ok || !payload.ok) throw new Error();
      setReading(payload.reading ?? null);
      setActiveScript(script);
    } catch {
      setError("Dexcom could not refresh. You can still enter the BSL manually.");
      setActiveScript(script);
    } finally {
      setLoadingId(null);
    }
  }

  function recordDose(formData: FormData) {
    if (!activeScript) return;
    startRecording(async () => {
      await doseConsumed(activeScript.prescriptionId, formData);
      setActiveScript(null);
      setReading(null);
      setError(null);
    });
  }

  return (
    <section className="injectable-dose-section" aria-label="Injectable dosing">
      <DataPanelRive />
      <div className="dashboard-panel-content">
      <div className="dashboard-panel-heading">
        <div>
          <p className="eyebrow">Injectables</p>
          <h2>Record a dose</h2>
        </div>
        <a href="/data-lab">Manage scripts</a>
      </div>
      <p className="injectable-dose-intro">
        Injectable doses are recorded individually. BSL-tracked injections refresh Dexcom before confirming the dose.
      </p>
      <div className="injectable-dose-grid">
        {scripts.map((script) => (
          <article className="injectable-dose-card" key={script.prescriptionId}>
            <div>
              <h3>{script.pharmaceuticalName}</h3>
              <p>{script.streetName ?? script.strength ?? "Injectable medication"}</p>
              <small>{displayUnits(script.unitsLeft)} units left{script.refillAtUnitsLeft !== null ? ` · refill at ${displayUnits(script.refillAtUnitsLeft)}` : ""}</small>
            </div>
            <button type="button" className="dashboard-link" onClick={() => void startDose(script)} disabled={loadingId !== null}>
              {loadingId === script.prescriptionId ? "Refreshing Dexcom…" : "Record dose"}
            </button>
          </article>
        ))}
      </div>
      </div>
      {activeScript ? (
        <div className="injectable-dose-overlay" role="presentation">
          <section className="injectable-dose-modal" role="dialog" aria-modal="true" aria-labelledby="injectable-dose-title">
            <div className="medication-modal-heading">
              <div>
                <p className="eyebrow">Confirm injectable dose</p>
                <h3 id="injectable-dose-title">{activeScript.pharmaceuticalName}</h3>
                <p>Enter the units administered, then confirm the dose and its glucose context.</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setActiveScript(null)}>Cancel</button>
            </div>
            {activeScript.tracksBslAtDose ? (
              <div className="injectable-reading">
                {reading ? <><strong>{mmol(reading.valueMgDl)} mmol/L</strong><span>Dexcom at {readingTime(reading.recordedAt)}</span></> : <span>{error ?? "No Dexcom reading was returned. Enter the BSL manually below."}</span>}
              </div>
            ) : null}
            <form action={recordDose} className="confirmation-form">
              <label>
                Units consumed
                <input name="unitsConsumed" required inputMode="decimal" min="0.01" step="0.01" placeholder="e.g. 8" autoFocus />
              </label>
              <label>
                Dose time
                <input name="occurredAt" type="datetime-local" required defaultValue={localDateTimeValue()} />
              </label>
              {activeScript.tracksBslAtDose ? <>
                {reading ? <input type="hidden" name="dexcomReadingId" value={reading.id} /> : null}
                <label>
                  Manual BSL override <span>mmol/L — replaces the Dexcom reading above</span>
                  <input name="manualBslMmol" inputMode="decimal" min="0.1" step="0.1" placeholder={reading ? mmol(reading.valueMgDl) : "e.g. 6.0"} required={!reading} />
                </label>
              </> : null}
              <div className="modal-actions">
                <button type="submit" disabled={recording}>{recording ? "Recording dose…" : "Record dose"}</button>
                <button type="button" className="modal-close" onClick={() => setActiveScript(null)} disabled={recording}>Cancel</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
