"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { request } from "../../../lib/api";
import styles from "./HocChu.module.css";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const CHU_DATA = {
  A: { emoji: "🍎", word: "Ăn", example: "A như Ăn cơm" },
  B: { emoji: "🦋", word: "Bướm", example: "B như Bướm bay" },
  C: { emoji: "🐱", word: "Cá", example: "C như Cá vàng" },
  D: { emoji: "🍉", word: "Dưa", example: "D như Dưa hấu" },
  E: { emoji: "🦅", word: "Ếch", example: "E như Ếch xanh" },
  F: { emoji: "🌺", word: "Flower", example: "F như Flower đẹp" },
  G: { emoji: "🐔", word: "Gà", example: "G như Gà con" },
  H: { emoji: "🌸", word: "Hoa", example: "H như Hoa hồng" },
  I: { emoji: "🎁", word: "ích", example: "I như Ích lợi" },
  J: { emoji: "🧃", word: "Juice", example: "J như Juice thơm" },
  K: { emoji: "🍬", word: "Kẹo", example: "K như Kẹo ngọt" },
  L: { emoji: "🍃", word: "Lá", example: "L như Lá xanh" },
  M: { emoji: "🐱", word: "Mèo", example: "M như Mèo con" },
  N: { emoji: "🌙", word: "Núi", example: "N như Núi cao" },
  O: { emoji: "🐞", word: "Ốc", example: "O như Ốc sên" },
  P: { emoji: "🎨", word: "Phố", example: "P như Phố đẹp" },
  Q: { emoji: "🍊", word: "Quả", example: "Q như Quả cam" },
  R: { emoji: "🐉", word: "Rồng", example: "R như Rồng bay" },
  S: { emoji: "🌟", word: "Sao", example: "S như Sao sáng" },
  T: { emoji: "🌳", word: "Thỏ", example: "T như Thỏ trắng" },
  U: { emoji: "🦄", word: "Unicorn", example: "U như Unicorn" },
  V: { emoji: "🦆", word: "Vịt", example: "V như Vịt vàng" },
  W: { emoji: "🌊", word: "Water", example: "W như Water xanh" },
  X: { emoji: "🥝", word: "Xoài", example: "X như Xoài vàng" },
  Y: { emoji: "🌻", word: "Yêu", example: "Y như Yêu thương" },
  Z: { emoji: "⚡", word: "Zip", example: "Z như Zip nhanh" },
};

export default function HocChu() {
  const [activeTab, setActiveTab] = useState("hoc"); // "hoc" | "camera"
  const [selectedLetter, setSelectedLetter] = useState("A");
  const [isAnimating, setIsAnimating] = useState(false);

  // Camera states
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const streamRef = useRef(null);

  const selectLetter = (letter) => {
    if (letter === selectedLetter) return;
    setIsAnimating(true);
    setTimeout(() => {
      setSelectedLetter(letter);
      setIsAnimating(false);
    }, 200);
  };

  // Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
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
      const data = await request("/api/recognize-letter", {
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

  // Cleanup camera on tab switch
  useEffect(() => {
    if (activeTab !== "camera") stopCamera();
  }, [activeTab]);

  useEffect(() => () => stopCamera(), []);

  const info = CHU_DATA[selectedLetter];

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Dạy chữ</span>
            <h1>Học Chữ Cái</h1>
          </div>
          <div className="dashboard-actions">
            <Link href="/dashboard" className="btn secondary">
              Quay lại
            </Link>
          </div>
        </div>

        <div className={styles.lessonContent}>
      <h1 className={styles.title}>🔤 Học Chữ Cái</h1>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === "hoc" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("hoc")}
        >
          📖 Học Chữ
        </button>
        <button
          className={`${styles.tab} ${activeTab === "camera" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("camera")}
        >
          📷 Nhận Dạng
        </button>
      </div>

      {/* ===== TAB HỌC CHỮ ===== */}
      {activeTab === "hoc" && (
        <div className={styles.learnSection}>
          {/* Alphabet grid */}
          <div className={styles.alphabetGrid}>
            {ALPHABET.map((letter) => (
              <button
                key={letter}
                className={`${styles.letterBtn} ${selectedLetter === letter ? styles.letterBtnActive : ""}`}
                onClick={() => selectLetter(letter)}
              >
                {letter}
              </button>
            ))}
          </div>

          {/* Detail card */}
          <div className={`${styles.card} ${isAnimating ? styles.cardFade : ""}`}>
            <div className={styles.letterDisplay}>{selectedLetter}</div>
            <div className={styles.emoji}>{info.emoji}</div>
            <div className={styles.word}>{info.word}</div>
            <div className={styles.example}>{info.example}</div>

            {/* lowercase */}
            <div className={styles.lowercaseRow}>
              <span className={styles.lowercaseLabel}>Chữ thường:</span>
              <span className={styles.lowercase}>
                {selectedLetter.toLowerCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB CAMERA ===== */}
      {activeTab === "camera" && (
        <div className={styles.cameraSection}>
          <p className={styles.cameraHint}>
            Dùng camera để nhận dạng chữ cái bé viết ✏️
          </p>

          <div className={styles.cameraBox}>
            {/* Video feed */}
            {cameraOn && !capturedImage && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={styles.video}
              />
            )}

            {/* Captured image */}
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Ảnh đã chụp"
                className={styles.capturedImg}
              />
            )}

            {/* Placeholder */}
            {!cameraOn && !capturedImage && (
              <div className={styles.cameraPlaceholder}>
                <span className={styles.cameraIcon}>📷</span>
                <p>Nhấn "Bật Camera" để bắt đầu</p>
              </div>
            )}

            <canvas ref={canvasRef} className={styles.hiddenCanvas} />
          </div>

          {/* Buttons */}
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

          {/* Result */}
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
                  <div className={styles.resultLetter}>
                    {prediction.label || prediction.result || "?"}
                  </div>
                  {prediction.confidence !== undefined && (
                    <p className={styles.confidence}>
                      Độ chính xác:{" "}
                      <strong>
                        {(prediction.confidence * 100).toFixed(1)}%
                      </strong>
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
