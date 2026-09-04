// Tempra v0.7.0 — 2026-09-04 13:20
//
// Impostazioni (spec 7.1). Ogni azione distruttiva ha una conferma esplicita,
// e "Ricomincia da zero" ne ha due (7.2).

import { useEffect, useState } from 'react';
import { DISCLAIMER, UI_STRINGS } from '../../data/strings.it.js';
import { VERSION } from '../../version.js';
import {
  BackupError,
  clearUserData,
  downloadBackup,
  readBackupFile,
  restoreBackup,
  summarizeBackup,
} from '../../db/backup.js';
import { getSettings, newId, now, saveProgram, saveSettings } from '../../db/repo.js';
import { generateProgram } from '../../engine/generate.js';
import { useAppState } from '../hooks/useAppState.js';
import { navigate, ROUTES } from '../hooks/useHashRoute.js';
import BottomSheet from '../components/BottomSheet.jsx';

const THEMES = [
  { value: 'system', label: UI_STRINGS.settings.themeSystem },
  { value: 'light', label: UI_STRINGS.settings.themeLight },
  { value: 'dark', label: UI_STRINGS.settings.themeDark },
];

export default function Settings() {
  const { loading, profile, program, catalog, reload } = useAppState();
  const [settings, setSettings] = useState(null);
  const [pending, setPending] = useState(null); // 'import' | 'regenerate' | 'reset'
  const [importData, setImportData] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [resetConfirmed, setResetConfirmed] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const update = async (patch) => {
    const next = await saveSettings(patch);
    setSettings(next);
    if (patch.theme) {
      if (patch.theme === 'system') delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = patch.theme;
    }
  };

  if (loading || !settings) return <p className="muted">{UI_STRINGS.app.loading}</p>;

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const backup = await readBackupFile(file);
      setImportData(backup);
      setPending('import');
    } catch (problem) {
      setError(
        problem instanceof BackupError ? problem.message : UI_STRINGS.settings.importFailed
      );
    }
  };

  const doImport = async () => {
    await restoreBackup(importData);
    setPending(null);
    setImportData(null);
    setMessage(UI_STRINGS.settings.importDone);
    await reload();
  };

  const doRegenerate = async (keepWeights) => {
    // Nuovo mesociclo: stessi parametri, seed diverso, così gli esercizi main
    // ruotano (spec 3.6).
    const next = generateProgram(profile, catalog, Math.floor(Math.random() * 2 ** 31), {
      id: newId(),
      createdAt: now(),
    });

    if (keepWeights && program) {
      const previous = new Map();
      for (const day of program.days) {
        for (const slot of day.slots) {
          if (slot.workingWeightKg !== null) previous.set(slot.exerciseId, slot);
        }
      }
      for (const day of next.days) {
        for (const slot of day.slots) {
          const old = previous.get(slot.exerciseId);
          if (!old) continue;
          slot.workingWeightKg = old.workingWeightKg;
          slot.state = 'calibrated';
        }
      }
    }

    if (program) await saveProgram({ ...program, status: 'completed' });
    await saveProgram(next);
    setPending(null);
    await reload();
    navigate(ROUTES.HOME);
  };

  const doReset = async () => {
    await clearUserData();
    setPending(null);
    setResetConfirmed(false);
    window.location.hash = '#/';
    window.location.reload();
  };

  return (
    <div className="stack">
      <h1>{UI_STRINGS.nav.settings}</h1>

      {message && <p className="warning">{message}</p>}
      {error && <p className="warning">{error}</p>}

      <section className="card stack">
        <h2>{UI_STRINGS.settings.timer}</h2>
        <Toggle
          label={UI_STRINGS.settings.sound}
          checked={settings.restTimerSound}
          onChange={(value) => update({ restTimerSound: value })}
        />
        <Toggle
          label={UI_STRINGS.settings.vibration}
          checked={settings.restTimerVibrate}
          onChange={(value) => update({ restTimerVibrate: value })}
        />
        <Toggle
          label={UI_STRINGS.settings.autoStart}
          checked={settings.autoStartRestTimer}
          onChange={(value) => update({ autoStartRestTimer: value })}
        />
      </section>

      <section className="card stack">
        <h2>{UI_STRINGS.settings.theme}</h2>
        <div className="choice choice--compact">
          {THEMES.map((theme) => (
            <button
              key={theme.value}
              type="button"
              className="choice__option"
              aria-pressed={settings.theme === theme.value}
              onClick={() => update({ theme: theme.value })}
            >
              <span className="choice__title">{theme.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2>{UI_STRINGS.settings.data}</h2>
        <button
          type="button"
          className="button button--ghost"
          onClick={async () => setMessage(`${UI_STRINGS.settings.exported} ${await downloadBackup()}`)}
        >
          {UI_STRINGS.settings.exportBackup}
        </button>

        <label className="button button--ghost file">
          {UI_STRINGS.settings.importBackup}
          <input type="file" accept="application/json,.json" onChange={onFile} />
        </label>

        <button
          type="button"
          className="button button--ghost"
          onClick={() => setPending('regenerate')}
          disabled={!profile}
        >
          {UI_STRINGS.settings.regenerate}
        </button>

        <button
          type="button"
          className="button button--danger"
          onClick={() => setPending('reset')}
        >
          {UI_STRINGS.settings.resetAll}
        </button>
      </section>

      <section className="card stack">
        <h2>{DISCLAIMER.title}</h2>
        {DISCLAIMER.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 24)} className="muted">
            {paragraph}
          </p>
        ))}
        {profile?.disclaimerAcceptedAt && (
          <p className="muted num">
            {UI_STRINGS.settings.acceptedOn} {profile.disclaimerAcceptedAt.slice(0, 10)}
          </p>
        )}
      </section>

      <section className="card stack">
        <h2>{UI_STRINGS.settings.about}</h2>
        <p className="row">
          <span className="muted">{UI_STRINGS.app.version}</span>
          <strong className="num">{VERSION}</strong>
        </p>
        <p className="muted">{UI_STRINGS.settings.licenseBody}</p>
        <p className="muted">{UI_STRINGS.settings.assetsBody}</p>
      </section>

      <BottomSheet
        open={pending === 'import'}
        title={UI_STRINGS.settings.importTitle}
        onClose={() => setPending(null)}
      >
        {importData && <ImportSummary backup={importData} />}
        <button type="button" className="button button--danger" onClick={doImport}>
          {UI_STRINGS.settings.importConfirm}
        </button>
      </BottomSheet>

      <BottomSheet
        open={pending === 'regenerate'}
        title={UI_STRINGS.settings.regenerateTitle}
        onClose={() => setPending(null)}
      >
        <p>{UI_STRINGS.settings.regenerateBody}</p>
        <button
          type="button"
          className="button button--primary"
          onClick={() => doRegenerate(true)}
        >
          {UI_STRINGS.settings.regenerateKeep}
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => doRegenerate(false)}
        >
          {UI_STRINGS.settings.regenerateFresh}
        </button>
      </BottomSheet>

      <BottomSheet
        open={pending === 'reset'}
        title={UI_STRINGS.settings.resetTitle}
        onClose={() => {
          setPending(null);
          setResetConfirmed(false);
        }}
      >
        <p>{UI_STRINGS.settings.resetBody}</p>
        {resetConfirmed ? (
          <button type="button" className="button button--danger" onClick={doReset}>
            {UI_STRINGS.settings.resetFinal}
          </button>
        ) : (
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setResetConfirmed(true)}
          >
            {UI_STRINGS.settings.resetFirst}
          </button>
        )}
      </BottomSheet>
    </div>
  );
}

function ImportSummary({ backup }) {
  const summary = summarizeBackup(backup);
  return (
    <div className="stack">
      <p>{UI_STRINGS.settings.importBody}</p>
      <ul className="notes">
        <li className="num">
          {summary.programs} {UI_STRINGS.settings.countPrograms}
        </li>
        <li className="num">
          {summary.sessions} {UI_STRINGS.settings.countSessions}
        </li>
        <li className="num">
          {summary.measurements} {UI_STRINGS.settings.countMeasurements}
        </li>
      </ul>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
