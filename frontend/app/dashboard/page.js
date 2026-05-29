"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearSession, getToken, saveSession } from "../../lib/auth";
import { request } from "../../lib/api";

// --- HÀM PHÁT ÂM CHẬM & RÕ RÀNG CHO BÉ ---
const speakSlowly = (text) => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel(); // Dừng câu cũ nếu bé bấm liên tục
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN";
    utterance.rate = 0.5; // Tốc độ đọc chậm lại (0.5 là rất chậm và rõ)
    window.speechSynthesis.speak(utterance);
  }
};

// --- DỮ LIỆU BÀI HỌC ---
const numbers = Array.from({ length: 10 }, (_, index) => index + 1);
const numberWords = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín", "mười"];

const letters = [
  { id: "a", label: "A", word: "áo", icon: "👕" },
  { id: "aw", label: "Ă", word: "ăn", icon: "🍚" },
  { id: "aa", label: "Â", word: "ấm", icon: "🫖" },
  { id: "b", label: "B", word: "bé", icon: "🧒" },
  { id: "c", label: "C", word: "cá", icon: "🐟" },
  { id: "d", label: "D", word: "dê", icon: "🐐" },
  { id: "dd", label: "Đ", word: "đèn", icon: "💡" },
  { id: "e", label: "E", word: "em", icon: "🙂" },
];

const shapes = [
  { id: "circle", label: "Hình tròn", text: "Tròn xoe như chiếc bánh xe.", speech: "Hình tròn" },
  { id: "square", label: "Hình vuông", text: "Bốn cạnh bằng nhau.", speech: "Hình vuông" },
  { id: "triangle", label: "Hình tam giác", text: "Có ba góc nhọn.", speech: "Hình tam giác" },
];

