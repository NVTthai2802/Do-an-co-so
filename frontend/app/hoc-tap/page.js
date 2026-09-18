"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearSession, getToken, saveSession } from "../../lib/auth";
import { request } from "../../lib/api";
import { recordLearningResult } from "../../lib/learning";
import { speakVietnamese } from "../../lib/speech";
import KidTopBar from "../../components/KidTopBar";
import CompactNumberPicker from "../../components/CompactNumberPicker";
import ParentalGate from "../../components/ParentalGate";

const digits = Array.from({ length: 10 }, (_, index) => index);
const roundTens = Array.from({ length: 10 }, (_, index) => (index + 1) * 10);
const composeTens = roundTens.filter((number) => number < 100);
const answerChoices10 = Array.from({ length: 11 }, (_, index) => index);

const digitWords = [
  "không",
  "một",
  "hai",
  "ba",
  "bốn",
  "năm",
  "sáu",
  "bảy",
  "tám",
  "chín",
];

function readNumberVietnamese(number) {
  if (number >= 0 && number < 10) return digitWords[number];
  if (number === 10) return "mười";
  if (number < 20) {
    if (number === 15) return "mười lăm";
    return `mười ${digitWords[number % 10]}`;
  }
  if (number < 100) {
    const tens = Math.floor(number / 10);
    const ones = number % 10;
    if (ones === 0) return `${digitWords[tens]} mươi`;
    if (ones === 1) return `${digitWords[tens]} mươi mốt`;
    if (ones === 5) return `${digitWords[tens]} mươi lăm`;
    return `${digitWords[tens]} mươi ${digitWords[ones]}`;
  }
  if (number === 100) return "một trăm";
  return String(number);
}

function speakNumber(number) {
  speakVietnamese(`Số ${readNumberVietnamese(number)}`);
}

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

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createMathProblem(limit = 10) {
  const usePlus = Math.random() > 0.45;

  if (usePlus) {
    const minAnswer = limit === 10 ? 1 : 0;
    const answer = randomInt(minAnswer, limit);
    const left = randomInt(0, answer);
    return { left, right: answer - left, operator: "+", answer };
  }

  const left = randomInt(limit === 10 ? 1 : 0, limit);
  const right = limit === 10 ? randomInt(0, Math.max(0, left - 1)) : randomInt(0, left);
  return { left, right, operator: "-", answer: left - right };
}

const SLOW_NETWORK_MS = 8000;

function HocTapContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonType = searchParams.get("lesson");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const token = useMemo(() => getToken(), []);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return undefined;
    }

    let alive = true;
    setLoading(true);
    setSlow(false);

    // Mạng chậm: sau 8 giây thì báo cho phụ huynh và cho bấm "Thử lại".
    const slowTimer = setTimeout(() => {
      if (alive) setSlow(true);
    }, SLOW_NETWORK_MS);

    request("/auth/me", { token })
      .then((data) => {
        if (!alive) return;
        setUser(data.user);
        saveSession(token, data.user);
      })
      .catch(() => {
        if (!alive) return;
        clearSession();
        router.replace("/login");
      })
      .finally(() => {
        if (!alive) return;
        clearTimeout(slowTimer);
        setLoading(false);
      });

    return () => {
      alive = false;
      clearTimeout(slowTimer);
    };
  }, [router, token, attempt]);

  if (loading) {
    return <KidLoading slow={slow} onRetry={() => setAttempt((n) => n + 1)} />;
  }

  if (lessonType === "numbers") {
    return <NumberLesson />;
  }

  if (lessonType === "letters") {
    return (
      <LessonShell title="Chữ" subject="let">
        <LetterLesson />
      </LessonShell>
    );
  }

  if (lessonType === "shapes") {
    return (
      <LessonShell title="Hình" subject="shp">
        <ShapeLesson />
      </LessonShell>
    );
  }

  return <HocTapHome user={user} />;
}

