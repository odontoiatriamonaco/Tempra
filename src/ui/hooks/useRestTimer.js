// Tempra v0.5.0 — 2026-09-04 12:10
//
// Timer di recupero. Spec 7.2: deve continuare a scorrere anche con la scheda
// in background, quindi il tempo residuo si ricava sempre da `Date.now()` e
// non dal conteggio degli intervalli — un `setInterval` viene rallentato o
// sospeso dal browser quando la scheda non è visibile, e il timer resterebbe
// indietro di minuti.

import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 250;

/** Un bip breve generato al momento: nessun file audio da scaricare. */
function beep() {
  try {
    const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioCtx) return;
    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.45);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
    oscillator.onended = () => context.close();
  } catch {
    // Un timer senza suono resta un timer: non è un motivo per fallire.
  }
}

/**
 * @param {{ sound?: boolean, vibrate?: boolean }} [options]
 * @returns {{
 *   secondsLeft: number|null,
 *   totalSeconds: number|null,
 *   running: boolean,
 *   start: (seconds: number) => void,
 *   adjust: (deltaSeconds: number) => void,
 *   skip: () => void,
 * }}
 */
export function useRestTimer({ sound = true, vibrate = true } = {}) {
  const [endsAt, setEndsAt] = useState(null);
  const [totalSeconds, setTotalSeconds] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (endsAt === null) {
      setSecondsLeft(null);
      return undefined;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining === 0 && !firedRef.current) {
        firedRef.current = true;
        if (vibrate && typeof navigator.vibrate === 'function') {
          navigator.vibrate([120, 80, 120]);
        }
        if (sound) beep();
      }
    };

    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [endsAt, sound, vibrate]);

  const start = useCallback((seconds) => {
    firedRef.current = false;
    setTotalSeconds(seconds);
    setEndsAt(Date.now() + seconds * 1000);
  }, []);

  const adjust = useCallback((deltaSeconds) => {
    setEndsAt((current) => {
      if (current === null) return current;
      const next = Math.max(Date.now(), current + deltaSeconds * 1000);
      if (next > Date.now()) firedRef.current = false;
      return next;
    });
    setTotalSeconds((current) =>
      current === null ? current : Math.max(0, current + deltaSeconds)
    );
  }, []);

  const skip = useCallback(() => {
    setEndsAt(null);
    setTotalSeconds(null);
    firedRef.current = false;
  }, []);

  return {
    secondsLeft,
    totalSeconds,
    running: endsAt !== null,
    start,
    adjust,
    skip,
  };
}
