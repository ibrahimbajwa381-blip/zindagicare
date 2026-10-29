"use client";

/**
 * Looping phone-style ringtone made with Web Audio, so no audio file ships.
 * Browsers only let it sound once the user has interacted with the site;
 * before that it stays silent and the vibration and on-screen ring still work.
 */
export function startRingtone(): () => void {
  let ctx: AudioContext | null = null;
  try {
    ctx = new AudioContext();
    void ctx.resume().catch(() => undefined);
  } catch {
    ctx = null;
  }

  const ringOnce = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([700, 300, 700]);
      } catch {
        // Vibration needs a user gesture in some browsers.
      }
    }
    if (!ctx || ctx.state === "closed") return;

    // Two short dual-tone bursts: "ring-ring".
    for (const offset of [0, 0.55]) {
      const start = ctx.currentTime + offset;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.03);
      gain.gain.setValueAtTime(0.18, start + 0.4);
      gain.gain.linearRampToValueAtTime(0, start + 0.45);
      gain.connect(ctx.destination);

      for (const frequency of [440, 480]) {
        const osc = ctx.createOscillator();
        osc.frequency.value = frequency;
        osc.connect(gain);
        osc.start(start);
        osc.stop(start + 0.46);
      }
    }
  };

  ringOnce();
  const interval = window.setInterval(ringOnce, 2_500);

  return () => {
    window.clearInterval(interval);
    try {
      navigator.vibrate?.(0);
    } catch {
      // Ignore.
    }
    void ctx?.close().catch(() => undefined);
  };
}