function KidLoading({ slow, onRetry }) {
  return (
    <main className="kid-shell">
      <div className="kid-skeleton">
        <div className="kid-skeleton-mascot" aria-hidden="true">
          ⭐
        </div>
        <p className="kid-skeleton-text" role="status">
          Đang mở lớp học...
        </p>

        <div className="kid-skeleton-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="kid-skeleton-card" />
          ))}
        </div>

        {slow ? (
          <div className="kid-slow-note" role="alert">
            <span>Mạng hơi chậm</span>
            <button type="button" className="kbtn subject-try" onClick={onRetry}>
              Thử lại
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}

// Lưới bài của bé (Mục 5.2): Số, Chữ, Hình, Giờ, Luyện đọc, Huy hiệu.
// "Đọc tài liệu" và "AI đọc cho bé" đã chuyển sang /dashboard/tools.
const kidLessons = [
  { href: "/hoc-tap?lesson=numbers", subject: "num", icon: "123", name: "Số", speak: "Bài học số" },
  { href: "/hoc-tap/letters", subject: "let", icon: "A", name: "Chữ", speak: "Bài học chữ" },
  { href: "/hoc-tap/shapes", subject: "shp", icon: "▲", name: "Hình", speak: "Bài học hình" },
  { href: "/hoc-tap/time", subject: "tim", icon: "🕐", name: "Giờ", speak: "Bài học giờ" },
  { href: "/hoc-tap/stt", subject: "rd", icon: "🎤", name: "Luyện đọc", speak: "Bé luyện đọc" },
];

function HocTapHome({ user }) {
  const router = useRouter();
  const [gateOpen, setGateOpen] = useState(false);

  return (
    <main className="kid-shell">
      <div className="kid-home-head">
        <h1>Chào {user?.name || "bé"}!</h1>
        <button
          type="button"
          className="kid-lock"
          onClick={() => setGateOpen(true)}
          aria-label="Khu vực của bố mẹ"
          title="Khu vực của bố mẹ"
        >
          🔒
        </button>
      </div>

      <div className="kid-grid">
        {kidLessons.map((lesson) => (
          <KidLessonCard key={lesson.href} {...lesson} />
        ))}

        {/* Phòng huy hiệu dựng ở Giai đoạn 6; hiện thẻ ở trạng thái chưa mở
            để bé thấy trước phần thưởng mà không bấm vào link chưa có. */}
        <div className="kid-card locked subject-num" aria-label="Huy hiệu, sắp có">
          <div className="kid-card-icon" aria-hidden="true">
            🏅
          </div>
          <p className="kid-card-name">Huy hiệu</p>
          <span className="kid-card-soon">Sắp có</span>
        </div>
      </div>

      {gateOpen ? (
        <ParentalGate
          onClose={() => setGateOpen(false)}
          onSuccess={() => router.push("/dashboard")}
        />
      ) : null}
    </main>
  );
}

function KidLessonCard({ href, subject, icon, name, speak }) {
  const router = useRouter();
  const [stars] = useState(0);

  return (
    <div
      className={`kid-card subject-${subject}`}
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(href);
        }
      }}
    >
      <div className="kid-card-icon" aria-hidden="true">
        {icon}
      </div>
      <p className="kid-card-name">{name}</p>

      <div className="kid-card-stars" aria-label={`${stars} trên 3 sao`}>
        {[0, 1, 2].map((index) => (
          <i key={index} className={index < stars ? "on" : ""} aria-hidden="true">
            ⭐
          </i>
        ))}
      </div>

      <button
        type="button"
        className="kid-card-speak"
        aria-label={`Nghe đọc: ${name}`}
        onClick={(event) => {
          event.stopPropagation();
          speakVietnamese(speak);
        }}
      >
        🔊
      </button>
    </div>
  );
}

function LessonShell({ title, subject = "num", children }) {
  return (
    <main className="kid-shell">
      <KidTopBar subject={subject} title={title} />
      <div className={`kid-lesson subject-${subject}`}>{children}</div>
    </main>
  );
}

