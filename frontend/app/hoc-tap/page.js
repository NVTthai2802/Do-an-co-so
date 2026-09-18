"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearSession, getToken, saveSession } from "../../lib/auth";
import { request } from "../../lib/api";
import { recordLearningResult } from "../../lib/learning";
import { speakVietnamese } from "../../lib/speech";
import KidTopBar from "../../components/KidTopBar";
import FeedbackBubble from "../../components/FeedbackBubble";
import RewardSummary from "../../components/RewardSummary";
import KidSwitches from "../../components/KidSwitches";
import useQuizSession from "../../hooks/useQuizSession";
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

  // Chế độ "Chơi" dựng khung riêng, vì thanh trên cùng phải mang thanh tiến
  // độ của lượt chơi và ô đếm sao (Mục 4.3), không chỉ tiêu đề.
  if (mode === "math") {
    return <MathGameMode onBackToLearn={() => setMode("learn")} />;
  }

  return (
    <LessonShell title="Số" subject="num">
      <div className="mode-tabs" role="tablist" aria-label="Chế độ học số">
        <button className="mode-tab active" role="tab" aria-selected={true} onClick={() => setMode("learn")}>
          Nhận biết số
        </button>
        <button className="mode-tab" role="tab" aria-selected={false} onClick={() => setMode("math")}>
          Toán học vui
        </button>
      </div>

      <NumberReadingMode />
    </LessonShell>
  );
}

/** 4 đáp án: 1 đúng + 3 nhiễu gần đúng (Mục 5.4 – giảm tải lựa chọn). */
function buildChoices(answer, limit) {
  const set = new Set([answer]);
  let guard = 0;
  while (set.size < 4 && guard < 80) {
    guard += 1;
    const spread = limit <= 10 ? 3 : 12;
    const delta = randomInt(1, spread) * (Math.random() > 0.5 ? 1 : -1);
    const candidate = answer + delta;
    if (candidate >= 0 && candidate <= limit) set.add(candidate);
  }
  for (let n = 0; set.size < 4 && n <= limit; n += 1) set.add(n);

  return [...set].slice(0, 4).sort(() => Math.random() - 0.5);
}

