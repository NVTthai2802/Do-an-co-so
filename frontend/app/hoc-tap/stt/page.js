"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../../../lib/api";
import { getToken } from "../../../lib/auth";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  speakVietnamese,
} from "../../../lib/speech";
import styles from "./STT.module.css";

function ScoreCircle({ score }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "#fbbf24" : "#f87171";

  return (
    <div className={styles.scoreCircle}>
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="#f0ebe8"
          strokeWidth="8"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 64 64)"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className={styles.scoreNumber} style={{ color }}>
        {score}%
      </div>
      <div className={styles.scoreLabel}>Chính xác</div>
    </div>
  );
}

function WaveformBars() {
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

export default function SpeechToText() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("practice");

  // Practice mode state
  const [referenceText, setReferenceText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [result, setResult] = useState(null);
  const [evaluating, setEvaluating] = useState(false);

  // Free mode state
  const [freeTranscript, setFreeTranscript] = useState("");
  const [freeInterim, setFreeInterim] = useState("");
  const [freeRecording, setFreeRecording] = useState(false);
  const [copied, setCopied] = useState(false);

  const recognitionRef = useRef(null);
  const freeRecognitionRef = useRef(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  // ---- Practice mode recording ----
  const evaluateReading = useCallback(
    async (spokenText) => {
      setEvaluating(true);
      try {
        const headers = { "Content-Type": "application/json" };
        const token = getToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const response = await fetch(`${API_URL}/stt/evaluate-reading`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            reference_text: referenceText,
            spoken_text: spokenText,
          }),
        });
        const data = await response.json();
        if (response.ok) {
          setResult(data);
        }
      } catch (err) {
        console.error("Evaluate error:", err);
      } finally {
        setEvaluating(false);
      }
    },
    [referenceText]
  );

  const startRecording = useCallback(() => {
    const recognition = createSpeechRecognition({
      lang: "vi-VN",
      continuous: true,
      interimResults: true,
    });
    if (!recognition) return;

    let finalTranscript = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript.trim());
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (referenceText.trim() && finalTranscript.trim()) {
        evaluateReading(finalTranscript.trim());
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setTranscript("");
    setInterimTranscript("");
    setResult(null);
  }, [referenceText, evaluateReading]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const handleRetry = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setResult(null);
    setEvaluating(false);
  }, []);

  // ---- Free mode recording ----
  const startFreeRecording = useCallback(() => {
    const recognition = createSpeechRecognition({
      lang: "vi-VN",
      continuous: true,
      interimResults: true,
    });
    if (!recognition) return;

    let finalTranscript = freeTranscript ? freeTranscript + " " : "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setFreeTranscript(finalTranscript.trim());
      setFreeInterim(interim);
    };

    recognition.onerror = (event) => {
      console.error("Free speech recognition error:", event.error);
      setFreeRecording(false);
    };

    recognition.onend = () => {
      setFreeRecording(false);
    };

    freeRecognitionRef.current = recognition;
    recognition.start();
    setFreeRecording(true);
    setFreeInterim("");
  }, [freeTranscript]);

  const stopFreeRecording = useCallback(() => {
    if (freeRecognitionRef.current) {
      freeRecognitionRef.current.stop();
    }
  }, []);

  const copyTranscript = useCallback(() => {
    if (freeTranscript) {
      navigator.clipboard.writeText(freeTranscript).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [freeTranscript]);

  const clearFreeTranscript = useCallback(() => {
    setFreeTranscript("");
    setFreeInterim("");
  }, []);

  // ---- Word diff rendering ----
  const renderWordDiff = useCallback(
    (evalResult) => {
      const refTokens = referenceText
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .split(/\s+/)
        .filter(Boolean);

      const correctSet = new Set(
        (evalResult.correct_words || []).map((w) => w.toLowerCase())
      );
      const missingSet = new Set(
        (evalResult.missing_words || []).map((w) => w.toLowerCase())
      );
      const wrongMap = {};
      (evalResult.wrong_words || []).forEach((w) => {
        wrongMap[w.expected?.toLowerCase()] = w.got;
      });

      const correctUsed = [...(evalResult.correct_words || [])].map((w) =>
        w.toLowerCase()
      );
      const missingUsed = [...(evalResult.missing_words || [])].map((w) =>
        w.toLowerCase()
      );

      return (
        <div className={styles.wordDiff}>
          {refTokens.map((word, i) => {
            const correctIdx = correctUsed.indexOf(word);
            if (correctIdx !== -1) {
              correctUsed.splice(correctIdx, 1);
              return (
                <span key={i} className={styles.wordCorrect}>
                  {word}
                </span>
              );
            }
            if (wrongMap[word]) {
              const got = wrongMap[word];
              delete wrongMap[word];
              return (
                <span
                  key={i}
                  className={styles.wordWrong}
                  title={`Bé đọc: ${got}`}
                >
                  <s>{word}</s> → {got}
                </span>
              );
            }
            const missingIdx = missingUsed.indexOf(word);
            if (missingIdx !== -1) {
              missingUsed.splice(missingIdx, 1);
              return (
                <span key={i} className={styles.wordMissing}>
                  {word}
                </span>
              );
            }
            return (
              <span key={i} className={styles.wordCorrect}>
                {word}
              </span>
            );
          })}
          {(evalResult.extra_words || []).map((word, i) => (
            <span key={`extra-${i}`} className={styles.wordExtra}>
              +{word}
            </span>
          ))}
        </div>
      );
    },
    [referenceText]
  );

  const getFeedbackEmoji = (score) => {
    if (score >= 90) return "🌟";
    if (score >= 80) return "😊";
    if (score >= 60) return "👍";
    if (score >= 40) return "💪";
    return "🤗";
  };

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Dành cho Bé</span>
            <h1>🎤 Bé Luyện Đọc</h1>
            <p>Đọc bài cho AI nghe và nhận đánh giá</p>
          </div>
          <button
            className="btn secondary"
            onClick={() => router.push("/hoc-tap")}
          >
            ← Quay lại
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "practice" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("practice")}
          >
            📖 Luyện đọc
          </button>
          <button
            className={`${styles.tab} ${activeTab === "free" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("free")}
          >
            🗣️ Nói tự do
          </button>
        </div>

        {!supported && (
          <div className={styles.notSupported}>
            <span className={styles.notSupportedIcon}>🌐</span>
            <p>
              Trình duyệt chưa hỗ trợ nhận diện giọng nói.
              <br />
              Vui lòng sử dụng <strong>Google Chrome</strong>.
            </p>
          </div>
        )}

        {/* ========== TAB 1: Practice ========== */}
        {supported && activeTab === "practice" && (
          <>
            {/* Reference Text */}
            <div className={styles.referenceArea}>
              <div className={styles.referenceLabel}>
                📝 Đoạn văn mẫu
                <span className={styles.referenceHint}>
                  📋 Dán từ OCR hoặc tự nhập
                </span>
              </div>
              <textarea
                className={styles.referenceTextarea}
                placeholder="Nhập đoạn văn để bé luyện đọc..."
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                rows={4}
              />
            </div>

            {/* Record Section */}
            <div className={styles.recordSection}>
              {isRecording ? (
                <div className={styles.statusRecording}>Đang ghi âm...</div>
              ) : (
                <div className={styles.statusReady}>Sẵn sàng</div>
              )}

              <button
                className={`${styles.micButton} ${isRecording ? styles.micButtonRecording : ""}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!referenceText.trim() && !isRecording}
                title={
                  !referenceText.trim() && !isRecording
                    ? "Nhập đoạn văn mẫu trước"
                    : ""
                }
                style={
                  !referenceText.trim() && !isRecording
                    ? { opacity: 0.5, cursor: "not-allowed" }
                    : {}
                }
              >
                <span className={styles.micIcon}>
                  {isRecording ? "⏹️" : "🎙️"}
                </span>
                <span className={styles.micLabel}>
                  {isRecording ? "Dừng" : "Bắt đầu đọc"}
                </span>
              </button>

              {isRecording && <WaveformBars />}
            </div>

            {/* Live Transcript */}
            {(transcript || interimTranscript) && (
              <div className={styles.transcript}>
                {transcript && (
                  <span className={styles.finalText}>{transcript} </span>
                )}
                {interimTranscript && (
                  <span className={styles.interimText}>
                    {interimTranscript}
                  </span>
                )}
              </div>
            )}
            {!transcript && !interimTranscript && !result && !evaluating && (
              <div className={`${styles.transcript} ${styles.transcriptEmpty}`}>
                Bé đọc gì sẽ hiển thị ở đây...
              </div>
            )}

            {/* Evaluating Loader */}
            {evaluating && (
              <div className={styles.evaluating}>
                <div className={styles.spinner} />
                <span>Đang đánh giá bài đọc...</span>
              </div>
            )}

            {/* Results */}
            {result && !evaluating && (
              <div className={styles.resultsCard}>
                <div className={styles.resultsTitle}>📊 Kết quả đánh giá</div>

                <ScoreCircle score={Math.round(result.accuracy || 0)} />

                {/* Stats */}
                <div className={styles.statsBar}>
                  <div className={styles.statItem}>
                    <div className={styles.statValue}>
                      {result.total_words || 0}
                    </div>
                    <div className={styles.statLabel}>Tổng từ</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statValue} style={{ color: "#22c55e" }}>
                      {result.correct_count || 0}
                    </div>
                    <div className={styles.statLabel}>Đúng</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statValue} style={{ color: "#ef4444" }}>
                      {(result.wrong_words || []).length}
                    </div>
                    <div className={styles.statLabel}>Sai</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statValue} style={{ color: "#d97706" }}>
                      {(result.missing_words || []).length}
                    </div>
                    <div className={styles.statLabel}>Thiếu</div>
                  </div>
                </div>

                {/* Legend */}
                <div className={styles.legend}>
                  <span className={styles.legendItem}>
                    <span
                      className={`${styles.legendDot} ${styles.legendDotCorrect}`}
                    />
                    Đúng
                  </span>
                  <span className={styles.legendItem}>
                    <span
                      className={`${styles.legendDot} ${styles.legendDotWrong}`}
                    />
                    Sai
                  </span>
                  <span className={styles.legendItem}>
                    <span
                      className={`${styles.legendDot} ${styles.legendDotMissing}`}
                    />
                    Thiếu
                  </span>
                  <span className={styles.legendItem}>
                    <span
                      className={`${styles.legendDot} ${styles.legendDotExtra}`}
                    />
                    Thừa
                  </span>
                </div>

                {/* Word Diff */}
                <div className={styles.wordDiffSection}>
                  <div className={styles.wordDiffTitle}>Chi tiết từng từ</div>
                  {renderWordDiff(result)}
                </div>

                {/* Feedback */}
                {result.feedback && (
                  <div className={styles.feedbackCard}>
                    <span className={styles.feedbackEmoji}>
                      {getFeedbackEmoji(result.accuracy || 0)}
                    </span>
                    <span className={styles.feedbackText}>
                      {result.feedback}
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className={styles.actions}>
                  <button className={styles.retryButton} onClick={handleRetry}>
                    🔄 Đọc lại
                  </button>
                  <button
                    className={styles.listenButton}
                    onClick={() => speakVietnamese(referenceText)}
                  >
                    🔊 Nghe mẫu
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ========== TAB 2: Free Speech ========== */}
        {supported && activeTab === "free" && (
          <>
            <div className={styles.recordSection}>
              {freeRecording ? (
                <div className={styles.statusRecording}>Đang ghi âm...</div>
              ) : (
                <div className={styles.statusReady}>Sẵn sàng</div>
              )}

              <button
                className={`${styles.micButton} ${freeRecording ? styles.micButtonRecording : ""}`}
                onClick={
                  freeRecording ? stopFreeRecording : startFreeRecording
                }
              >
                <span className={styles.micIcon}>
                  {freeRecording ? "⏹️" : "🎙️"}
                </span>
                <span className={styles.micLabel}>
                  {freeRecording ? "Dừng" : "Bắt đầu nói"}
                </span>
              </button>

              {freeRecording && <WaveformBars />}
            </div>

            {/* Transcript Display */}
            <div className={styles.freeTranscript}>
              {freeTranscript ? (
                <>
                  <span className={styles.finalText}>{freeTranscript} </span>
                  {freeInterim && (
                    <span className={styles.interimText}>{freeInterim}</span>
                  )}
                </>
              ) : freeInterim ? (
                <span className={styles.interimText}>{freeInterim}</span>
              ) : (
                <span className={styles.transcriptEmpty}>
                  Bé nói gì sẽ hiển thị ở đây...
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className={styles.actions}>
              <button
                className={styles.copyButton}
                onClick={copyTranscript}
                disabled={!freeTranscript}
                style={!freeTranscript ? { opacity: 0.5 } : {}}
              >
                {copied ? "✅ Đã sao chép!" : "📋 Sao chép"}
              </button>
              <button
                className={styles.clearButton}
                onClick={clearFreeTranscript}
                disabled={!freeTranscript && !freeInterim}
                style={
                  !freeTranscript && !freeInterim ? { opacity: 0.5 } : {}
                }
              >
                🗑️ Xóa
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
