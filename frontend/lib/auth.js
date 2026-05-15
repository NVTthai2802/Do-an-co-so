const TOKEN_KEY = "kidlearn_token";
const USER_KEY = "kidlearn_user";

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
  return value ? JSON.parse(value) : null;
}

