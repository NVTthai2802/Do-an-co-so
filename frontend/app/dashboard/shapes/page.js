"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { request } from "../../../lib/api";
import styles from "./HocHinh.module.css";

const SHAPES = [
  {
    id: "tron",
    name: "Hình Tròn",
    emoji: "⭕",
    color: "#ef4444",
    desc: "Không có cạnh, không có góc. Như mặt trăng, quả bóng!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#ef4444" strokeWidth="6" />
      </svg>
    ),
  },
  {
    id: "vuong",
    name: "Hình Vuông",
    emoji: "🟥",
    color: "#3b82f6",
    desc: "4 cạnh bằng nhau, 4 góc vuông. Như ô gạch, hộp quà!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <rect x="14" y="14" width="72" height="72" fill="none" stroke="#3b82f6" strokeWidth="6" />
      </svg>
    ),
  },
  {
    id: "tamgiac",
    name: "Hình Tam Giác",
    emoji: "🔺",
    color: "#f59e0b",
    desc: "3 cạnh, 3 góc. Như núi, mái nhà, pizza!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <polygon points="50,10 92,88 8,88" fill="none" stroke="#f59e0b" strokeWidth="6" />
      </svg>
    ),
  },
  {
    id: "chunhat",
    name: "Hình Chữ Nhật",
    emoji: "▬",
    color: "#10b981",
    desc: "4 cạnh, 2 cặp cạnh bằng nhau. Như cửa sổ, sách vở!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <rect x="8" y="26" width="84" height="48" fill="none" stroke="#10b981" strokeWidth="6" />
      </svg>
    ),
  },
  {
    id: "thayap",
    name: "Hình Thoi",
    emoji: "🔷",
    color: "#8b5cf6",
    desc: "4 cạnh bằng nhau nhưng góc không vuông. Như viên kim cương!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <polygon points="50,8 90,50 50,92 10,50" fill="none" stroke="#8b5cf6" strokeWidth="6" />
      </svg>
    ),
  },
  {
    id: "luc",
    name: "Hình Lục Giác",
    emoji: "⬡",
    color: "#ec4899",
    desc: "6 cạnh bằng nhau. Như tổ ong, sàn gỗ lục giác!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <polygon
          points="50,6 90,28 90,72 50,94 10,72 10,28"
          fill="none"
          stroke="#ec4899"
          strokeWidth="6"
        />
      </svg>
    ),
  },
  {
    id: "sao",
    name: "Hình Ngôi Sao",
    emoji: "⭐",
    color: "#f97316",
    desc: "5 cánh nhọn. Như sao trên bầu trời đêm!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <polygon
          points="50,6 61,38 96,38 68,58 79,90 50,70 21,90 32,58 4,38 39,38"
          fill="none"
          stroke="#f97316"
          strokeWidth="5"
        />
      </svg>
    ),
  },
  {
    id: "trai_tim",
    name: "Hình Trái Tim",
    emoji: "❤️",
    color: "#e11d48",
    desc: "Biểu tượng của tình yêu và sự quan tâm!",
    svg: (
      <svg viewBox="0 0 100 100" width="120" height="120">
        <path
          d="M50 85 C50 85 10 58 10 35 C10 20 22 10 35 14 C42 16 50 24 50 24 C50 24 58 16 65 14 C78 10 90 20 90 35 C90 58 50 85 50 85Z"
          fill="none"
          stroke="#e11d48"
          strokeWidth="5"
        />
      </svg>
    ),
  },
];