function speakProblem(problem) {
  const op = problem.operator === "+" ? "cộng" : "trừ";
  speakVietnamese(
    `${readNumberVietnamese(problem.left)} ${op} ${readNumberVietnamese(problem.right)} bằng mấy?`
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

function MathGameMode({ onBackToLearn }) {
  const router = useRouter();
  const [rangeLimit, setRangeLimit] = useState(10);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [fingerCount, setFingerCount] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [handStatus, setHandStatus] = useState("Bật camera rồi giơ số ngón tay");

  const starBoxRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const rafRef = useRef(null);
  const processingRef = useRef(false);
  const holdStartRef = useRef(0);
  const stableFingerRef = useRef(null);
  const submittedFingerRef = useRef(null);
  const answerRef = useRef(null);
  const buttonRefs = useRef({});
  // Nguồn thật của đáp án. Chỉ ghi "camera" khi đáp án đến từ MediaPipe
  // (Mục 5.4 – sửa dữ liệu P0); bé bấm nút thì luôn là "tap".
  const answerSourceRef = useRef("tap");

  const makeQuestion = useCallback(() => {
    const problem = createMathProblem(rangeLimit);
    return { ...problem, choices: buildChoices(problem.answer, rangeLimit) };
  }, [rangeLimit]);

  const isCorrect = useCallback((question, value) => value === question.answer, []);

  const hintFor = useCallback((question) => {
    const op = question.operator === "+" ? "thêm" : "bớt";
    return `Mình cùng đếm nhé: ${question.left} ${op} ${question.right} là...`;
  }, []);

  const onFinish = useCallback(
    (summary) => {
      // Ghi kết quả CẢ LƯỢT một lần, với thời gian đo thật (Mục 5.4).
      const source = answerSourceRef.current;
      void recordLearningResult({
        module_key: "math",
        activity_key: source === "camera" ? `camera_math_${rangeLimit}` : `tap_math_${rangeLimit}`,
        title: `Cộng trừ phạm vi ${rangeLimit}`,
        score: summary.correctFirstTry,
        max_score: summary.total,
        accuracy: Math.round((summary.correctFirstTry / summary.total) * 100),
        time_spent_seconds: summary.timeSpentSeconds,
        detail: {
          mode: source,
          range_limit: rangeLimit,
          questions: summary.total,
          correct_first_try: summary.correctFirstTry,
          total_attempts: summary.totalTries,
          wrong_attempts: Math.max(0, summary.totalTries - summary.total),
          stars: summary.stars,
        },
      });
    },
    [rangeLimit]
  );

  const quiz = useQuizSession({ makeQuestion, isCorrect, hintFor, onFinish, starBoxRef });
  const quizAnswer = quiz.answer;

  const answerFromCamera = useCallback(
    (value) => {
      answerSourceRef.current = "camera";
      quizAnswer(value, buttonRefs.current[value] || null);
    },
    [quizAnswer]
  );

  answerRef.current = answerFromCamera;

  useEffect(() => {
    return () => stopCamera(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      const playPromise = videoRef.current.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    }
  }, [cameraOn]);

  // Sang câu mới thì quên số ngón tay đã gửi.
  useEffect(() => {
    resetHeldFinger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.index]);

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
        setCameraError("Không tải được nhận diện tay. Bé vẫn bấm chọn đáp án được.");
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
    const totalFingers = countFingersFromResults(results);
    if (!results.multiHandLandmarks?.length) {
      resetHeldFinger();
      setHandStatus("Chưa thấy bàn tay");
      return;
    }

    setFingerCount(totalFingers);

    const now = Date.now();
    if (stableFingerRef.current !== totalFingers) {
      stableFingerRef.current = totalFingers;
      holdStartRef.current = now;
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
      answerRef.current?.(totalFingers);
    }
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
      setCameraError("Không mở được camera. Bé vẫn bấm chọn đáp án được.");
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

  function switchRange(nextLimit) {
    if (nextLimit === rangeLimit) return;
    if (nextLimit > 10) stopCamera();
    setRangeLimit(nextLimit);
    quiz.replay();
  }

  const question = quiz.question;

  return (
    <main className="kid-shell">
      <KidTopBar
        subject="num"
        title="Số"
        progress={{ current: quiz.index, total: quiz.total }}
        stars={quiz.stars}
        starBoxRef={starBoxRef}
      />

      <div className="kid-lesson subject-num">
        <div className="qcard">
          <div className="qtext">
            {question.left} {question.operator} {question.right} = ?
          </div>
          <button type="button" className="qspeak" aria-label="Nghe câu hỏi" onClick={() => speakProblem(question)}>
            🔊
          </button>
        </div>

        <FeedbackBubble mood={quiz.mood} message={quiz.message} hint={quiz.hint} />

        <div className="answer-grid">
          {question.choices.map((value) => {
            const spent = quiz.wrongValues.includes(value);
            const isAnswer = value === question.answer;
            const classes = [
              "kbtn soft subject-num",
              spent ? "is-spent is-try" : "",
              quiz.shakeValue === value ? "is-try" : "",
              isAnswer && quiz.mood === "happy" ? "is-ok" : "",
              isAnswer && quiz.revealAnswer ? "is-reveal" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={value}
                type="button"
                ref={(el) => {
                  buttonRefs.current[value] = el;
                }}
                className={classes}
                disabled={spent}
                onClick={(event) => {
                  answerSourceRef.current = "tap";
                  quiz.answer(value, event.currentTarget);
                }}
              >
                {value}
              </button>
            );
          })}
        </div>

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
          <button type="button" className="mode-tab" onClick={onBackToLearn}>
            Nhận biết số
          </button>
        </div>

        {/* Camera ẩn mặc định (Mục 5.4): bấm thẻ mới mở khung camera. */}
        {rangeLimit === 10 ? (
          <div className="camera-panel">
            {cameraOn ? (
              <>
                <div className="camera-frame">
                  <video ref={videoRef} autoPlay playsInline muted />
                </div>

                <div className="camera-status">
                  <span>{handStatus}</span>
                  {fingerCount !== null ? <strong>{fingerCount}</strong> : null}
                  <div className="hold-meter" aria-hidden="true">
                    <span style={{ width: `${Math.round(holdProgress * 100)}%` }} />
                  </div>
                </div>

                <div className="camera-actions">
                  <button className="btn secondary" onClick={() => stopCamera()}>
                    Tắt camera
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="camera-toggle-card" onClick={startCamera}>
                <span aria-hidden="true">🖐️</span>
                Trả lời bằng ngón tay
              </button>
            )}

            {cameraError ? <div className="info">{cameraError}</div> : null}
          </div>
        ) : null}

        <KidSwitches />
      </div>

      {quiz.finished ? (
        <RewardSummary
          stars={quiz.finished.stars}
          total={quiz.finished.total}
          correctFirstTry={quiz.finished.correctFirstTry}
          onReplay={quiz.replay}
          onHome={() => router.push("/hoc-tap")}
        />
      ) : null}
    </main>
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