// --- COMPONENT DẠY SỐ & LÀM TOÁN ---
function NumberLesson() {
  const [mode, setMode] = useState("read");
  const [selectedNumber, setSelectedNumber] = useState(1);
  const [problem, setProblem] = useState({ a: 0, b: 0, ans: 0 });
  const [cameraActive, setCameraActive] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resultMsg, setResultMsg] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const generateProblem = useCallback(() => {
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * (10 - a)) + 1;
    setProblem({ a, b, ans: a + b });
    setResultMsg("");
  }, []);

  useEffect(() => {
    if (mode === "math") generateProblem();
    return () => stopCamera();
  }, [mode, generateProblem]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Bắt buộc video phải play() sau khi nạp xong dữ liệu stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.log("Lỗi play video:", e));
        };
      }
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      alert("Không thể mở camera. Vui lòng cấp quyền sử dụng máy ảnh cho trình duyệt!");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setCameraActive(false);
  };

  const checkAnswer = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setChecking(true);
    setResultMsg("");
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64Image = canvas.toDataURL("image/jpeg", 0.8);
      const token = getToken();
      
      const res = await request("/recognize-number", {
        method: "POST",
        token: token,
        body: { image: base64Image }
      });

      const recognizedNumber = parseInt(res.recognized_number);
      
      if (recognizedNumber === problem.ans) {
        setResultMsg(`🎉 Hoan hô! Bé giơ đúng số ${recognizedNumber} rồi!`);
        speakSlowly(`Hoan hô! Bé làm đúng rồi.`);
        setTimeout(generateProblem, 4000);
      } else {
        setResultMsg(`🤔 Máy nhìn ra số ${recognizedNumber}. Bé thử giơ lại nhé!`);
        speakSlowly(`Bé thử lại nhé.`);
      }
    } catch (error) {
      console.error(error);
      setResultMsg("❌ Có lỗi kết nối tới Server AI.");
      speakSlowly("Máy chủ đang bận, bé chờ chút nhé.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="activity-panel">
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', justifyContent: 'center' }}>
        <button 
          className={`btn ${mode === 'read' ? 'primary' : 'secondary'} compact`} 
          onClick={() => { setMode('read'); stopCamera(); }}
        >
          1️⃣ Học đọc số
        </button>
        <button 
          className={`btn ${mode === 'math' ? 'primary' : 'secondary'} compact`} 
          onClick={() => setMode('math')}
        >
          📸 Làm toán AI
        </button>
      </div>

      {mode === "read" && (
        <>
          <div className="chip-grid number-chip-grid">
            {numbers.map((num) => (
              <button
                key={num}
                className={`chip ${selectedNumber === num ? "active" : ""}`}
                onClick={() => {
                  setSelectedNumber(num);
                  speakSlowly(`Số ${numberWords[num]}`);
                }}
              >
                {num}
              </button>
            ))}
          </div>
          <div className="spotlight">
            <div 
              className="giant-number" 
              style={{ cursor: "pointer" }}
              onClick={() => speakSlowly(`Số ${numberWords[selectedNumber]}`)}
            >
              {selectedNumber}
            </div>
            <div className="number-word">Số {numberWords[selectedNumber]}</div>
          </div>
        </>
      )}

      {mode === "math" && (
        <div style={{ textAlign: 'center', backgroundColor: '#f9fafb', padding: '20px', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '2.5rem', color: '#ff6b6b', margin: '0 0 20px 0' }}>
            {problem.a} + {problem.b} = ?
          </h2>
          
          <div style={{ margin: '0 auto', maxWidth: '400px', border: '4px dashed #4ecdc4', borderRadius: '16px', padding: '8px', backgroundColor: '#fff', minHeight: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!cameraActive ? (
              <button className="btn primary" onClick={startCamera}>Bật Camera</button>
            ) : (
              <>
                {/* Đã thêm css object-fit cover để chống méo hình */}
                <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: '8px', transform: 'scaleX(-1)', objectFit: 'cover' }} />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </>
            )}
          </div>

          {cameraActive && (
            <div style={{ marginTop: '20px' }}>
              <button className="btn primary" onClick={checkAnswer} disabled={checking}>
                {checking ? "Đang chấm điểm..." : "📸 Kiểm tra đáp án"}
              </button>
            </div>
          )}

          {resultMsg && (
            <div style={{ marginTop: '20px', fontSize: '1.2rem', fontWeight: 'bold', color: resultMsg.includes('Hoan hô') ? '#2b8a3e' : '#c92a2a' }}>
              {resultMsg}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// --- COMPONENT DẠY CHỮ CÁI ---
function LetterLesson() {
  const [selectedLetter, setSelectedLetter] = useState(letters[0]);

  function selectLetter(letter) {
    setSelectedLetter(letter);
    speakSlowly(`Chữ ${letter.label}`);
  }

  return (
    <section className="activity-panel">
      <div className="chip-grid letter-chip-grid">
        {letters.map((letter) => (
          <button
            key={letter.id}
            className={`chip ${selectedLetter.id === letter.id ? "active" : ""}`}
            onClick={() => selectLetter(letter)}
          >
            {letter.label}
          </button>
        ))}
      </div>
      <div className="spotlight">
        {/* Bấm vào chữ to chỉ đọc "Chữ A" */}
        <div 
          className="giant-letter" 
          style={{ cursor: "pointer" }}
          onClick={() => speakSlowly(`Chữ ${selectedLetter.label}`)}
        >
          {selectedLetter.label}
        </div>
        {/* Bấm vào khối từ vựng chỉ đọc "Áo" */}
        <div 
          className="letter-word" 
          style={{ cursor: "pointer", display: "inline-block", padding: "10px 20px", backgroundColor: "#f1f3f5", borderRadius: "15px" }}
          onClick={() => speakSlowly(selectedLetter.word)}
        >
          {selectedLetter.word} <span className="word-icon">{selectedLetter.icon}</span>
        </div>
      </div>
    </section>
  );
}

// --- COMPONENT DẠY HÌNH HỌC ---
function ShapeLesson() {
  const [selectedShape, setSelectedShape] = useState(shapes[0]);

  function selectShape(shape) {
    setSelectedShape(shape);
    speakSlowly(shape.speech);
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
        {/* Bấm vào hình để nghe đọc tên hình */}
        <div 
          className={`shape-preview ${selectedShape.id}`} 
          style={{ cursor: "pointer" }}
          onClick={() => speakSlowly(selectedShape.speech)}
        />
        <p><strong>{selectedShape.label}</strong> - {selectedShape.text}</p>
      </div>
    </section>
  );
}

// --- GIAO DIỆN CHÍNH ---
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonType = searchParams.get("lesson");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentToken = getToken();
    if (!currentToken) {
      router.replace("/login");
      return;
    }

    request("/auth/me", { token: currentToken })
      .then((data) => {
        setUser(data.user);
        saveSession(currentToken, data.user);
      })
      .catch(() => {
        clearSession();
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    const currentToken = getToken();
    try {
      await request("/auth/logout", { method: "POST", token: currentToken });
    } catch {} finally {
      clearSession();
      router.replace("/login");
    }
  }

  if (loading) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">Đang mở lớp học vui nhộn...</section>
      </main>
    );
  }

  if (lessonType) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">
          <div className="dashboard-header">
            <div>
              <span className="badge">
                {lessonType === "numbers" ? "Dạy số" : lessonType === "letters" ? "Dạy chữ" : "Dạy hình"}
              </span>
              <h1>Vui học mỗi ngày!</h1>
            </div>
            <div className="dashboard-actions">
              <Link href="/dashboard" className="btn secondary">Quay lại</Link>
            </div>
          </div>
          <div style={{ marginTop: "28px" }}>
            {lessonType === "numbers" && <NumberLesson />}
            {lessonType === "letters" && <LetterLesson />}
            {lessonType === "shapes" && <ShapeLesson />}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Lớp học của bé</span>
            <h1>Xin chào, {user?.name || "bé"}!</h1>
            <p>Chọn một bài học để bắt đầu khám phá.</p>
          </div>
          <div className="dashboard-actions">
            <button className="btn secondary" onClick={handleLogout}>Đăng xuất</button>
          </div>
        </div>

        <div className="lesson-grid" style={{ marginTop: "28px" }}>
          <Link href="/dashboard?lesson=numbers" className="lesson-card hover-scale">
            <div className="lesson-icon">📊</div>
            <h2>Dạy số & Toán</h2>
            <p>Nhận biết số đếm và làm toán tương tác qua Camera AI.</p>
            <div className="lesson-cta">Vào học →</div>
          </Link>
          <Link href="/dashboard?lesson=letters" className="lesson-card hover-scale">
            <div className="lesson-icon">🔤</div>
            <h2>Dạy chữ</h2>
            <p>Học 29 chữ cái tiếng Việt với ví dụ dễ hiểu.</p>
            <div className="lesson-cta">Vào học →</div>
          </Link>
          <Link href="/dashboard?lesson=shapes" className="lesson-card hover-scale">
            <div className="lesson-icon">🎨</div>
            <h2>Dạy hình</h2>
            <p>Nhận dạng hình cơ bản qua màu sắc và mô tả.</p>
            <div className="lesson-cta">Vào học →</div>
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <main className="dashboard-shell">
        <section className="dashboard-card">Đang tải dữ liệu...</section>
      </main>
    }>
      <DashboardContent />
    </Suspense>
  );
}