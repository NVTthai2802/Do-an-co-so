"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { request } from "../lib/api";
import { speakVietnamese } from "../lib/speech";
import styles from "./AirDrawActivity.module.css";

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

function normalizeLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function itemAliases(item) {
  return [item.id, item.label, item.speech, ...(item.aliases || [])].map(normalizeLabel);
}

function findMatchedItem(label, items) {
  const normalized = normalizeLabel(label);
  if (!normalized) return null;

  return (
    items.find((item) =>
      itemAliases(item).some(
        (alias) => alias && (alias === normalized || normalized.includes(alias) || alias.includes(normalized))
      )
    ) || null
  );
}

function pickRandomItem(items, currentId) {
  if (items.length <= 1) return items[0];
  const available = items.filter((item) => item.id !== currentId);
  return available[Math.floor(Math.random() * available.length)];
}

function syncCanvasSize(video, canvases) {
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;

  canvases.forEach((canvas) => {
    if (!canvas) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  });
}

function getForegroundBounds(canvas) {
  const context = canvas.getContext("2d");
  const { width, height } = canvas;
  if (!width || !height) return null;

  const data = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      const brightness = data[index] + data[index + 1] + data[index + 2];
      if (alpha > 12 && brightness > 28) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0 || maxY < 0) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function buildNormalizedDrawing(canvas, size = 256) {
  const bounds = getForegroundBounds(canvas);
  if (!bounds) return null;

  const output = document.createElement("canvas");
  output.width = size;
  output.height = size;
  const context = output.getContext("2d");
  context.fillStyle = "#000";
  context.fillRect(0, 0, size, size);

  const padding = Math.round(size * 0.12);
  const scale = Math.min((size - padding * 2) / bounds.width, (size - padding * 2) / bounds.height);
  const drawWidth = bounds.width * scale;
  const drawHeight = bounds.height * scale;
  const x = (size - drawWidth) / 2;
  const y = (size - drawHeight) / 2;
  context.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, x, y, drawWidth, drawHeight);

  return output;
}

function canvasMask(canvas, size = 96) {
  const normalized = buildNormalizedDrawing(canvas, size);
  if (!normalized) return null;

  const data = normalized.getContext("2d").getImageData(0, 0, size, size).data;
  const mask = new Uint8Array(size * size);
  let count = 0;

  for (let index = 0; index < size * size; index += 1) {
    const offset = index * 4;
    if (data[offset] + data[offset + 1] + data[offset + 2] > 90) {
      mask[index] = 1;
      count += 1;
    }
  }

  return { mask, count, size };
}

function templateMask(item, size = 96) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.fillStyle = "#000";
  context.fillRect(0, 0, size, size);
  item.drawTemplate?.(context, size, size);
  return canvasMask(canvas, size);
}

function dilateMask(mask, size, radius = 3) {
  const output = new Uint8Array(mask.length);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      if (!mask[index]) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            output[ny * size + nx] = 1;
          }
        }
      }
    }
  }
  return output;
}

function scoreAgainstTemplate(canvas, item) {
  const user = canvasMask(canvas);
  const target = templateMask(item);
  if (!user || !target || user.count < 12 || target.count < 12) return 0;

  const userDilated = dilateMask(user.mask, user.size);
  const targetDilated = dilateMask(target.mask, target.size);
  let matchedUser = 0;
  let matchedTarget = 0;

  for (let index = 0; index < user.mask.length; index += 1) {
    if (user.mask[index] && targetDilated[index]) matchedUser += 1;
    if (target.mask[index] && userDilated[index]) matchedTarget += 1;
  }

  const precision = matchedUser / user.count;
  const recall = matchedTarget / target.count;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const balance = Math.min(precision, recall);
  return Math.max(0, Math.min(100, Math.round(f1 * 92 + balance * 8)));
}

