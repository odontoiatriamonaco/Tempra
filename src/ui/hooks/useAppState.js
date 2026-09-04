// Tempra v0.4.0 — 2026-09-04 11:30
//
// Lo stato che quasi ogni schermata deve conoscere: catalogo, profilo,
// programma attivo, sedute del programma. Un solo caricamento, un solo posto
// da ricaricare quando qualcosa cambia.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ensureCatalogSeeded } from '../../db/bootstrap.js';
import { getActiveProgram, getProfile, getSessionsForProgram } from '../../db/repo.js';

/**
 * @returns {{
 *   loading: boolean,
 *   catalog: object[],
 *   byId: Map<string, object>,
 *   profile: object|null,
 *   program: object|null,
 *   sessions: object[],
 *   reload: () => Promise<void>,
 * }}
 */
export function useAppState() {
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [sessions, setSessions] = useState([]);

  const load = useCallback(async () => {
    const exercises = await ensureCatalogSeeded();
    const [storedProfile, activeProgram] = await Promise.all([
      getProfile(),
      getActiveProgram(),
    ]);
    const programSessions = activeProgram
      ? await getSessionsForProgram(activeProgram.id)
      : [];

    setCatalog(exercises);
    setProfile(storedProfile ?? null);
    setProgram(activeProgram ?? null);
    setSessions(programSessions);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch((error) => {
      if (!cancelled) {
        console.error('Tempra: caricamento fallito', error);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const byId = useMemo(
    () => new Map(catalog.map((exercise) => [exercise.id, exercise])),
    [catalog]
  );

  return { loading, catalog, byId, profile, program, sessions, reload: load };
}
