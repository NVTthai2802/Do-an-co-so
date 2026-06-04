"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearSession, getToken, saveSession } from "../../lib/auth";
import { request } from "../../lib/api";
import { speakVietnamese } from "../../lib/speech";

const numbers = Array.from({ length: 10 }, (_, index) => index + 1);

const numberWords = [
  "",
  "một",
  "hai",
  "ba",
  "bốn",
  "năm",
  "sáu",
  "bảy",
  "tám",
  "chín",
  "mười",
];

const letters = [
  { id: "a", label: "A", word: "áo", icon: "👕" },
  { id: "aw", label: "Ă", word: "ăn", icon: "🍚" },
  { id: "aa", label: "Â", word: "ấm", icon: "🫖" },
  { id: "b", label: "B", word: "bé", icon: "🧒" },
  { id: "c", label: "C", word: "cá", icon: "🐟" },
  { id: "d", label: "D", word: "dê", icon: "🐐" },
  { id: "dd", label: "Đ", word: "đèn", icon: "💡" },
  { id: "e", label: "E", word: "em", icon: "🙂" },
  { id: "ee", label: "Ê", word: "ếch", icon: "🐸" },
  { id: "g", label: "G", word: "gà", icon: "🐔" },
  { id: "h", label: "H", word: "hoa", icon: "🌸" },
  { id: "i", label: "I", word: "in", icon: "📄" },
  { id: "k", label: "K", word: "kem", icon: "🍦" },
  { id: "l", label: "L", word: "lá", icon: "🍃" },
  { id: "m", label: "M", word: "mẹ", icon: "👩" },
  { id: "n", label: "N", word: "nơ", icon: "🎀" },
  { id: "o", label: "O", word: "ong", icon: "🐝" },
  { id: "oo", label: "Ô", word: "ô tô", icon: "🚗" },
  { id: "ow", label: "Ơ", word: "ớt", icon: "🌶️" },
  { id: "p", label: "P", word: "phở", icon: "🍜" },
  { id: "q", label: "Q", word: "quả", icon: "🍎" },
  { id: "r", label: "R", word: "rổ", icon: "🧺" },
  { id: "s", label: "S", word: "sao", icon: "⭐" },
  { id: "t", label: "T", word: "tàu", icon: "🚂" },
  { id: "u", label: "U", word: "uống", icon: "🥤" },
  { id: "uw", label: "Ư", word: "ươm", icon: "🌱" },
  { id: "v", label: "V", word: "voi", icon: "🐘" },
  { id: "x", label: "X", word: "xe", icon: "🚲" },
  { id: "y", label: "Y", word: "y tá", icon: "🧑‍⚕️" },
];

const shapes = [
  { id: "circle", label: "Hình tròn", speech: "hình tròn", text: "Không có góc" },
  { id: "square", label: "Hình vuông", speech: "hình vuông", text: "Bốn cạnh bằng nhau" },
  { id: "triangle", label: "Hình tam giác", speech: "hình tam giác", text: "Có ba cạnh" },
  { id: "rectangle", label: "Hình chữ nhật", speech: "hình chữ nhật", text: "Hai cạnh dài, hai cạnh ngắn" },
];

const MEDIAPIPE_HANDS_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
const MEDIAPIPE_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/hands";
const scriptPromises = new Map();

function loadScript(src) {
  if (typeof window === "undefined") return Promise.reject(new Error("No browser"));
  if (scriptPromises.has(src)) return scriptPromises.get(src);

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      if (existing.dataset.loaded === "true") resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  scriptPromises.set(src, promise);
  return promise;
}

async function loadMediaPipeHands() {
  if (window.Hands) return true;
  await loadScript(MEDIAPIPE_HANDS_URL);
  return Boolean(window.Hands);
}

function landmarkDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function countRaisedFingers(landmarks) {
  if (!landmarks) return 0;

  const fingerPairs = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];
  let count = fingerPairs.filter(([tip, pip]) => landmarks[tip].y < landmarks[pip].y - 0.035).length;

  const thumbIsAwayFromPalm = Math.abs(landmarks[4].x - landmarks[2].x) > 0.08;
  const thumbIsExtended =
    thumbIsAwayFromPalm && landmarkDistance(landmarks[4], landmarks[0]) > landmarkDistance(landmarks[3], landmarks[0]);
  if (thumbIsExtended) count += 1;

  return count;
}

function countFingersFromResults(results) {
  return (results.multiHandLandmarks || []).slice(0, 2).reduce(
    (total, landmarks) => total + countRaisedFingers(landmarks),
    0,
  );
}

function createMathProblem() {
  const usePlus = Math.random() > 0.45;

  if (usePlus) {
    const answer = Math.floor(Math.random() * 9) + 2;
    const left = Math.floor(Math.random() * (answer - 1)) + 1;
    return { left, right: answer - left, operator: "+", answer };
  }

  const left = Math.floor(Math.random() * 9) + 2;
  const right = Math.floor(Math.random() * (left - 1)) + 1;
  return { left, right, operator: "-", answer: left - right };
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonType = searchParams.get("lesson");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = useMemo(() => getToken(), []);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    request("/auth/me", { token })
      .then((data) => {
        setUser(data.user);
        saveSession(token, data.user);
      })
      .catch(() => {
        clearSession();
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router, token]);

  async function handleLogout() {
    try {
      await request("/auth/logout", { method: "POST", token });
    } catch {
      // Local logout should still work if the server is temporarily unavailable.
    } finally {
      clearSession();
      router.replace("/login");
    }
  }

  if (loading) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">Đang mở lớp học...</section>
      </main>
    );
  }

  if (lessonType === "numbers") {
    return <NumberLesson />;
  }

  if (lessonType === "letters") {
    return (
      <LessonShell title="Dạy chữ" subtitle="Bảng chữ cái tiếng Việt">
        <LetterLesson />
      </LessonShell>
    );
  }

  if (lessonType === "shapes") {
    return (
      <LessonShell title="Dạy hình" subtitle="Nhận dạng hình cơ bản">
        <ShapeLesson />
      </LessonShell>
    );
  }

  return <DashboardHome user={user} onLogout={handleLogout} />;
}

function DashboardHome({ user, onLogout }) {
  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Lớp học của bé</span>
            <h1>Xin chào, {user?.name || "bé"}!</h1>
            <p>Chọn một bài học để bắt đầu.</p>
          </div>
          <div className="dashboard-actions">
            <button className="btn secondary" onClick={onLogout}>
              Đăng xuất
            </button>
          </div>
        </div>

        <div className="lesson-grid">
          <LessonLink
            href="/dashboard?lesson=numbers"
            icon="🔢"
            title="Dạy số"
            text="Nhận biết số và luyện cộng trừ từ 1 đến 10."
          />
          <LessonLink
            href="/dashboard/letters"
            icon="🔤"
            title="Dạy chữ"
            text="Làm quen 29 chữ cái tiếng Việt."
          />
          <LessonLink
            href="/dashboard/shapes"
            icon="◯"
            title="Dạy hình"
            text="Nhận biết hình tròn, vuông, tam giác."
          />
        </div>
      </section>
    </main>
  );
}

function LessonLink({ href, icon, title, text }) {
  return (
    <Link href={href} className="lesson-card">
      <div className="lesson-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="lesson-cta">Vào học →</div>
    </Link>
  );
}

function LessonShell({ title, subtitle, children }) {
  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">{title}</span>
            <h1>{subtitle}</h1>
          </div>
          <div className="dashboard-actions">
            <Link href="/dashboard" className="btn secondary">
              Quay lại
            </Link>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}

