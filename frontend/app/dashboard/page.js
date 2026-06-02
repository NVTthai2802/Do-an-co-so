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
  const [recognizing, setRecognizing] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => stopCamera(false);
  }, []);

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOn]);

  function evaluateAnswer(number) {
    setDetectedNumber(number);
    if (number === problem.answer) {
      setFeedback("Chính xác!");
      speakVietnamese("Chính xác");
      return;
    }

    setFeedback("Thử lại nhé");
    speakVietnamese("Thử lại nhé");
  }

  function nextProblem() {
    setProblem(createMathProblem());
    setDetectedNumber(null);
    setFeedback("Sẵn sàng");
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
    } catch {
      setCameraError("Không mở được camera.");
    }
  }

  function stopCamera(updateState = true) {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (updateState) {
      setCameraOn(false);
    }
  }

  async function recognizeFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) {
      setCameraError("Camera chưa sẵn sàng.");
      return;
    }

    setRecognizing(true);
    setCameraError("");
    const context = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", 0.86);

    try {
      const result = await request("/api/recognize-number", {
        method: "POST",
        body: { image },
      });
      if (typeof result.number !== "number") {
        setFeedback("Chưa nhận ra số");
        return;
      }
      evaluateAnswer(result.number);
    } catch (error) {
      setCameraError(error.message || "Chưa nhận diện được.");
    } finally {
      setRecognizing(false);
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
          <div className="detected-number">Đáp án nhận diện: {detectedNumber}</div>
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
          <canvas ref={canvasRef} hidden />
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
          <button
            className="btn primary"
            onClick={recognizeFrame}
            disabled={!cameraOn || recognizing}
          >
            {recognizing ? "Đang nhận diện..." : "Chụp đáp án"}
          </button>
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