export default function HocHinh() {
  const [activeTab, setActiveTab] = useState("hoc");
  const [selectedShape, setSelectedShape] = useState(SHAPES[0]);
  const [isAnimating, setIsAnimating] = useState(false);

  // Camera
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const streamRef = useRef(null);

  const selectShape = (shape) => {
    if (shape.id === selectedShape.id) return;
    setIsAnimating(true);
    setTimeout(() => {
      setSelectedShape(shape);
      setIsAnimating(false);
    }, 200);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
      setCapturedImage(null);
      setPrediction(null);
    } catch (err) {
      alert("Không thể mở camera: " + err.message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg");
    setCapturedImage(imageData);
    stopCamera();
    sendToBackend(imageData);
  };

  const sendToBackend = async (imageData) => {
    setIsLoading(true);
    setPrediction(null);
    try {
      const data = await request("/api/recognize-shape", {
        method: "POST",
        body: { image: imageData },
      });
      setPrediction(data);
    } catch (err) {
      setPrediction({ error: "Lỗi kết nối máy chủ" });
    } finally {
      setIsLoading(false);
    }
  };

  const retake = () => {
    setCapturedImage(null);
    setPrediction(null);
    startCamera();
  };

  useEffect(() => {
    if (activeTab !== "camera") stopCamera();
  }, [activeTab]);

  useEffect(() => () => stopCamera(), []);

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Dạy hình</span>
            <h1>Học Hình Dạng</h1>
          </div>
          <div className="dashboard-actions">
            <Link href="/dashboard" className="btn secondary">
              Quay lại
            </Link>
          </div>
        </div>

        <div className={styles.lessonContent}>
      <h1 className={styles.title}>🔷 Học Hình Dạng</h1>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === "hoc" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("hoc")}
        >
          📐 Học Hình
        </button>
        <button
          className={`${styles.tab} ${activeTab === "camera" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("camera")}
        >
          📷 Nhận Dạng
        </button>
      </div>

      {/* ===== TAB HỌC HÌNH ===== */}
      {activeTab === "hoc" && (
        <div className={styles.learnSection}>
          {/* Shape grid */}
          <div className={styles.shapeGrid}>
            {SHAPES.map((shape) => (
              <button
                key={shape.id}
                className={`${styles.shapeBtn} ${
                  selectedShape.id === shape.id ? styles.shapeBtnActive : ""
                }`}
                onClick={() => selectShape(shape)}
                style={{
                  "--shape-color": shape.color,
                  borderColor:
                    selectedShape.id === shape.id ? shape.color : undefined,
                }}
              >
                <span className={styles.shapeEmoji}>{shape.emoji}</span>
                <span className={styles.shapeBtnName}>{shape.name.replace("Hình ", "")}</span>
              </button>
            ))}
          </div>

          {/* Detail card */}
          <div
            className={`${styles.card} ${isAnimating ? styles.cardFade : ""}`}
            style={{ "--shape-color": selectedShape.color }}
          >
            <div className={styles.svgArea}>{selectedShape.svg}</div>
            <div className={styles.shapeName}>{selectedShape.name}</div>
            <div className={styles.shapeDesc}>{selectedShape.desc}</div>

            <div className={styles.emojiRow}>
              <span className={styles.shapeEmojiLarge}>{selectedShape.emoji}</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB CAMERA ===== */}
      {activeTab === "camera" && (
        <div className={styles.cameraSection}>
          <p className={styles.cameraHint}>
            Vẽ một hình lên giấy rồi chụp ảnh để nhận dạng! 🎨
          </p>

          <div className={styles.cameraBox}>
            {cameraOn && !capturedImage && (
              <video ref={videoRef} autoPlay playsInline className={styles.video} />
            )}
            {capturedImage && (
              <img src={capturedImage} alt="Ảnh đã chụp" className={styles.capturedImg} />
            )}
            {!cameraOn && !capturedImage && (
              <div className={styles.cameraPlaceholder}>
                <span className={styles.cameraIcon}>📷</span>
                <p>Nhấn "Bật Camera" để bắt đầu</p>
              </div>
            )}
            <canvas ref={canvasRef} className={styles.hiddenCanvas} />
          </div>

          <div className={styles.btnRow}>
            {!cameraOn && !capturedImage && (
              <button className={styles.btnPrimary} onClick={startCamera}>
                🎥 Bật Camera
              </button>
            )}
            {cameraOn && (
              <>
                <button className={styles.btnPrimary} onClick={capturePhoto}>
                  📸 Chụp Ảnh
                </button>
                <button className={styles.btnSecondary} onClick={stopCamera}>
                  ✕ Tắt Camera
                </button>
              </>
            )}
            {capturedImage && (
              <button className={styles.btnSecondary} onClick={retake}>
                🔄 Chụp Lại
              </button>
            )}
          </div>

          {isLoading && (
            <div className={styles.resultBox}>
              <div className={styles.spinner} /> Đang nhận dạng...
            </div>
          )}

          {prediction && !isLoading && (
            <div className={styles.resultBox}>
              {prediction.error ? (
                <p className={styles.error}>❌ {prediction.error}</p>
              ) : (
                <>
                  <p className={styles.resultLabel}>Kết quả nhận dạng:</p>
                  <div className={styles.resultShape}>
                    {prediction.label || prediction.result || "?"}
                  </div>
                  {prediction.confidence !== undefined && (
                    <p className={styles.confidence}>
                      Độ chính xác:{" "}
                      <strong>{(prediction.confidence * 100).toFixed(1)}%</strong>
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
        </div>
      </section>
    </main>
  );
}