function NumberLesson() {
  const [mode, setMode] = useState("learn");

  return (
    <LessonShell title="Dạy số" subtitle="Số và toán học vui nhộn">
      <div className="mode-tabs" role="tablist" aria-label="Chế độ học số">
        <button
          className={`mode-tab ${mode === "learn" ? "active" : ""}`}
          onClick={() => setMode("learn")}
          role="tab"
          aria-selected={mode === "learn"}
        >
          Nhận biết số
        </button>
        <button
          className={`mode-tab ${mode === "math" ? "active" : ""}`}
          onClick={() => setMode("math")}
          role="tab"
          aria-selected={mode === "math"}
        >
          Toán học vui
        </button>
      </div>

      {mode === "learn" ? <NumberReadingMode /> : <MathGameMode />}
    </LessonShell>
  );
}

function NumberReadingMode() {
  const [selectedNumber, setSelectedNumber] = useState(1);

  function selectNumber(number) {
    setSelectedNumber(number);
    speakVietnamese(`Số ${numberWords[number]}`);
  }

  return (
    <section className="activity-panel">
      <div className="chip-grid number-chip-grid">
        {numbers.map((number) => (
          <button
            key={number}
            className={`chip ${selectedNumber === number ? "active" : ""}`}
            onClick={() => selectNumber(number)}
          >
            {number}
          </button>
        ))}
      </div>

      <div className="spotlight number-spotlight">
        <div className="big-number">{selectedNumber}</div>
        <p>
          Số <strong>{numberWords[selectedNumber]}</strong>
        </p>
        <div className="object-row" aria-label="Đồ vật minh họa">
          {Array.from({ length: selectedNumber }, (_, index) => (
            <span key={index}>●</span>
          ))}
        </div>
        <button
          className="btn primary compact"
          onClick={() => speakVietnamese(`Số ${numberWords[selectedNumber]}`)}
        >
          Nghe phát âm
        </button>
      </div>
    </section>
  );
}

