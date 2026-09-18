"use client";

import { useEffect, useState } from "react";
import { effectsEnabled, setEffectsEnabled } from "../lib/celebrate";
import { setSoundEnabled, soundEnabled } from "../lib/sfx";

/**
 * Công tắc âm thanh và hiệu ứng (Mục 6.1, quy tắc an toàn).
 *
 * Hai công tắc tách nhau: tắt hiệu ứng thì không bắn pháo nhưng VẪN có âm
 * thanh; tắt âm thanh thì không "ting" và không đọc lời khen.
 *
 * Đọc localStorage sau khi mount để tránh lệch giữa HTML dựng sẵn và trình
 * duyệt (hydration mismatch).
 */
export default function KidSwitches() {
  const [sound, setSound] = useState(true);
  const [effects, setEffects] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSound(soundEnabled());
    setEffects(effectsEnabled());
    setReady(true);
  }, []);

  if (!ready) return <div className="kid-switches" aria-hidden="true" />;

  return (
    <div className="kid-switches">
      <button
        type="button"
        className="kid-switch"
        aria-pressed={sound}
        onClick={() => {
          const next = !sound;
          setSound(next);
          setSoundEnabled(next);
        }}
      >
        <span aria-hidden="true">{sound ? "🔊" : "🔇"}</span>
        Âm thanh {sound ? "bật" : "tắt"}
      </button>

      <button
        type="button"
        className="kid-switch"
        aria-pressed={effects}
        onClick={() => {
          const next = !effects;
          setEffects(next);
          setEffectsEnabled(next);
        }}
      >
        <span aria-hidden="true">{effects ? "🎉" : "🚫"}</span>
        Hiệu ứng {effects ? "bật" : "tắt"}
      </button>
    </div>
  );
}