function NumberLesson() {
  const [mode, setMode] = useState("learn");

  return (
    <LessonShell title="Số" subject="num">
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
  const [subMode, setSubMode] = useState("digits");
  const [selectedDigit, setSelectedDigit] = useState(0);
  const [selectedTen, setSelectedTen] = useState(10);
  const [selectedBase, setSelectedBase] = useState(10);
  const [selectedUnit, setSelectedUnit] = useState(1);
  const composedNumber = selectedBase + selectedUnit;

  function selectDigit(number) {
    setSelectedDigit(number);
    speakNumber(number);
  }

  function selectTen(number) {
    setSelectedTen(number);
    speakNumber(number);
  }

  function selectBase(number) {
    setSelectedBase(number);
    speakNumber(number + selectedUnit);
  }

  function selectUnit(number) {
    setSelectedUnit(number);
    speakNumber(selectedBase + number);
  }

  return (
    <section className="activity-panel">
      <div className="mode-tabs secondary-tabs" role="tablist" aria-label="Phần nhận biết số">
        <button
          className={`mode-tab ${subMode === "digits" ? "active" : ""}`}
          onClick={() => setSubMode("digits")}
          role="tab"
          aria-selected={subMode === "digits"}
        >
          Chữ số 0-9
        </button>
        <button
          className={`mode-tab ${subMode === "tens" ? "active" : ""}`}
          onClick={() => setSubMode("tens")}
          role="tab"
          aria-selected={subMode === "tens"}
        >
          Số tròn chục
        </button>
        <button
          className={`mode-tab ${subMode === "compose" ? "active" : ""}`}
          onClick={() => setSubMode("compose")}
          role="tab"
          aria-selected={subMode === "compose"}
        >
          Ghép số
        </button>
      </div>

      {subMode === "digits" ? (
        <>
          <div className="chip-grid number-chip-grid">
            {digits.map((number) => (
              <button
                key={number}
                className={`chip ${selectedDigit === number ? "active" : ""}`}
                onClick={() => selectDigit(number)}
              >
                {number}
              </button>
            ))}
          </div>
          <NumberSpotlight number={selectedDigit} objectCount={selectedDigit} />
        </>
      ) : null}

      {subMode === "tens" ? (
        <>
          <div className="chip-grid number-chip-grid">
            {roundTens.map((number) => (
              <button
                key={number}
                className={`chip ${selectedTen === number ? "active" : ""}`}
                onClick={() => selectTen(number)}
              >
                {number}
              </button>
            ))}
          </div>
          <NumberSpotlight number={selectedTen} objectCount={Math.min(selectedTen / 10, 10)} />
        </>
      ) : null}

      {subMode === "compose" ? (
        <div className="compose-panel">
          <div className="compose-pickers">
            <div>
              <h3>Chọn số tròn chục</h3>
              <div className="chip-grid compose-chip-grid">
                {composeTens.map((number) => (
                  <button
                    key={number}
                    className={`chip ${selectedBase === number ? "active" : ""}`}
                    onClick={() => selectBase(number)}
                  >
                    {number}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3>Chọn số đơn vị</h3>
              <div className="chip-grid compose-chip-grid">
                {digits.map((number) => (
                  <button
                    key={number}
                    className={`chip ${selectedUnit === number ? "active" : ""}`}
                    onClick={() => selectUnit(number)}
                  >
                    {number}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="spotlight number-spotlight">
            <div className="compose-result">
              {selectedBase} + {selectedUnit} = <strong>{composedNumber}</strong>
            </div>
            <div className="big-number">{composedNumber}</div>
            <p>
              Đọc là <strong>số {readNumberVietnamese(composedNumber)}</strong>
            </p>
            <button className="btn primary compact" onClick={() => speakNumber(composedNumber)}>
              Nghe cách đọc
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function NumberSpotlight({ number, objectCount }) {
  const visibleObjects = Math.min(objectCount, 30);

  return (
    <div className="spotlight number-spotlight">
      <div className="big-number">{number}</div>
      <p>
        Số <strong>{readNumberVietnamese(number)}</strong>
      </p>
      <div className="object-row" aria-label="Đồ vật minh họa">
        {visibleObjects > 0 ? (
          Array.from({ length: visibleObjects }, (_, index) => <span key={index}>●</span>)
        ) : (
          <span className="object-empty">0 đồ vật</span>
        )}
      </div>
      <button className="btn primary compact" onClick={() => speakNumber(number)}>
        Nghe phát âm
      </button>
    </div>
  );
}

function MathGameMode() {
  const [rangeLimit, setRangeLimit] = useState(10);
  const [problem, setProblem] = useState(() => createMathProblem(10));
  const [composedAnswer, setComposedAnswer] = useState(0);
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
    if (answerLockedRef.current || rangeLimit !== 10) return;

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
      const wrongCount = wrongAttemptsRef.current;
      const sessionScore = Math.max(0, 100 - wrongCount * 20);
      answerLockedRef.current = true;
      setWrongAttempts(0);
      wrongAttemptsRef.current = 0;
      setFeedback("Chính xác! Sang câu mới...");
      speakVietnamese("Chính xác");
      void recordLearningResult({
        module_key: "math",
        activity_key: rangeLimit === 10 ? "camera_math_10" : "compose_math_100",
        title: `Cộng trừ phạm vi ${rangeLimit}`,
        score: sessionScore,
        max_score: 100,
        accuracy: sessionScore,
        time_spent_seconds: 0,
        detail: {
          mode: rangeLimit === 10 ? "camera" : "compose",
          range_limit: rangeLimit,
          left: problemRef.current.left,
          right: problemRef.current.right,
          operator: problemRef.current.operator,
          answer: problemRef.current.answer,
          detected_number: number,
          wrong_attempts: wrongCount,
          correct: true,
        },
      });
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
      void recordLearningResult({
        module_key: "math",
        activity_key: rangeLimit === 10 ? "camera_math_10" : "compose_math_100",
        title: `Cộng trừ phạm vi ${rangeLimit}`,
        score: 0,
        max_score: 100,
        accuracy: 0,
        time_spent_seconds: 0,
        detail: {
          mode: rangeLimit === 10 ? "camera" : "compose",
          range_limit: rangeLimit,
          left: problemRef.current.left,
          right: problemRef.current.right,
          operator: problemRef.current.operator,
          answer: problemRef.current.answer,
          detected_number: number,
          wrong_attempts: nextAttempts,
          correct: false,
        },
      });
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
    setProblem(createMathProblem(rangeLimit));
    setComposedAnswer(0);
    setDetectedNumber(null);
    setFeedback("Sẵn sàng");
    setWrongAttempts(0);
    wrongAttemptsRef.current = 0;
    answerLockedRef.current = false;
    resetHeldFinger();
    setHandStatus(cameraOn ? "Giữ nguyên số ngón tay trong 3 giây" : "Bật camera rồi giơ số ngón tay");
  }

  function switchRange(nextLimit) {
    if (nextLimit === rangeLimit) return;
    if (nextProblemTimerRef.current) {
      clearTimeout(nextProblemTimerRef.current);
      nextProblemTimerRef.current = null;
    }
    if (nextLimit > 10) {
      stopCamera();
    }
    setRangeLimit(nextLimit);
    setProblem(createMathProblem(nextLimit));
    setComposedAnswer(0);
    setDetectedNumber(null);
    setFeedback("Sẵn sàng");
    setWrongAttempts(0);
    wrongAttemptsRef.current = 0;
    answerLockedRef.current = false;
    resetHeldFinger();
    setHandStatus(nextLimit === 10 ? "Bật camera rồi giơ số ngón tay" : "Chọn đáp án bên dưới");
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
    <section className="activity-panel">
      <div className="mode-tabs secondary-tabs" role="tablist" aria-label="Phạm vi làm toán">
        <button
          className={`mode-tab ${rangeLimit === 10 ? "active" : ""}`}
          onClick={() => switchRange(10)}
          role="tab"
          aria-selected={rangeLimit === 10}
        >
          Phạm vi 10
        </button>
        <button
          className={`mode-tab ${rangeLimit === 100 ? "active" : ""}`}
          onClick={() => switchRange(100)}
          role="tab"
          aria-selected={rangeLimit === 100}
        >
          Phạm vi 100
        </button>
      </div>

      <div className={`math-layout ${rangeLimit === 100 ? "math-layout-wide" : ""}`}>
        <div className="problem-panel">
          <span className="badge">Cộng trừ phạm vi {rangeLimit}</span>
          <div className="math-expression">
            {problem.left} {problem.operator} {problem.right} = ?
          </div>
          <p className={feedback.includes("Chính xác") ? "success-text" : ""}>{feedback}</p>
          {detectedNumber !== null ? (
            <div className="detected-number">Số đang nhận: {detectedNumber}</div>
          ) : null}
          {wrongAttempts > 0 ? (
            <div className="detected-number">Số lần sai: {wrongAttempts}/3</div>
          ) : null}

          {rangeLimit === 10 ? (
            <div className="manual-answer-grid">
              {answerChoices10.map((number) => (
                <button key={number} className="chip" onClick={() => evaluateAnswer(number)}>
                  {number}
                </button>
              ))}
            </div>
          ) : (
            <div className="composed-answer-panel">
              <CompactNumberPicker
                label="Ghép đáp án"
                value={composedAnswer}
                min={0}
                max={100}
                onChange={setComposedAnswer}
              />
              <button className="btn primary compact" onClick={() => evaluateAnswer(composedAnswer)}>
                Kiểm tra
              </button>
            </div>
          )}

          <button className="btn primary compact" onClick={nextProblem}>
            Câu mới
          </button>
        </div>

        {rangeLimit === 10 ? (
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
        ) : (
          <div className="camera-panel number-note-panel">
            <span className="badge">Phạm vi 100</span>
            <p>Với bài toán lớn hơn 10, bé ghép hàng chục và hàng đơn vị rồi bấm kiểm tra.</p>
            <p>Phần giơ ngón tay vẫn dùng cho bài cộng trừ phạm vi 10.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function LetterLesson() {
  const [selectedLetter, setSelectedLetter] = useState(letters[0]);

  function selectLetter(item) {
    setSelectedLetter(item);
    speakVietnamese(item.sound);
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
          Từ ví dụ: <strong>{selectedLetter.word}</strong>
        </p>
        <div className="voice-actions">
          <button className="btn primary compact" onClick={() => speakVietnamese(selectedLetter.sound)}>
            Nghe chữ
          </button>
          <button className="btn secondary compact" onClick={() => speakVietnamese(selectedLetter.word)}>
            Nghe từ
          </button>
        </div>
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

export default function HocTapPage() {
  return (
    <Suspense
      fallback={
        <main className="dashboard-shell">
          <section className="dashboard-card">Đang tải dữ liệu...</section>
        </main>
      }
    >
      <HocTapContent />
    </Suspense>
  );
}