function MathGameMode() {
  const [problem, setProblem] = useState(() => createMathProblem());
  const [detectedNumber, setDetectedNumber] = useState(null);
  const [feedback, setFeedback] = useState("Sẵn sàng");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [fingerCount, setFingerCount] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [handStatus, setHandStatus] = useState("Bật camera rồi giơ số ngón tay");
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const rafRef = useRef(null);
  const processingRef = useRef(false);
  const holdStartRef = useRef(0);
  const stableFingerRef = useRef(null);
  const submittedFingerRef = useRef(null);
  const nextProblemTimerRef = useRef(null);
  const answerLockedRef = useRef(false);
  const problemRef = useRef(problem);
  const wrongAttemptsRef = useRef(0);

  useEffect(() => {
    return () => {
      if (nextProblemTimerRef.current) {
        clearTimeout(nextProblemTimerRef.current);
      }
      stopCamera(false);
    };
  }, []);

  useEffect(() => {
    problemRef.current = problem;
  }, [problem]);

  useEffect(() => {
    wrongAttemptsRef.current = wrongAttempts;
  }, [wrongAttempts]);

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      const playPromise = videoRef.current.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    }
  }, [cameraOn]);

  useEffect(() => {
    if (!cameraOn) return undefined;

    let cancelled = false;

    async function setupHands() {
      try {
        await loadMediaPipeHands();
        if (cancelled || !window.Hands) return;

        const hands = new window.Hands({
          locateFile: (file) => `${MEDIAPIPE_BASE_URL}/${file}`,
        });
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.68,
          minTrackingConfidence: 0.58,
        });
        hands.onResults(processNumberHandResults);
        handsRef.current = hands;
        setHandStatus("Giữ nguyên số ngón tay trong 3 giây");

        const loop = async () => {
          if (cancelled) return;
          const video = videoRef.current;
          if (video?.readyState >= 2 && handsRef.current && !processingRef.current) {
            processingRef.current = true;
            try {
              await handsRef.current.send({ image: video });
            } catch {
              setHandStatus("Nhận diện tay tạm dừng");
            } finally {
              processingRef.current = false;
            }
          }
          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch {
        setCameraError("Không tải được nhận diện tay.");
      }
    }

    setupHands();

    return () => {
      cancelled = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      processingRef.current = false;
    };
  }, [cameraOn]);

  function resetHeldFinger() {
    holdStartRef.current = 0;
    stableFingerRef.current = null;
    submittedFingerRef.current = null;
    setFingerCount(null);
    setHoldProgress(0);
  }

  function processNumberHandResults(results) {
    if (answerLockedRef.current) return;

    const totalFingers = countFingersFromResults(results);
    if (!totalFingers) {
      resetHeldFinger();
      setHandStatus("Giơ số ngón tay để trả lời");
      return;
    }

    const now = Date.now();
    setFingerCount(totalFingers);
    setDetectedNumber(totalFingers);

    if (stableFingerRef.current !== totalFingers) {
      stableFingerRef.current = totalFingers;
      holdStartRef.current = now;
      submittedFingerRef.current = null;
      setHoldProgress(0);
      setHandStatus(`Đang giữ số ${totalFingers}`);
      return;
    }

    const elapsed = now - holdStartRef.current;
    setHoldProgress(Math.min(1, elapsed / 3000));
    setHandStatus(`Giữ số ${totalFingers} thêm ${Math.max(0, Math.ceil((3000 - elapsed) / 1000))} giây`);

    if (elapsed >= 3000 && submittedFingerRef.current !== totalFingers) {
      submittedFingerRef.current = totalFingers;
      setHandStatus(`Đã nhận số ${totalFingers}`);
      evaluateAnswer(totalFingers);
    }
  }

  function scheduleNextProblem(delay = 1400) {
    if (nextProblemTimerRef.current) {
      clearTimeout(nextProblemTimerRef.current);
    }
    nextProblemTimerRef.current = setTimeout(() => {
      nextProblem();
      nextProblemTimerRef.current = null;
    }, delay);
  }

  function evaluateAnswer(number) {
    if (answerLockedRef.current) return;

    setDetectedNumber(number);
    if (number === problemRef.current.answer) {
      answerLockedRef.current = true;
      setWrongAttempts(0);
      wrongAttemptsRef.current = 0;
      setFeedback("Chính xác! Sang câu mới...");
      speakVietnamese("Chính xác");
      scheduleNextProblem();
      return;
    }

    const nextAttempts = wrongAttemptsRef.current + 1;
    wrongAttemptsRef.current = nextAttempts;
    setWrongAttempts(nextAttempts);

    if (nextAttempts >= 3) {
      answerLockedRef.current = true;
      setFeedback(`Đáp án là ${problemRef.current.answer}. Sang câu mới...`);
      speakVietnamese(`Đáp án là ${problemRef.current.answer}`);
      scheduleNextProblem(2400);
      return;
    }

    setFeedback(`Thử lại nhé (${nextAttempts}/3)`);
    speakVietnamese("Thử lại nhé");
  }

  function nextProblem() {
    if (nextProblemTimerRef.current) {
      clearTimeout(nextProblemTimerRef.current);
      nextProblemTimerRef.current = null;
    }
    setProblem(createMathProblem());
    setDetectedNumber(null);
    setFeedback("Sẵn sàng");
    setWrongAttempts(0);
    wrongAttemptsRef.current = 0;
    answerLockedRef.current = false;
    resetHeldFinger();
    setHandStatus(cameraOn ? "Giữ nguyên số ngón tay trong 3 giây" : "Bật camera rồi giơ số ngón tay");
  }

  async function startCamera() {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Trình duyệt chưa hỗ trợ camera.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      setHandStatus("Đang mở camera");
    } catch {
      setCameraError("Không mở được camera.");
    }
  }

  function stopCamera(updateState = true) {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    handsRef.current?.close?.();
    handsRef.current = null;
    processingRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (updateState) {
      setCameraOn(false);
      setHandStatus("Bật camera rồi giơ số ngón tay");
      resetHeldFinger();
    }
  }

  return (
    <section className="math-layout">
      <div className="problem-panel">
        <span className="badge">Cộng trừ 1 - 10</span>
        <div className="math-expression">
          {problem.left} {problem.operator} {problem.right} = ?
        </div>
        <p className={feedback === "Chính xác!" ? "success-text" : ""}>{feedback}</p>
        {detectedNumber !== null ? (
          <div className="detected-number">Số đang nhận: {detectedNumber}</div>
        ) : null}
        {wrongAttempts > 0 ? (
          <div className="detected-number">Số lần sai: {wrongAttempts}/3</div>
        ) : null}

        <div className="manual-answer-grid">
          {numbers.map((number) => (
            <button key={number} className="chip" onClick={() => evaluateAnswer(number)}>
              {number}
            </button>
          ))}
        </div>

        <button className="btn primary compact" onClick={nextProblem}>
          Câu mới
        </button>
      </div>

      <div className="camera-panel">
        <div className="camera-frame">
          {cameraOn ? (
            <video ref={videoRef} autoPlay playsInline muted />
          ) : (
            <div className="camera-placeholder">Camera</div>
          )}
        </div>

        <div className="camera-status">
          <span>{handStatus}</span>
          {fingerCount !== null ? <strong>{fingerCount}</strong> : null}
          <div className="hold-meter" aria-hidden="true">
            <span style={{ width: `${Math.round(holdProgress * 100)}%` }} />
          </div>
        </div>

        <div className="camera-actions">
          {cameraOn ? (
            <button className="btn secondary" onClick={stopCamera}>
              Tắt camera
            </button>
          ) : (
            <button className="btn secondary" onClick={startCamera}>
              Bật camera
            </button>
          )}
        </div>

        {cameraError ? <div className="error">{cameraError}</div> : null}
      </div>
    </section>
  );
}

