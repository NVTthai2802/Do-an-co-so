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

const envApiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
const serviceApiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_BACKEND_URL);
const productionServiceApiUrl =
  serviceApiUrl && !isLocalDevelopmentUrl(serviceApiUrl) ? serviceApiUrl : "";

export const API_URL =
  process.env.NODE_ENV === "production"
    ? envApiUrl && !isLocalDevelopmentUrl(envApiUrl)
      ? envApiUrl
      : productionServiceApiUrl || "/_backend"
    : envApiUrl || serviceApiUrl || "http://localhost:8000";

export async function request(path, { method = "GET", body, token } = {}) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
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
