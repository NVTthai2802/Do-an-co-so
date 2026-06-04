function normalizeApiUrl(value) {
  return value ? value.replace(/\/+$/, "") : "";
}

function isLocalDevelopmentUrl(value) {
  const lowerValue = value.toLowerCase();
  if (lowerValue.startsWith("localhost") || lowerValue.startsWith("127.0.0.1")) {
    return true;
  }

  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isBrowserOnLocalhost() {
  if (typeof window === "undefined") {
    return false;
  }

  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function normalizeServiceApiUrl(value) {
  const normalized = normalizeApiUrl(value);
  return normalized === "/backend" ? "/_backend" : normalized;
}

const envApiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
const serviceApiUrl = normalizeServiceApiUrl(process.env.NEXT_PUBLIC_BACKEND_URL);

export function getApiUrl() {
  if (process.env.NODE_ENV !== "production") {
    return envApiUrl || serviceApiUrl || "http://localhost:8000";
  }

  const browserIsLocal = isBrowserOnLocalhost();
  if (envApiUrl && (browserIsLocal || !isLocalDevelopmentUrl(envApiUrl))) {
    return envApiUrl;
  }

  if (serviceApiUrl && (browserIsLocal || !isLocalDevelopmentUrl(serviceApiUrl))) {
    return serviceApiUrl;
  }

  return "/_backend";
}

export const API_URL = getApiUrl();

export async function request(path, { method = "GET", body, token } = {}) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Đã xảy ra lỗi.");
  }

  return data;
}
