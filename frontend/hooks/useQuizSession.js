"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { celebrateCorrect, celebrateStreak, flyStar } from "../lib/celebrate";
import { ENCOURAGE, PRAISE, pick, sfx } from "../lib/sfx";
import { speakVietnamese } from "../lib/speech";

// Đã chốt (Mục 8, câu 2): mỗi lượt chơi đúng 5 câu.
export const QUESTIONS_PER_ROUND = 5;

const CORRECT_DELAY = 1200; // Cấp 1 ~1,2 giây rồi tự sang câu mới
const STREAK_DELAY = 1500; // Cấp 2 ~1,5 giây
const SHAKE_MS = 400; // nút rung ~0,38 giây

/**
 * Tính sao cuối lượt theo Mục 6.1: đúng ngay lần đầu cả 5 câu = 3 sao,
 * từ 3 câu trở lên = 2 sao, còn lại = 1 sao. Bé luôn có ít nhất 1 sao.
 */
export function starsFor(correctFirstTry, total = QUESTIONS_PER_ROUND) {
  if (correctFirstTry >= total) return 3;
  if (correctFirstTry >= 3) return 2;
  return 1;
}

/**
 * Quản lý một lượt chơi N câu: câu hiện tại, chuỗi đúng liên tiếp, số sao,
 * số lần thử của câu hiện tại, và gọi đúng cấp hiệu ứng chúc mừng.
 *
 * makeQuestion(index)  -> tạo câu hỏi thứ index
 * isCorrect(q, value)  -> đáp án có đúng không
 * hintFor(q)           -> gợi ý hiện khi bé sai lần thứ 2 (Mục 6.1)
 * onFinish({...})      -> ghi kết quả CẢ LƯỢT khi xong 5 câu
 * starBoxRef           -> ô ⭐ trên thanh trên cùng, để ngôi sao bay tới
 */
