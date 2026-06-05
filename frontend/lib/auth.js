const TOKEN_KEY = "kidlearn_token";
const USER_KEY = "kidlearn_user";
const VERIFICATION_KEY = "kidlearn_verification";

export function saveSession(token, user) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(TOKEN_KEY) || "";
}

export function getStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(USER_KEY);
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    window.localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function saveVerificationSession({
  token,
  email,
  resendAfterSeconds = 60,
  otpExpiresInSeconds = 600,
  code = "",
}) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    VERIFICATION_KEY,
    JSON.stringify({
      token,
      email,
      code,
      resendAvailableAt: Date.now() + resendAfterSeconds * 1000,
      otpExpiresAt: Date.now() + otpExpiresInSeconds * 1000,
    })
  );
}

export function getVerificationSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(VERIFICATION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    window.sessionStorage.removeItem(VERIFICATION_KEY);
    return null;
  }
}

export function clearVerificationSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(VERIFICATION_KEY);
}

