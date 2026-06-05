"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import CompactNumberPicker from "../../../components/CompactNumberPicker";
import LessonNav from "../../../components/LessonNav";
import { recordLearningResult } from "../../../lib/learning";
import { speakVietnamese } from "../../../lib/speech";
import styles from "./TimeLesson.module.css";

const hours = Array.from({ length: 12 }, (_, index) => index + 1);

const minuteGuide =
  "Mỗi vạch chia nhỏ trên mặt đồng hồ là một phút. Kim phút đi qua một số lớn là thêm năm phút. Giờ hơn là khi kim phút từ một đến ba mươi phút. Giờ rưỡi là ba mươi phút. Giờ kém là khi còn thiếu vài phút nữa tới giờ tiếp theo.";

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createGuess() {
  return {
    hour: randomInt(1, 12),
    minute: randomInt(0, 59),
  };
}

function formatMinute(minute) {
  return String(minute).padStart(2, "0");
}

function handPoint(angle, radius) {
  const radian = ((angle - 90) * Math.PI) / 180;
  return {
    x: 110 + Math.cos(radian) * radius,
    y: 110 + Math.sin(radian) * radius,
  };
}

function ClockFace({ hour = 12, minute = 0, size = "large" }) {
  const hourAngle = ((hour % 12) + minute / 60) * 30;
  const minuteAngle = (minute % 60) * 6;
  const hourHand = handPoint(hourAngle, 48);
  const minuteHand = handPoint(minuteAngle, 72);

  return (
    <svg className={`${styles.clockSvg} ${styles[size]}`} viewBox="0 0 220 220" aria-hidden="true">
      <circle cx="110" cy="110" r="102" className={styles.clockRim} />
      {Array.from({ length: 60 }, (_, index) => {
        const angle = index * 6;
        const outer = handPoint(angle, 96);
        const inner = handPoint(angle, index % 5 === 0 ? 84 : 90);
        return (
          <line
            key={index}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            className={index % 5 === 0 ? styles.majorTick : styles.minorTick}
          />
        );
      })}
      {hours.map((number) => {
        const point = handPoint(number * 30, 70);
        return (
          <text key={number} x={point.x} y={point.y + 6} className={styles.clockNumber}>
            {number}
          </text>
        );
      })}
      <line x1="110" y1="110" x2={hourHand.x} y2={hourHand.y} className={styles.hourHand} />
      <line x1="110" y1="110" x2={minuteHand.x} y2={minuteHand.y} className={styles.minuteHand} />
      <circle cx="110" cy="110" r="7" className={styles.clockCenter} />
    </svg>
  );
}