export default function useQuizSession({
  makeQuestion,
  isCorrect,
  hintFor,
  onFinish,
  starBoxRef,
  total = QUESTIONS_PER_ROUND,
}) {
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState(() => makeQuestion(0));
  const [streak, setStreak] = useState(0);
  const [stars, setStars] = useState(0);
  const [tries, setTries] = useState(0);
  const [mood, setMood] = useState("idle");
  const [message, setMessage] = useState("Bé chọn đáp án đúng nhé!");
  const [hint, setHint] = useState("");
  const [wrongValues, setWrongValues] = useState([]);
  const [shakeValue, setShakeValue] = useState(null);
  const [finished, setFinished] = useState(null);

  const lockedRef = useRef(false);
  const triesRef = useRef(0);
  const streakRef = useRef(0);
  const correctFirstTryRef = useRef(0);
  const totalTriesRef = useRef(0);
  const questionStartRef = useRef(0);
  const roundStartRef = useRef(0);
  const timersRef = useRef([]);

  // Đo thời gian thật bằng performance.now() (Mục 5.4, sửa dữ liệu P0).
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  const track = useCallback((fn, delay) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Bắt đầu lượt mới
  useEffect(() => {
    clearTimers();
    lockedRef.current = false;
    triesRef.current = 0;
    streakRef.current = 0;
    correctFirstTryRef.current = 0;
    totalTriesRef.current = 0;
    roundStartRef.current = now();
    questionStartRef.current = now();

    setIndex(0);
    setQuestion(makeQuestion(0));
    setStreak(0);
    setStars(0);
    setTries(0);
    setMood("idle");
    setMessage("Bé chọn đáp án đúng nhé!");
    setHint("");
    setWrongValues([]);
    setShakeValue(null);
    setFinished(null);
    // makeQuestion do trang gọi tạo lại mỗi lần render nên không đưa vào deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, clearTimers]);

  const goToNext = useCallback(
    (nextIndex) => {
      if (nextIndex >= total) {
        const spentMs = now() - roundStartRef.current;
        const earned = starsFor(correctFirstTryRef.current, total);
        setStars(earned);
        setFinished({
          stars: earned,
          correctFirstTry: correctFirstTryRef.current,
          total,
          totalTries: totalTriesRef.current,
          timeSpentSeconds: Math.max(1, Math.round(spentMs / 1000)),
        });
        return;
      }

      lockedRef.current = false;
      triesRef.current = 0;
      questionStartRef.current = now();
      setIndex(nextIndex);
      setQuestion(makeQuestion(nextIndex));
      setTries(0);
      setMood("idle");
      setMessage("Bé chọn đáp án đúng nhé!");
      setHint("");
      setWrongValues([]);
      setShakeValue(null);
    },
    [makeQuestion, total]
  );

  // Ghi kết quả CẢ LƯỢT một lần, khi lượt kết thúc.
  const finishedRef = useRef(null);
  useEffect(() => {
    if (!finished || finishedRef.current === finished) return;
    finishedRef.current = finished;
    onFinish?.(finished);
  }, [finished, onFinish]);

  /**
   * Bé trả lời. buttonEl là nút vừa bấm, để pháo giấy bắn ra đúng chỗ đó.
   */
  const answer = useCallback(
    (value, buttonEl) => {
      if (lockedRef.current || finished) return;

      totalTriesRef.current += 1;

      if (isCorrect(question, value)) {
        lockedRef.current = true;

        const firstTry = triesRef.current === 0;
        if (firstTry) correctFirstTryRef.current += 1;

        const nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        setStars((n) => n + 1);
        setMood("happy");
        // Xoá gợi ý của câu trước, nếu không nó còn dính lại trong bong bóng
        // suốt 1,2 giây chờ sang câu mới.
        setHint("");

        // Cấp 1 – mọi câu đúng
        celebrateCorrect(buttonEl);
        flyStar(buttonEl, starBoxRef?.current);

        const isStreak = nextStreak % 3 === 0;
        if (isStreak) {
          // Cấp 2 – chuỗi 3 câu đúng liên tiếp
          celebrateStreak();
          sfx.streak();
          setMessage("Hoan hô! Ba câu đúng liền!");
          speakVietnamese("Hoan hô! Ba câu đúng liền!");
        } else {
          sfx.correct();
          const praise = pick(PRAISE);
          setMessage(praise);
          speakVietnamese(praise);
        }

        track(() => goToNext(index + 1), isStreak ? STREAK_DELAY : CORRECT_DELAY);
        return;
      }

      // Chưa đúng: KHÔNG dùng màu đỏ, KHÔNG hiện số lần sai (Mục 6.1).
      const nextTries = triesRef.current + 1;
      triesRef.current = nextTries;
      setTries(nextTries);

      streakRef.current = 0;
      setStreak(0);
      setMood("think");
      setWrongValues((list) => (list.includes(value) ? list : [...list, value]));

      setShakeValue(value);
      track(() => setShakeValue(null), SHAKE_MS);
      sfx.tryAgain();

      if (nextTries >= 2) {
        // Sai lần 2: gợi ý cách làm, đáp án đúng nhấp nháy (xem CSS .is-reveal)
        const tip = hintFor?.(question) || "";
        setMessage("Mình cùng xem lại nhé.");
        setHint(tip);
        if (tip) speakVietnamese(tip);
      } else {
        const encourage = pick(ENCOURAGE);
        setMessage(encourage);
        speakVietnamese(encourage);
      }
    },
    [finished, goToNext, hintFor, index, isCorrect, question, starBoxRef, track]
  );

  const replay = useCallback(() => {
    finishedRef.current = null;
    setRound((n) => n + 1);
  }, []);

  return {
    index,
    total,
    question,
    streak,
    stars,
    tries,
    mood,
    message,
    hint,
    wrongValues,
    shakeValue,
    finished,
    // Sai từ 2 lần trở lên thì chỉ ra đáp án đúng (Mục 6.1)
    revealAnswer: tries >= 2,
    answer,
    replay,
  };
}