function LetterLesson() {
  const [selectedLetter, setSelectedLetter] = useState(letters[0]);

  function selectLetter(item) {
    setSelectedLetter(item);
    speakVietnamese(`${item.label} như ${item.word}`);
  }

  return (
    <section className="activity-panel">
      <div className="chip-grid letter-chip-grid">
        {letters.map((item) => (
          <button
            key={item.id}
            className={`chip ${selectedLetter.id === item.id ? "active" : ""}`}
            onClick={() => selectLetter(item)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="spotlight">
        <div className="letter-display">
          <span>{selectedLetter.label}</span>
          <strong>{selectedLetter.icon}</strong>
        </div>
        <p>
          {selectedLetter.label} như <strong>{selectedLetter.word}</strong>
        </p>
        <button
          className="btn primary compact"
          onClick={() => speakVietnamese(`${selectedLetter.label} như ${selectedLetter.word}`)}
        >
          Nghe phát âm
        </button>
      </div>
    </section>
  );
}

function ShapeLesson() {
  const [selectedShape, setSelectedShape] = useState(shapes[0]);

  function selectShape(shape) {
    setSelectedShape(shape);
    speakVietnamese(shape.speech);
  }

  return (
    <section className="activity-panel">
      <div className="chip-grid shape-chip-grid">
        {shapes.map((shape) => (
          <button
            key={shape.id}
            className={`chip ${selectedShape.id === shape.id ? "active" : ""}`}
            onClick={() => selectShape(shape)}
          >
            {shape.label}
          </button>
        ))}
      </div>

      <div className="spotlight">
        <div className={`shape-preview ${selectedShape.id}`} />
        <p>
          <strong>{selectedShape.label}</strong> - {selectedShape.text}
        </p>
        <button
          className="btn primary compact"
          onClick={() => speakVietnamese(selectedShape.speech)}
        >
          Nghe phát âm
        </button>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="dashboard-shell">
          <section className="dashboard-card">Đang tải dữ liệu...</section>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
