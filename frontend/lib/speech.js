"use client";

export function speakVietnamese(text) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "vi-VN";
  utterance.rate = 0.82;
  utterance.pitch = 1.05;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function speakWithOptions(text, options = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = options.lang || "vi-VN";
  utterance.rate = options.rate || 0.82;
  utterance.pitch = options.pitch || 1.05;

  if (options.voice) utterance.voice = options.voice;
  if (options.onEnd) utterance.onend = options.onEnd;
  if (options.onBoundary) utterance.onboundary = options.onBoundary;
  if (options.onError) utterance.onerror = options.onError;

  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function pauseSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.resume();
  }
}

// Speech Recognition (STT)
export function createSpeechRecognition(options = {}) {
  if (typeof window === "undefined") return null;

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = options.lang || "vi-VN";
  recognition.continuous = options.continuous !== false;
  recognition.interimResults = options.interimResults !== false;
  recognition.maxAlternatives = 1;

  return recognition;
}

export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