export default function AirDrawActivity({ activityLabel, endpoint, items }) {
  const [mode, setMode] = useState("guess");
  const [target, setTarget] = useState(() => items[0]);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [handStatus, setHandStatus] = useState("Camera đang tắt");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [score, setScore] = useState(null);
  const [showFireworks, setShowFireworks] = useState(false);

  const videoRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const rafRef = useRef(null);
  const processingRef = useRef(false);
  const previousHandPointRef = useRef(null);
  const previousPointerPointRef = useRef(null);
  const pointerDrawingRef = useRef(false);
  const fistFramesRef = useRef(0);
  const openPalmFramesRef = useRef(0);
  const lastClearAtRef = useRef(0);
  const lastFinishAtRef = useRef(0);
  const lastStatusRef = useRef("");
  const finishDrawingRef = useRef(() => {});
  const nextTargetDelayRef = useRef(null);
  const isRecognizingRef = useRef(false);
  const modeRef = useRef(mode);

  const actionLabel = activityLabel === "chữ" ? "chữ" : "hình";
  const targetSpeech = target?.speech || target?.label || "";

  const answerOptions = useMemo(() => items, [items]);

  const updateHandStatus = useCallback((status) => {
    if (lastStatusRef.current !== status) {
      lastStatusRef.current = status;
      setHandStatus(status);
    }
  }, []);

  useEffect(() => {
    isRecognizingRef.current = isRecognizing;
  }, [isRecognizing]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const resetResult = useCallback(() => {
    setFeedback("");
    setPrediction(null);
    setScore(null);
    setShowFireworks(false);
  }, []);

  const clearDrawing = useCallback((status = "Đã xóa nét vẽ") => {
    const drawingCanvas = drawingCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (drawingCanvas) {
      drawingCanvas.getContext("2d").clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    }
    if (overlayCanvas) {
      overlayCanvas.getContext("2d").clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
    previousHandPointRef.current = null;
    previousPointerPointRef.current = null;
    openPalmFramesRef.current = 0;
    resetResult();
    updateHandStatus(status);
  }, [resetResult, updateHandStatus]);

  const drawStroke = useCallback((point, previousRef, color = "#fff") => {
    const canvas = drawingCanvasRef.current;
    if (!canvas || !point) return;

    const context = canvas.getContext("2d");
    const previous = previousRef.current;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = Math.max(9, canvas.width * 0.018);

    if (previous) {
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    } else {
      context.beginPath();
      context.arc(point.x, point.y, context.lineWidth / 2, 0, Math.PI * 2);
      context.fill();
    }

    previousRef.current = point;
  }, []);

  const drawFingerHighlight = useCallback((point) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!point) return;

    context.beginPath();
    context.arc(point.x, point.y, Math.max(15, canvas.width * 0.025), 0, Math.PI * 2);
    context.fillStyle = "rgba(255, 68, 88, 0.88)";
    context.fill();
    context.lineWidth = 4;
    context.strokeStyle = "#fff";
    context.stroke();
  }, []);

  const processHandResults = useCallback((results) => {
    const video = videoRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!video || !drawingCanvas || !overlayCanvas) return;

    syncCanvasSize(video, [drawingCanvas, overlayCanvas]);
    const landmarks = results.multiHandLandmarks?.[0];
    if (!landmarks) {
      previousHandPointRef.current = null;
      fistFramesRef.current = 0;
      openPalmFramesRef.current = 0;
      drawFingerHighlight(null);
      updateHandStatus("Đưa tay vào khung camera");
      return;
    }

    const fingerPairs = [
      [8, 6],
      [12, 10],
      [16, 14],
      [20, 18],
    ];
    const extended = fingerPairs.map(([tip, pip]) => landmarks[tip].y < landmarks[pip].y - 0.035);
    const raisedCount = extended.filter(Boolean).length;

    if (raisedCount === 0) {
      previousHandPointRef.current = null;
      openPalmFramesRef.current = 0;
      fistFramesRef.current += 1;
      drawFingerHighlight(null);

      const now = Date.now();
      if (fistFramesRef.current >= 7 && now - lastClearAtRef.current > 900) {
        lastClearAtRef.current = now;
        clearDrawing("Nắm tay: đã xóa nét vẽ");
      } else {
        updateHandStatus("Nắm tay để xóa");
      }
      return;
    }

    fistFramesRef.current = 0;
    if (raisedCount >= 4) {
      previousHandPointRef.current = null;
      drawFingerHighlight(null);
      openPalmFramesRef.current += 1;

      const now = Date.now();
      if (
        openPalmFramesRef.current >= 8 &&
        now - lastFinishAtRef.current > 2500 &&
        !isRecognizingRef.current
      ) {
        lastFinishAtRef.current = now;
        openPalmFramesRef.current = 0;
        updateHandStatus("Đã xòe tay: đang kiểm tra");
        finishDrawingRef.current();
      } else {
        updateHandStatus("Giữ xòe bàn tay để kết thúc");
      }
      return;
    }

    openPalmFramesRef.current = 0;
    if (raisedCount === 1 && extended[0]) {
      const tip = landmarks[8];
      const point = {
        x: (1 - tip.x) * drawingCanvas.width,
        y: tip.y * drawingCanvas.height,
      };
      drawFingerHighlight(point);
      drawStroke(point, previousHandPointRef);
      updateHandStatus("Đang vẽ bằng đầu ngón tay");
      return;
    }

    previousHandPointRef.current = null;
    drawFingerHighlight(null);
    updateHandStatus("Giơ một ngón tay để vẽ, xòe tay để kiểm tra");
  }, [clearDrawing, drawFingerHighlight, drawStroke, updateHandStatus]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    handsRef.current?.close?.();
    handsRef.current = null;
    processingRef.current = false;
    previousHandPointRef.current = null;
    setCameraOn(false);
    updateHandStatus("Camera đang tắt");
  }, [updateHandStatus]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    resetResult();
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
      updateHandStatus("Đang mở camera");
    } catch (error) {
      setCameraError(error.message || "Không mở được camera.");
    }
  }, [resetResult, updateHandStatus]);

  useEffect(() => {
    const video = videoRef.current;
    if (!cameraOn || !video || !streamRef.current) return;

    video.srcObject = streamRef.current;
    const playPromise = video.play();
    if (playPromise?.catch) playPromise.catch(() => {});
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
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.68,
          minTrackingConfidence: 0.58,
        });
        hands.onResults(processHandResults);
        handsRef.current = hands;
        updateHandStatus("Sẵn sàng nhận diện tay");

        const loop = async () => {
          if (cancelled) return;
          const video = videoRef.current;
          if (video?.readyState >= 2 && handsRef.current && !processingRef.current) {
            processingRef.current = true;
            try {
              await handsRef.current.send({ image: video });
            } catch {
              updateHandStatus("Nhận diện tay tạm dừng");
            } finally {
              processingRef.current = false;
            }
          }
          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch {
        updateHandStatus("Có thể vẽ trực tiếp trên khung");
      }
    }

    setupHands();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      processingRef.current = false;
    };
  }, [cameraOn, processHandResults, updateHandStatus]);

  useEffect(() => () => {
    if (nextTargetDelayRef.current) {
      clearTimeout(nextTargetDelayRef.current);
    }
    stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    setTarget((current) => current || items[0]);
  }, [items]);

  function nextTarget() {
    if (nextTargetDelayRef.current) {
      clearTimeout(nextTargetDelayRef.current);
      nextTargetDelayRef.current = null;
    }
    setTarget((current) => pickRandomItem(items, current?.id));
    clearDrawing("Đã đổi mẫu mới");
  }

  function scheduleNextTarget(status = "Câu mới") {
    if (nextTargetDelayRef.current) {
      clearTimeout(nextTargetDelayRef.current);
    }
    nextTargetDelayRef.current = setTimeout(() => {
      setTarget((current) => pickRandomItem(items, current?.id));
      clearDrawing(status);
      nextTargetDelayRef.current = null;
    }, 1400);
  }

  function switchMode(nextMode) {
    if (nextTargetDelayRef.current) {
      clearTimeout(nextTargetDelayRef.current);
      nextTargetDelayRef.current = null;
    }
    setMode(nextMode);
    setTarget((current) => pickRandomItem(items, current?.id));
    clearDrawing(nextMode === "guess" ? "Chế độ vẽ đoán" : "Chế độ vẽ theo hướng dẫn");
  }

  function evaluateManualAnswer(item) {
    resetResult();
    const correct = item.id === target.id;
    setFeedback(correct ? "Đúng rồi!" : "Chưa đúng, thử lại nhé.");
    speakVietnamese(correct ? `Đúng rồi, đó là ${targetSpeech}` : "Thử lại nhé");
    if (correct) {
      scheduleNextTarget("Đã sang đề mới");
    }
  }

  async function recognizeDrawing() {
    const canvas = drawingCanvasRef.current;
    const normalized = canvas ? buildNormalizedDrawing(canvas, 256) : null;
    if (!normalized) {
      setFeedback("Chưa có nét vẽ.");
      return null;
    }

    setIsRecognizing(true);
    setCameraError("");
    try {
      const result = await request(endpoint, {
        method: "POST",
        body: { image: normalized.toDataURL("image/png") },
      });
      const matched = findMatchedItem(result.label, items);
      const displayLabel = matched?.label || result.label || "chưa rõ";
      const enriched = { ...result, displayLabel, matchedId: matched?.id };
      setPrediction(enriched);
      speakVietnamese(`Con đã vẽ ${matched?.speech || displayLabel}`);
      return enriched;
    } catch (error) {
      setPrediction({ error: error.message || "Chưa nhận diện được." });
      return null;
    } finally {
      setIsRecognizing(false);
    }
  }

  async function handleGuessDrawing() {
    resetResult();
    const result = await recognizeDrawing();
    if (!result || result.error) {
      setFeedback(`Model ${actionLabel} chưa sẵn sàng hoặc chưa nhận ra nét vẽ.`);
      return;
    }

    const correct = result.matchedId === target.id;
    setFeedback(correct ? "Vẽ đúng rồi!" : `Máy đoán là ${result.displayLabel}.`);
    if (correct) {
      speakVietnamese(`Đúng rồi, đó là ${targetSpeech}`);
      scheduleNextTarget("Đã sang đề mới");
    }
  }

  async function handleGuideScore() {
    resetResult();
    const canvas = drawingCanvasRef.current;
    const nextScore = canvas && target.drawTemplate ? scoreAgainstTemplate(canvas, target) : 0;
    setScore(nextScore);
    setFeedback(`${nextScore} điểm`);

    if (nextScore > 90) {
      setShowFireworks(true);
      setTimeout(() => setShowFireworks(false), 2200);
      speakVietnamese(`Tuyệt vời, ${nextScore} điểm`);
    } else {
      speakVietnamese(`${nextScore} điểm, mình thử lại nhé`);
    }

    await recognizeDrawing();
  }

  useEffect(() => {
    finishDrawingRef.current = () => {
      if (modeRef.current === "guide") {
        handleGuideScore();
        return;
      }
      handleGuessDrawing();
    };
  });

  function getPointerPoint(event) {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function handlePointerDown(event) {
    event.preventDefault();
    pointerDrawingRef.current = true;
    previousPointerPointRef.current = null;
    drawStroke(getPointerPoint(event), previousPointerPointRef, "#fff");
  }

  function handlePointerMove(event) {
    if (!pointerDrawingRef.current) return;
    event.preventDefault();
    drawStroke(getPointerPoint(event), previousPointerPointRef, "#fff");
  }

  function handlePointerUp() {
    pointerDrawingRef.current = false;
    previousPointerPointRef.current = null;
  }

  return (
    <section className={styles.activity}>
      <div className={styles.modeBar} role="tablist" aria-label={`Chế độ camera học ${actionLabel}`}>
        <button
          type="button"
          className={`${styles.modeButton} ${mode === "guess" ? styles.modeButtonActive : ""}`}
          onClick={() => switchMode("guess")}
          role="tab"
          aria-selected={mode === "guess"}
        >
          Vẽ đoán
        </button>
        <button
          type="button"
          className={`${styles.modeButton} ${mode === "guide" ? styles.modeButtonActive : ""}`}
          onClick={() => switchMode("guide")}
          role="tab"
          aria-selected={mode === "guide"}
        >
          Vẽ theo hướng dẫn
        </button>
      </div>

      <div className={mode === "guide" ? styles.guideLayout : styles.guessLayout}>
        <div className={`${styles.targetPanel} ${mode === "guess" ? styles.guessTargetPanel : ""}`}>
          <div className={styles.panelLabel}>{mode === "guess" ? "Bài vẽ đoán" : "Mẫu hướng dẫn"}</div>
          {mode === "guess" ? (
            <div className={styles.guessPrompt} style={{ "--target-color": target.color || "#5e74f6" }}>
              <span>Hãy vẽ</span>
              <strong>{target.label}</strong>
            </div>
          ) : (
            <>
              <div className={styles.targetPrompt}>Vẽ theo mẫu</div>
              <div className={styles.targetName}>{target.label}</div>
              <div className={styles.targetPreview} style={{ "--target-color": target.color || "#5e74f6" }}>
                {target.preview}
              </div>
            </>
          )}
          <button type="button" className={styles.smallButton} onClick={nextTarget}>
            {mode === "guess" ? "Đề mới" : "Mẫu mới"}
          </button>
        </div>

        <div className={styles.cameraPanel}>
          <div className={styles.cameraStage}>
            {cameraOn ? (
              <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
            ) : (
              <div className={styles.cameraPlaceholder}>Camera</div>
            )}
            <canvas
              ref={drawingCanvasRef}
              className={styles.drawingCanvas}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
            <canvas ref={overlayCanvasRef} className={styles.overlayCanvas} />
            {showFireworks ? (
              <div className={styles.fireworks} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
            ) : null}
          </div>

          <div className={styles.statusRow}>
            <span>{handStatus}</span>
            {score !== null ? <strong>{score}/100</strong> : null}
          </div>

          <div className={styles.buttonRow}>
            {cameraOn ? (
              <button type="button" className={styles.secondaryButton} onClick={stopCamera}>
                Tắt camera
              </button>
            ) : (
              <button type="button" className={styles.secondaryButton} onClick={startCamera}>
                Bật camera
              </button>
            )}
            <button type="button" className={styles.secondaryButton} onClick={() => clearDrawing()}>
              Xóa nét
            </button>
            {mode === "guide" ? (
              <button type="button" className={styles.primaryButton} onClick={handleGuideScore} disabled={isRecognizing}>
                {isRecognizing ? "Đang chấm..." : "Chấm điểm"}
              </button>
            ) : null}
          </div>

          {cameraError ? <div className={styles.error}>{cameraError}</div> : null}
          {feedback ? <div className={styles.feedback}>{feedback}</div> : null}
          {prediction ? (
            <div className={styles.predictionBox}>
              {prediction.error ? (
                <span>{prediction.error}</span>
              ) : (
                <>
                  <span>Máy nhìn thấy: {prediction.displayLabel}</span>
                  {typeof prediction.confidence === "number" ? (
                    <strong>{(prediction.confidence * 100).toFixed(1)}%</strong>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {mode === "guess" ? (
        <div className={styles.answerGrid}>
          {answerOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.answerButton}
              onClick={() => evaluateManualAnswer(item)}
              style={{ "--answer-color": item.color || "#5e74f6" }}
            >
              <span className={styles.answerPreview} aria-hidden="true">
                {item.preview}
              </span>
              <span className={styles.answerLabel}>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