export default function TimeLesson() {
  const [mode, setMode] = useState("hours");
  const [guess, setGuess] = useState(() => createGuess());
  const [feedback, setFeedback] = useState("Ghép giờ và phút đúng với mặt đồng hồ.");
  const [selectedHour, setSelectedHour] = useState(1);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const nextTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    };
  }, []);

  function speakHour(hour) {
    speakVietnamese(`${hour} giờ`);
  }

  function nextGuess() {
    if (nextTimerRef.current) {
      clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }
    setGuess(createGuess());
    setSelectedHour(1);
    setSelectedMinute(0);
    setFeedback("Ghép giờ và phút đúng với mặt đồng hồ.");
  }

  function checkAnswer() {
    if (selectedHour === guess.hour && selectedMinute === guess.minute) {
      setFeedback("Chính xác! Sang câu mới...");
      speakVietnamese(`Đúng rồi, ${guess.hour} giờ ${guess.minute} phút`);
      void recordLearningResult({
        module_key: "time",
        activity_key: "clock_guess",
        title: `Đoán giờ: ${guess.hour}:${String(guess.minute).padStart(2, "0")}`,
        score: 100,
        max_score: 100,
        accuracy: 100,
        time_spent_seconds: 0,
        detail: {
          mode: "guess",
          target_hour: guess.hour,
          target_minute: guess.minute,
          correct: true,
        },
      });
      nextTimerRef.current = setTimeout(nextGuess, 1500);
      return;
    }

    setFeedback("Chưa đúng, thử lại nhé.");
    speakVietnamese("Chưa đúng, thử lại nhé");
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Dạy giờ</span>
            <h1>Nhận diện đồng hồ</h1>
            <p>Học giờ cơ bản, phút cơ bản và luyện đoán giờ kèm phút.</p>
          </div>
          <div className="dashboard-actions">
            <LessonNav />
            <Link href="/dashboard" className="btn secondary">
              Quay lại
            </Link>
          </div>
        </div>

        <div className="mode-tabs secondary-tabs" role="tablist" aria-label="Phần học đồng hồ">
          <button
            className={`mode-tab ${mode === "hours" ? "active" : ""}`}
            onClick={() => setMode("hours")}
            role="tab"
            aria-selected={mode === "hours"}
          >
            Giờ cơ bản
          </button>
          <button
            className={`mode-tab ${mode === "minutes" ? "active" : ""}`}
            onClick={() => setMode("minutes")}
            role="tab"
            aria-selected={mode === "minutes"}
          >
            Phút cơ bản
          </button>
          <button
            className={`mode-tab ${mode === "guess" ? "active" : ""}`}
            onClick={() => setMode("guess")}
            role="tab"
            aria-selected={mode === "guess"}
          >
            Đoán giờ
          </button>
        </div>

        {mode === "hours" ? (
          <section className={styles.clockGrid}>
            {hours.map((hour) => (
              <button key={hour} className={styles.clockButton} onClick={() => speakHour(hour)}>
                <ClockFace hour={hour} minute={0} size="small" />
                <span>{hour} giờ</span>
              </button>
            ))}
          </section>
        ) : null}

        {mode === "minutes" ? (
          <section className={styles.minuteLesson}>
            <div className={styles.guidePanel}>
              <h2>Hướng dẫn đọc phút</h2>
              <p>Mỗi vạch chia nhỏ là 1 phút.</p>
              <p>Mỗi số lớn cách nhau 5 phút: số 1 là 5 phút, số 2 là 10 phút, số 3 là 15 phút.</p>
              <p>Giờ hơn: kim phút từ 1 đến 30 phút. Ví dụ: 4 giờ 15 phút.</p>
              <p>Giờ rưỡi: kim phút ở số 6, tức là 30 phút.</p>
              <p>Giờ kém: kim phút sau 30 phút, đọc theo giờ tiếp theo còn thiếu bao nhiêu phút.</p>
              <button className="btn primary compact" onClick={() => speakVietnamese(minuteGuide)}>
                Nghe hướng dẫn
              </button>
            </div>

            <div className={styles.exampleGrid}>
              <button className={styles.exampleClock} onClick={() => speakVietnamese("Ba giờ rưỡi")}>
                <ClockFace hour={3} minute={30} size="small" />
                <span>3 giờ rưỡi</span>
              </button>
              <button className={styles.exampleClock} onClick={() => speakVietnamese("Bốn giờ hơn mười lăm phút")}>
                <ClockFace hour={4} minute={15} size="small" />
                <span>4 giờ 15 phút</span>
              </button>
              <button className={styles.exampleClock} onClick={() => speakVietnamese("Tám giờ kém mười lăm phút")}>
                <ClockFace hour={7} minute={45} size="small" />
                <span>8 giờ kém 15 phút</span>
              </button>
            </div>
          </section>
        ) : null}

        {mode === "guess" ? (
          <section className={styles.guessLayout}>
            <div className={styles.guessClockPanel}>
              <ClockFace hour={guess.hour} minute={guess.minute} />
              <p>{feedback}</p>
              <button className="btn secondary compact" onClick={nextGuess}>
                Câu mới
              </button>
            </div>

            <div className={styles.timeAnswerPanel} aria-label="Ghép đáp án giờ và phút">
              <div className={styles.timeInputPreview}>
                <strong>{selectedHour}</strong>
                <span>giờ</span>
                <strong>{formatMinute(selectedMinute)}</strong>
                <span>phút</span>
              </div>

              <div className={styles.timePickerGrid}>
                <CompactNumberPicker
                  label="Giờ"
                  value={selectedHour}
                  min={1}
                  max={12}
                  onChange={setSelectedHour}
                  formatValue={(number) => `${number} giờ`}
                />
                <CompactNumberPicker
                  label="Phút"
                  value={selectedMinute}
                  min={0}
                  max={59}
                  onChange={setSelectedMinute}
                  formatValue={(number) => `${formatMinute(number)} phút`}
                />
              </div>

              <button className="btn primary compact" onClick={checkAnswer}>
                Kiểm tra
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
