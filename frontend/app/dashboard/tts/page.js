"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./TTS.module.css";

function WaveformAnimation() {
  return (
    <div className={styles.waveform}>
      <div className={styles.waveBar} />
      <div className={styles.waveBar} />
      <div className={styles.waveBar} />
      <div className={styles.waveBar} />
      <div className={styles.waveBar} />
      <div className={styles.waveBar} />
      <div className={styles.waveBar} />
    </div>
  );
}

export default function TextToSpeech() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceIdx, setSelectedVoiceIdx] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const utteranceRef = useRef(null);

  const speeds = [
    { label: "🐢 Chậm", value: 0.7 },
    { label: "🚶 Bình thường", value: 1.0 },
    { label: "🏃 Nhanh", value: 1.3 },
  ];

  // Load available Vietnamese voices
  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const viVoices = allVoices.filter((v) => v.lang.startsWith("vi"));
      if (viVoices.length > 0) {
        setVoices(viVoices);
      } else if (allVoices.length > 0) {
        setVoices(allVoices.slice(0, 5));
      }
    };
    loadVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const words = text.split(/\s+/).filter(Boolean);

  const handlePlay = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    window.speechSynthesis.cancel();
    if (!text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN";
    utterance.rate = speed;
    utterance.pitch = 1.05;

    if (voices.length > 0 && voices[selectedVoiceIdx]) {
      utterance.voice = voices[selectedVoiceIdx];
    }

    utterance.onboundary = (event) => {
      if (event.name === "word") {
        const spokenUpTo = event.charIndex;
        const wordsBeforeCursor = text
          .substring(0, spokenUpTo)
          .split(/\s+/)
          .filter(Boolean).length;
        setCurrentWordIndex(wordsBeforeCursor);
      }
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentWordIndex(-1);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentWordIndex(-1);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  }, [text, speed, voices, selectedVoiceIdx, isPaused]);

  const handlePause = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  const handleStop = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentWordIndex(-1);
  }, []);

  const getStatusLabel = () => {
    if (isPlaying) return { icon: "🔊", text: "Đang đọc", cls: styles.statusPlaying };
    if (isPaused) return { icon: "⏸️", text: "Tạm dừng", cls: styles.statusPaused };
    return { icon: "🟢", text: "Sẵn sàng", cls: styles.statusReady };
  };

  const status = getStatusLabel();

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Dành cho Phụ huynh</span>
            <h1>🔊 AI Đọc Tài Liệu</h1>
            <p>Dán hoặc nhập văn bản để AI đọc cho bé nghe</p>
          </div>
          <button
            className="btn secondary"
            onClick={() => router.push("/dashboard")}
          >
            ← Quay lại
          </button>
        </div>

        {/* Text Input */}
        <div className={styles.textInputArea}>
          <textarea
            className={styles.textInput}
            placeholder="Dán hoặc nhập văn bản ở đây để AI đọc thành tiếng cho bé nghe..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
          />
          <div className={styles.charCount}>
            {text.length} ký tự · {words.length} từ
          </div>
        </div>

        {/* Player Controls */}
        <div className={styles.playerControls}>
          <div className={styles.playerLeft}>
            {/* Play/Pause */}
            {!isPlaying && !isPaused && (
              <button
                className={`${styles.playButton}`}
                onClick={handlePlay}
                disabled={!text.trim()}
                title="Phát"
              >
                ▶️
              </button>
            )}
            {isPlaying && (
              <button
                className={`${styles.playButton} ${styles.playButtonActive}`}
                onClick={handlePause}
                title="Tạm dừng"
              >
                ⏸️
              </button>
            )}
            {isPaused && (
              <button
                className={`${styles.playButton}`}
                onClick={handlePlay}
                title="Tiếp tục"
              >
                ▶️
              </button>
            )}

            {/* Stop */}
            <button
              className={styles.controlButton}
              onClick={handleStop}
              disabled={!isPlaying && !isPaused}
              title="Dừng"
            >
              ⏹️
            </button>

            {/* Status */}
            <div className={`${styles.statusBadge} ${status.cls}`}>
              {status.icon} {status.text}
            </div>
          </div>

          <div className={styles.playerRight}>
            {/* Speed */}
            <div className={styles.speedSelector}>
              {speeds.map((s) => (
                <button
                  key={s.value}
                  className={`${styles.speedPill} ${speed === s.value ? styles.speedPillActive : ""}`}
                  onClick={() => setSpeed(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Voice Selector */}
        {voices.length > 0 && (
          <div className={styles.voiceSelector}>
            <label className={styles.voiceLabel}>🎙️ Giọng đọc:</label>
            <select
              className={styles.voiceSelect}
              value={selectedVoiceIdx}
              onChange={(e) => setSelectedVoiceIdx(Number(e.target.value))}
            >
              {voices.map((v, i) => (
                <option key={i} value={i}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Waveform Animation */}
        {isPlaying && <WaveformAnimation />}

        {/* Text Display with Word Highlighting */}
        {text.trim() && (
          <div className={styles.textDisplay}>
            <div className={styles.textDisplayHeader}>📄 Văn bản đang đọc</div>
            <div className={styles.textDisplayContent}>
              {words.map((word, i) => (
                <span
                  key={i}
                  className={`${styles.word} ${i === currentWordIndex ? styles.wordHighlight : ""}`}
                >
                  {word}{" "}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className={styles.tipCard}>
          <div className={styles.tipTitle}>💡 Mẹo sử dụng</div>
          <ul className={styles.tipList}>
            <li>Dán văn bản từ trang <strong>Đọc Tài Liệu (OCR)</strong> để AI đọc cho bé nghe</li>
            <li>Chọn tốc độ <strong>Chậm</strong> để bé dễ nghe và học theo</li>
            <li>Bé có thể vừa nghe vừa nhìn từ được tô sáng để luyện đọc</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
